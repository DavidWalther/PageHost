const ActionUpdate = require('../actions/update.js');
const { TableIdentity } = require('../../tables/identity.js');

jest.mock('../../../modules/logging');

/**
 * `ActionUpdate` schreibt in `configuration` und `identity` — die beiden
 * Tabellen, die nicht zum Inhalt gehören.
 *
 * Die Werte gehen **gebunden** in die Anfrage. Vorher liefen sie durch den
 * `Sanitizer` und dann in den SQL-Text; über diesen Weg lief unter anderem der
 * Refresh-Token, dessen Inhalt vom Client stammt.
 */
describe('ActionUpdate', () => {
  let pgConnector;
  let table;

  beforeEach(() => {
    pgConnector = {
      executeParameterizedSql: jest.fn().mockResolvedValue([{ id: '123' }]),
    };
    table = new TableIdentity();
  });

  function newAction(values) {
    return new ActionUpdate()
      .setPgConnector(pgConnector)
      .setTable(table)
      .setValues(values);
  }

  /** Das zuletzt abgesetzte Statement mit seinen gebundenen Werten. */
  function lastCall() {
    const [sql, parameters, options] =
      pgConnector.executeParameterizedSql.mock.calls.at(-1);
    return { sql, parameters, options };
  }

  it('setzt die übergebenen Felder und bindet ihre Werte', async () => {
    await newAction({
      id: '123',
      key: 'user@test.com',
      active: true,
    }).execute();

    const { sql, parameters } = lastCall();
    expect(sql).toBe(
      `UPDATE ${table.getTableName()()} SET key = $1, active = $2 WHERE id = $3 RETURNING * ;`
    );
    expect(parameters).toEqual(['user@test.com', true, '123']);
  });

  it('lässt einen Wert mit SQL darin harmlos', async () => {
    await newAction({ id: '123', key: "x' OR '1'='1" }).execute();

    const { sql, parameters } = lastCall();
    expect(sql).not.toContain("OR '1'='1");
    expect(parameters).toEqual(["x' OR '1'='1", '123']);
  });

  it('lässt einen Wert unverändert, statt Anführungszeichen zu verdoppeln', async () => {
    // Der `Sanitizer` hat hier früher jedes Apostroph verdoppelt und den Wert
    // getrimmt. Mit gebundenen Werten kommt er an, wie er geschickt wurde.
    await newAction({ id: '123', key: " O'Brien " }).execute();

    expect(lastCall().parameters[0]).toBe(" O'Brien ");
  });

  it('schließt die Verbindung nach dem Schreiben', async () => {
    await newAction({ id: '123', key: 'a' }).execute();

    expect(lastCall().options).toEqual({ closeConnection: true });
  });

  it('gibt zurück, was die Datenbank meldet', async () => {
    expect(await newAction({ id: '123', key: 'a' }).execute()).toEqual([
      { id: '123' },
    ]);
  });

  it('verlangt eine Id im Datensatz', async () => {
    await expect(newAction({ key: 'a' }).execute()).rejects.toThrow(
      "Update operation requires an 'id' field in the data object."
    );
  });

  it('weist einen Wert zurück, der keine Spalte füllen kann', async () => {
    await expect(
      newAction({ id: '123', key: { first: 'John' } }).execute()
    ).rejects.toThrow('Unsupported value type');
  });

  it('verlangt Connector, Tabelle und Daten', () => {
    expect(() => new ActionUpdate().setPgConnector(null)).toThrow(
      'Postgres connector is required'
    );
    expect(() => new ActionUpdate().setTable(null)).toThrow(
      'Table is required'
    );
    expect(() => new ActionUpdate().setValues(null)).toThrow(
      'Data object is required'
    );
  });
});
