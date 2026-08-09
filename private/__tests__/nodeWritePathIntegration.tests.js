/**
 * Integrationstests des Schreibpfads auf dem NEUEN Datenmodell.
 *
 * Gegenstück zu `nodeSourceIntegration.tests.js` für die Schreibrichtung:
 * Endpoint, `DataFacade`, `NodeContentRepository` und `NodeWriteMapping` laufen
 * echt, gemockt sind nur `pgConnector`, `DataCache2` und Logging.
 *
 * Die Einheiten sind je Operation in
 * `repositories/__tests__/NodeContentRepository.write.tests.js` abgedeckt. Hier
 * geht es um das Zusammenspiel: dass der Payload des Frontends unverändert
 * ankommt, dass Berechtigung und Cache-Umgehung greifen und dass Veröffentlichen
 * und Zurückziehen über denselben Weg laufen wie eine normale Änderung.
 */

jest.mock('../database2/DataStorage/pgConnector.js');
jest.mock('../database2/DataCache/DataCache.js');
jest.mock('../modules/logging');

const { PostgresActions } = require('../database2/DataStorage/pgConnector.js');
const { DataCache2 } = require('../database2/DataCache/DataCache.js');

const UpsertEndpoint = require('../endpoints/api/1.0/data/upsertEndpoint.js');
const DeleteEndpoint = require('../endpoints/api/1.0/data/deleteEndpoint.js');
const PublishEndpoint = require('../endpoints/api/1.0/action/publishEndpoint.js');
const UnpublishEndpoint = require('../endpoints/api/1.0/action/unpublishEndpoint.js');

const APPLICATION_KEY = 'schreibApp';

const ENVIRONMENT = Object.freeze({
  APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify([
    'create',
    'edit',
    'delete',
    'publish',
  ]),
  CACHE_KEY_PREFIX: 'TEST',
  CACHE_DATA_INCREMENT: '1',
  // CONTENT_SOURCE bleibt ungesetzt: geprüft wird der Standard.
});

let executed;
let responses;
let cacheDel;

function respondWith(pattern, rows) {
  responses.push({ pattern, rows });
}

function statementsMatching(pattern) {
  return executed.filter((entry) => entry.sql.includes(pattern));
}

beforeEach(() => {
  executed = [];
  responses = [];

  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    transaction: jest.fn(async (callback) =>
      callback(async (sql, parameters = []) => {
        executed.push({ sql, parameters });
        const match = responses.find((entry) => sql.includes(entry.pattern));
        return match ? match.rows : [];
      })
    ),
    executeParameterizedSql: jest.fn(async (sql, parameters = []) => {
      executed.push({ sql, parameters });
      const match = responses.find((entry) => sql.includes(entry.pattern));
      return match ? match.rows : [];
    }),
    // `DataStorage` setzt seine Statements über den alten Weg ab — nötig für
    // die Objekte, die nicht zum Inhalt gehören (identity, configuration).
    executeSql: jest.fn(async (sql) => {
      executed.push({ sql, parameters: [] });
      const match = responses.find((entry) => sql.includes(entry.pattern));
      return match ? match.rows : [];
    }),
  }));

  cacheDel = jest.fn();
  DataCache2.mockReset();
  DataCache2.mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: cacheDel,
  }));
});

function createResponse() {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return response;
}

async function runEndpoint(EndpointClass, request) {
  const response = createResponse();
  await new EndpointClass()
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({ url: '/test', ...request })
    .setResponseObject(response)
    .execute();
  return response;
}

describe('Schreibpfad auf dem neuen Datenmodell', () => {
  describe('Zuständigkeit', () => {
    // Die Umstellung betrifft Inhalte. `identity` trägt den Refresh-Token und
    // gehört zur Anmeldung, `configuration` zu den App-Metadaten — beide
    // Tabellen bleiben unverändert und müssen beschreibbar bleiben.
    //
    // Geprüft wird an der abgesetzten SQL, nicht am Aufruf einer Klasse: die
    // Frage lautet, in welche TABELLE geschrieben wird.
    const { DataFacade } = require('../database2/DataFacade.js');

    it('schreibt identity in die identity-Tabelle', async () => {
      await new DataFacade(ENVIRONMENT).setSkipCache(true).updateData({
        object: 'identity',
        payload: { id: 'identity-1', refreshtoken: '{"token":"abc"}' },
      });

      expect(statementsMatching('UPDATE identity')).toHaveLength(1);
      expect(statementsMatching('content_node')).toHaveLength(0);
      expect(statementsMatching('UPDATE node')).toHaveLength(0);
    });

    it('schreibt configuration in die configuration-Tabelle', async () => {
      await new DataFacade(ENVIRONMENT).setSkipCache(true).updateData({
        object: 'configuration',
        payload: { id: 'conf-1', value: 'x' },
      });

      expect(statementsMatching('UPDATE configuration')).toHaveLength(1);
      expect(statementsMatching('content_node')).toHaveLength(0);
    });

    it('weist ein unbekanntes Objekt ab, statt es irgendwo abzulegen', async () => {
      // Der Kern des Fehlers, der die Anmeldung zerlegt hat: „Knoten? sonst
      // content_node" hat jedes fremde Objekt in die Inhaltstabelle geschickt.
      const { NodeWriteMapping } = require('../modules/NodeWriteMapping.js');

      expect(() => NodeWriteMapping.tableFor('identity')).toThrow(
        'has no table in the node model'
      );
      expect(() => NodeWriteMapping.tableFor('content_item')).toThrow(
        'has no table in the node model'
      );
    });
  });

  describe('Anlegen', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-story' }]);
      respondWith('INSERT INTO node', [{ id: 'n-neu', name: 'Kapitel' }]);
    });

    it('schreibt in node', async () => {
      await runEndpoint(UpsertEndpoint, {
        body: {
          object: 'node',
          payload: {
            parent_node_id: 'n-story',
            name: 'Kapitel',
            sortnumber: 1,
            reversed: false,
            published_date: null,
          },
        },
      });

      expect(statementsMatching('INSERT INTO node')).toHaveLength(1);
    });

    it('nimmt den Payload der Editierkomponente unverändert an', async () => {
      // Genau die Felder, die `custom-chapter-edit` schickt.
      const response = await runEndpoint(UpsertEndpoint, {
        body: {
          object: 'node',
          payload: {
            parent_node_id: 'n-story',
            name: 'Kapitel',
            sortnumber: 1,
            reversed: false,
            published_date: null,
          },
        },
      });

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json.mock.calls[0][0].success).toBe(true);
    });

    it('gibt die Id des angelegten Datensatzes zurück', async () => {
      const response = await runEndpoint(UpsertEndpoint, {
        body: {
          object: 'node',
          payload: { parent_node_id: 'n-story', name: 'Kapitel' },
        },
      });

      expect(response.json.mock.calls[0][0].result.id).toBe('n-neu');
      expect(statementsMatching('AS legacy_id')).toEqual([]);
    });

    it('verweigert das Anlegen, wenn die Aktion nicht freigeschaltet ist', async () => {
      const response = createResponse();
      await new UpsertEndpoint()
        .setEnvironment({
          ...ENVIRONMENT,
          APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']),
        })
        .setRequestObject({
          url: '/test',
          body: { object: 'node', payload: { name: 'Kapitel' } },
        })
        .setResponseObject(response)
        .execute();

      expect(response.status).toHaveBeenCalledWith(403);
      expect(statementsMatching('INSERT INTO node')).toHaveLength(0);
    });
  });

  describe('Ändern', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-kapitel' }]);
      respondWith('UPDATE node SET', [
        { id: 'n-kapitel', legacy_id: '000c00000000000022', name: 'Neu' },
      ]);
    });

    it('erkennt an der Id, dass es eine Änderung ist', async () => {
      await runEndpoint(UpsertEndpoint, {
        body: {
          object: 'node',
          payload: { id: '000c00000000000022', name: 'Neu' },
        },
      });

      expect(statementsMatching('UPDATE node SET')).toHaveLength(1);
      expect(statementsMatching('INSERT INTO node')).toHaveLength(0);
    });

    it('bindet die Werte, statt sie in den SQL-Text zu schreiben', async () => {
      await runEndpoint(UpsertEndpoint, {
        body: {
          object: 'node',
          payload: { id: '000c00000000000022', name: "O'Brien" },
        },
      });

      const [update] = statementsMatching('UPDATE node SET');
      expect(update.sql).not.toContain("O'Brien");
      expect(update.parameters).toContain("O'Brien");
    });

    it('meldet einen Fehler, wenn der Datensatz nicht existiert', async () => {
      responses = [];
      respondWith('SELECT id FROM node WHERE', []);

      const response = await runEndpoint(UpsertEndpoint, {
        body: {
          object: 'node',
          payload: { id: '000c99999999999999', name: 'Neu' },
        },
      });

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json.mock.calls[0][0].error).toContain(
        'Record not found'
      );
    });
  });

  describe('Löschen', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-story' }]);
      respondWith('WITH RECURSIVE descendants', [
        { id: 'n-kapitel', legacy_id: '000c00000000000022' },
        { id: 'n-story', legacy_id: '000s00000000000011' },
      ]);
      respondWith('SELECT id, legacy_id FROM content_node WHERE node_id', [
        { id: 'cn-1', legacy_id: '000p00000000000033' },
      ]);
    });

    it('räumt den ganzen Teilbaum ab', async () => {
      const response = await runEndpoint(DeleteEndpoint, {
        query: { object: 'node', id: '000s00000000000011' },
      });

      expect(response.status).toHaveBeenCalledWith(200);
      expect(statementsMatching('DELETE FROM content_item')).toHaveLength(1);
      expect(statementsMatching('DELETE FROM node WHERE id')).toHaveLength(2);
    });

    it('räumt die Cache-Einträge des ganzen Teilbaums ab', async () => {
      // War lange ein FEHLVERHALTEN-Test: `DeleteEndpoint` setzt
      // `skipCache(true)`, und daran hing auch das Aufräumen — der gelöschte
      // Datensatz blieb bis zum Ablauf der Frist im Cache. Durch das Löschen
      // ganzer Teilbäume blieben zuletzt auch die Einträge der Kinder stehen.
      await runEndpoint(DeleteEndpoint, {
        query: { object: 'node', id: '000s00000000000011' },
      });

      const cleared = cacheDel.mock.calls.map(([key]) => key);
      // Jeder entfernte Datensatz unter beiden Ids, dazu der Inhaltsbaum.
      expect(cleared).toEqual(
        expect.arrayContaining([
          'node:n-story',
          'node:000s00000000000011',
          'node:n-kapitel',
          'node:000c00000000000022',
          'content:cn-1',
          'content:000p00000000000033',
          'contentsTree',
        ])
      );
    });

    it('verweigert das Löschen, wenn die Aktion nicht freigeschaltet ist', async () => {
      const response = createResponse();
      await new DeleteEndpoint()
        .setEnvironment({
          ...ENVIRONMENT,
          APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']),
        })
        .setRequestObject({
          url: '/test',
          query: { object: 'node', id: '000s00000000000011' },
        })
        .setResponseObject(response)
        .execute();

      expect(response.status).toHaveBeenCalledWith(403);
      expect(statementsMatching('DELETE FROM node')).toHaveLength(0);
    });
  });

  describe('Veröffentlichen und Zurückziehen', () => {
    /** Der Lesepfad, über den beide Endpunkte den Ist-Zustand holen. */
    function seedRead({ published }) {
      respondWith('FROM app_node', [
        {
          node_id: 'n-kapitel',
          relation: 'include',
          app_name: APPLICATION_KEY,
        },
      ]);
      respondWith('FROM node', [
        {
          id: 'n-kapitel',
          name: 'Kapitel',
          sortnumber: 1,
          parent_node_id: null,
          legacy_id: '000c00000000000022',
          published_date: published ? '2020-01-01T00:00:00.000Z' : null,
          is_parent_controls_visibility: false,
        },
      ]);
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-kapitel' }]);
      respondWith('UPDATE node SET', [
        { id: 'n-kapitel', legacy_id: '000c00000000000022' },
      ]);
    }

    it('setzt beim Veröffentlichen ein Datum auf published_date', async () => {
      seedRead({ published: false });

      const response = await runEndpoint(PublishEndpoint, {
        body: { object: 'node', id: '000c00000000000022' },
      });

      expect(response.status).toHaveBeenCalledWith(200);
      const [update] = statementsMatching('UPDATE node SET');
      expect(update.sql).toContain('published_date = $1');
      expect(update.parameters[0]).not.toBeNull();
    });

    it('nullt beim Zurückziehen published_date', async () => {
      seedRead({ published: true });

      const response = await runEndpoint(UnpublishEndpoint, {
        body: { object: 'node', id: '000c00000000000022' },
      });

      expect(response.status).toHaveBeenCalledWith(200);
      const [update] = statementsMatching('UPDATE node SET');
      expect(update.sql).toContain('published_date = $1');
      expect(update.parameters[0]).toBeNull();
    });

    it('meldet 400, wenn bereits zurückgezogen wurde', async () => {
      seedRead({ published: false });

      const response = await runEndpoint(UnpublishEndpoint, {
        body: { object: 'node', id: '000c00000000000022' },
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(statementsMatching('UPDATE node SET')).toHaveLength(0);
    });

    it('meldet 400, wenn bereits veröffentlicht wurde', async () => {
      // War lange ein FEHLVERHALTEN-Test: `publishEndpoint` prüfte
      // `existingRecord.publishDate` (camelCase), der Lesepfad liefert aber
      // `publishdate` — die Prüfung griff nie. Behoben, als die beiden
      // Endpunkte für `node`/`content` geöffnet wurden: seitdem liest
      // `PublishFields.valueOf` das Datum aus **beiden** Antwortformen.
      seedRead({ published: true });

      const response = await runEndpoint(PublishEndpoint, {
        body: { object: 'node', id: '000c00000000000022' },
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(statementsMatching('UPDATE node SET')).toHaveLength(0);
    });
  });
});
