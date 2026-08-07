const { ActionGet } = require('../actions/get.js');
const { PostgresActions } = require('../pgConnector.js');

/**
 * `ActionGet` liest aus `configuration` und `identity` — den beiden Tabellen,
 * die nicht zum Inhalt gehören.
 *
 * Diese Suite prüfte einmal LEFT JOINs, Publish-Filter je Tabellenseite und
 * Sortier-Strategien. All das gehörte zum alten Datenmodell und ist mit ihm
 * verschwunden. Was bleibt, ist eine Abfrage über eine Tabelle — und die
 * Zusicherung, die dabei am meisten zählt: **Werte stehen nicht im SQL-Text.**
 */

jest.mock('../pgConnector.js');
jest.mock('../../../modules/logging');

const MOCK_ENVIRONMENT = {
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  PGHOST: 'localhost',
  PGDATABASE: 'test',
  PGUSER: 'testUser',
  PGPASSWORD: 'testPassword',
  ENDPOINT_ID: 'testEndpoint',
  PG_LOCAL_DB: 'true',
};

let executeParameterizedSql;

beforeEach(() => {
  executeParameterizedSql = jest.fn().mockResolvedValue([]);
  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql,
  }));
});

function newAction() {
  return new ActionGet()
    .setPgConnector(new PostgresActions(MOCK_ENVIRONMENT))
    .setTableName('identity')
    .setTableFields(['id', 'key', 'active']);
}

/** Das zuletzt abgesetzte Statement mit seinen gebundenen Werten. */
function lastCall() {
  const [sql, parameters, options] = executeParameterizedSql.mock.calls.at(-1);
  return { sql, parameters, options };
}

describe('ActionGet', () => {
  describe('Abfrage', () => {
    it('wählt die angegebenen Felder aus der angegebenen Tabelle', async () => {
      await newAction().execute();

      expect(lastCall().sql).toBe('SELECT id, key, active FROM identity');
    });

    it('wählt alles, wenn keine Felder angegeben sind', async () => {
      await new ActionGet()
        .setPgConnector(new PostgresActions(MOCK_ENVIRONMENT))
        .setTableName('identity')
        .execute();

      expect(lastCall().sql).toBe('SELECT * FROM identity');
    });

    it('nimmt Tabellenname und Felder auch als Funktion entgegen', async () => {
      // Die Tabellen-Definitionen liefern beides als Getter.
      await new ActionGet()
        .setPgConnector(new PostgresActions(MOCK_ENVIRONMENT))
        .setTableName(() => 'configuration')
        .setTableFields(() => ['key', 'value'])
        .execute();

      expect(lastCall().sql).toBe('SELECT key, value FROM configuration');
    });

    it('schließt die Verbindung nach der Abfrage', async () => {
      await newAction().execute();

      expect(lastCall().options).toEqual({ closeConnection: true });
    });
  });

  describe('App-Filter', () => {
    it('bildet Positiv-Liste und Negativ-Ausnahme ab', async () => {
      await newAction().setConditionApplicationKey('meineApp').execute();

      const { sql } = lastCall();
      expect(sql).toContain("applicationIncluded LIKE '%' || $1 || '%'");
      expect(sql).toContain("applicationIncluded = '*'");
      expect(sql).toContain('applicationExcluded IS NULL');
      expect(sql).toContain("applicationExcluded NOT LIKE '%' || $1 || '%'");
    });

    it('bindet den Schlüssel, statt ihn einzusetzen', async () => {
      await newAction().setConditionApplicationKey('meineApp').execute();

      const { sql, parameters } = lastCall();
      expect(parameters).toEqual(['meineApp']);
      expect(sql).not.toContain('meineApp');
    });

    it('lässt die Bedingung weg, wenn kein Schlüssel gesetzt ist', async () => {
      await newAction().execute();

      expect(lastCall().sql).not.toContain('WHERE');
    });
  });

  describe('setConditionEquals', () => {
    it('bindet den Wert und nummeriert die Platzhalter durch', async () => {
      await newAction()
        .setConditionApplicationKey('meineApp')
        .setConditionEquals('key', 'nutzer@example.com')
        .execute();

      const { sql, parameters } = lastCall();
      expect(sql).toContain('key = $2');
      expect(parameters).toEqual(['meineApp', 'nutzer@example.com']);
    });

    it('lässt einen Wert mit SQL darin harmlos', async () => {
      // Genau der Weg, über den ein Anmeldeschlüssel hereinkommt.
      await newAction().setConditionEquals('key', "x' OR '1'='1").execute();

      const { sql, parameters } = lastCall();
      expect(sql).toBe('SELECT id, key, active FROM identity WHERE (key = $1)');
      expect(parameters).toEqual(["x' OR '1'='1"]);
    });

    it('nimmt auch einen Ausdruck als linke Seite', async () => {
      // Der RefreshEndpoint sucht in einem JSON-Feld.
      await newAction()
        .setConditionEquals("refreshtoken->>'token'", 'abc-123')
        .execute();

      expect(lastCall().sql).toContain("refreshtoken->>'token' = $1");
      expect(lastCall().parameters).toEqual(['abc-123']);
    });

    it('überspringt eine Bedingung ohne Ausdruck', async () => {
      await newAction().setConditionEquals(null, 'egal').execute();

      expect(lastCall().sql).not.toContain('WHERE');
    });
  });

  describe('setCustomConditions', () => {
    it('hängt ein Fragment ohne Wert an', async () => {
      await newAction().setCustomConditions('active = true').execute();

      const { sql, parameters } = lastCall();
      expect(sql).toContain('active = true');
      expect(parameters).toEqual([]);
    });

    it('verbindet mehrere Bedingungen mit AND', async () => {
      await newAction()
        .setConditionEquals('key', 'nutzer@example.com')
        .setCustomConditions('active = true')
        .execute();

      expect(lastCall().sql).toContain('WHERE (key = $1 AND active = true)');
    });
  });

  describe('Ergebnis', () => {
    it('macht die Ersetzungen des Sanitizers rückgängig', async () => {
      const { Sanitizer } = require('../actions/sanitizer.js');
      executeParameterizedSql.mockResolvedValue([
        { key: Sanitizer.sanitize("Robert'); DROP TABLE identity;--") },
      ]);

      const [row] = await newAction().execute();

      expect(row.key).toBe("Robert'); DROP TABLE identity;--");
    });

    it('reicht durch, was keine Zeilenliste ist', async () => {
      executeParameterizedSql.mockResolvedValue(undefined);

      expect(await newAction().execute()).toBeUndefined();
    });
  });
});
