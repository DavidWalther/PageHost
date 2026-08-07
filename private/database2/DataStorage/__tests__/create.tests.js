const { ActionCreate } = require('../actions/create.js');
const { TableConfiguration } = require('../../tables/configuration.js');

jest.mock('../../../modules/logging');

/**
 * `ActionCreate` legt Zeilen in `configuration` und `identity` an — den beiden
 * Tabellen, die nicht zum Inhalt gehören.
 *
 * Die Werte gehen **gebunden** in die Anfrage. Vorher liefen sie durch den
 * `Sanitizer` und dann in den SQL-Text; das Verdoppeln der Anführungszeichen
 * war der Ersatz für eine Bindung.
 */
describe('ActionCreate', () => {
  let pgConnector;
  let table;

  beforeEach(() => {
    pgConnector = {
      executeParameterizedSql: jest.fn().mockResolvedValue([{ id: '123' }]),
    };
    table = new TableConfiguration();
  });

  function newAction() {
    return new ActionCreate().setPgConnector(pgConnector).setTable(table);
  }

  function lastCall() {
    const [sql, parameters] =
      pgConnector.executeParameterizedSql.mock.calls.at(-1);
    return { sql, parameters };
  }

  it('baut ein INSERT mit Platzhaltern statt Werten', async () => {
    await newAction()
      .setValue('key', 'metaTitle')
      .setValue('value', 'Mein Titel')
      .execute();

    const { sql, parameters } = lastCall();
    expect(sql).toBe(
      `INSERT INTO ${table.getTableName()()} (key, value) VALUES ($1, $2) RETURNING *;`
    );
    expect(parameters).toEqual(['metaTitle', 'Mein Titel']);
  });

  it('lässt einen Wert mit SQL darin harmlos', async () => {
    await newAction()
      .setValue('key', 'metaTitle')
      .setValue('value', "x'); DROP TABLE configuration;--")
      .execute();

    const { sql, parameters } = lastCall();
    expect(sql).not.toContain('DROP TABLE');
    expect(parameters).toContain("x'); DROP TABLE configuration;--");
  });

  it('lässt einen Wert unverändert, statt Anführungszeichen zu verdoppeln', async () => {
    await newAction().setValue('value', " O'Brien ").execute();

    expect(lastCall().parameters).toEqual([" O'Brien "]);
  });

  it('nimmt null und Zahlen entgegen', async () => {
    await newAction().setValue('key', 'zahl').setValue('value', null).execute();

    expect(lastCall().parameters).toEqual(['zahl', null]);
  });

  it('überspringt ein Feld ohne Wert', async () => {
    await newAction()
      .setValue('key', 'metaTitle')
      .setValue('value', undefined)
      .execute();

    expect(lastCall().parameters).toEqual(['metaTitle']);
  });

  it('weist ein Feld zurück, das die Tabelle nicht kennt', () => {
    expect(() => newAction().setValue('gibtEsNicht', 'x')).toThrow(
      'is not defined for table'
    );
  });

  it('weist einen Wert zurück, der keine Spalte füllen kann', () => {
    expect(() => newAction().setValue('value', { a: 1 })).toThrow(
      'Unsupported value type'
    );
  });
});
