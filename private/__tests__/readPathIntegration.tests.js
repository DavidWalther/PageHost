/**
 * Integrationstests des Lesepfads — Sichtbarkeit, Cache, Scopes, Inhaltsbaum.
 *
 * Endpoint, `DataFacade` und `NodeContentRepository` laufen echt; gemockt ist
 * nur externes I/O (`pgConnector`, `DataCache2`, Logging).
 *
 * Abgrenzung zu `typeFreeEndpointsIntegration.tests.js`: dort geht es um die
 * **Antwortform** der beiden Routen, hier um das Verhalten dahinter — dass die
 * Facade den Cache zur richtigen Zeit fragt, dass der `edit`-Scope Cache und
 * Publish-Filter aussetzt, dass die App-Zugehörigkeit greift, **bevor** ein
 * Cache-Schlüssel entsteht, und dass der Inhaltsbaum erst bei der Auslieferung
 * gefiltert wird.
 */

jest.mock('../database2/DataStorage/pgConnector.js');
jest.mock('../database2/DataCache/DataCache.js');
jest.mock('../modules/logging');

const { PostgresActions } = require('../database2/DataStorage/pgConnector.js');
const { DataCache2 } = require('../database2/DataCache/DataCache.js');

const {
  TypeFreeQueryEndpoint,
} = require('../endpoints/data/query/TypeFreeQueryEndpoint');
const ContentsEndpoint = require('../endpoints/api/1.0/contents/ContentsEndpoint');

const APPLICATION_KEY = 'nodeApp';
const FREMDE_APP = 'andereApp';
const GESTERN = '2020-01-01T00:00:00.000Z';
const MORGEN = '2999-01-01T00:00:00.000Z';

const ENVIRONMENT = Object.freeze({
  APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
  CACHE_KEY_PREFIX: 'TEST',
  CACHE_DATA_INCREMENT: '1',
  CACHE_CONTAINER_EXPIRATION_SECONDS: 60,
});

// ─── Zeilen des neuen Modells ───────────────────────────────────────────────

const STORY_NODE = {
  id: 'n-story',
  name: 'Story A',
  description: null,
  sortnumber: 1,
  reversed: null,
  parent_node_id: null,
  cover_node_id: 'n-kapitel',
  legacy_id: '000s00000000000011',
  published_date: GESTERN,
  is_parent_controls_visibility: false,
};
const KAPITEL_NODE = {
  id: 'n-kapitel',
  name: 'Kapitel A',
  description: null,
  sortnumber: 1,
  reversed: true,
  parent_node_id: 'n-story',
  cover_node_id: null,
  legacy_id: '000c00000000000022',
  published_date: GESTERN,
  is_parent_controls_visibility: true,
};
/** Erbt die Sichtbarkeit, ist aber noch nicht veröffentlicht. */
const KAPITEL_UNVEROEFFENTLICHT = {
  ...KAPITEL_NODE,
  id: 'n-kapitel-morgen',
  name: 'Kapitel B',
  sortnumber: 2,
  reversed: null,
  legacy_id: '000c00000000000023',
  published_date: MORGEN,
};

const ABSATZ = {
  id: 'cn-absatz',
  name: 'Absatz 1',
  sortnumber: 1,
  legacy_id: '000p00000000000033',
  published_date: GESTERN,
  node_id: 'n-kapitel',
  active_content_item: 'ci-html',
};

/** Zeilen, die der pgConnector-Mock je Abfrage ausliefert. */
let rows;
let executedStatements;
let cacheStore;
let cacheGet;
let cacheSet;

beforeEach(() => {
  executedStatements = [];
  cacheStore = new Map();
  rows = {
    nodes: [STORY_NODE, KAPITEL_NODE, KAPITEL_UNVEROEFFENTLICHT],
    appNodes: [
      { node_id: 'n-story', relation: 'include', app_name: APPLICATION_KEY },
    ],
    contentNodes: [ABSATZ],
    content: [
      {
        ...ABSATZ,
        item_id: 'ci-text',
        item_type: 'text',
        item_content: 'Reiner Text',
      },
      {
        ...ABSATZ,
        item_id: 'ci-html',
        item_type: 'html',
        item_content: '<p>Reiner Text</p>',
      },
    ],
  };

  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql: jest.fn(async (statement) => {
      executedStatements.push(statement);
      if (statement.includes('FROM app_node')) return rows.appNodes;
      if (statement.includes('FROM content_node cn')) return rows.content;
      if (statement.includes('FROM content_node')) return rows.contentNodes;
      return rows.nodes;
    }),
  }));

  cacheGet = jest.fn(async (key) =>
    cacheStore.has(key) ? cacheStore.get(key) : null
  );
  cacheSet = jest.fn(async (key, value) => {
    cacheStore.set(key, value);
  });
  DataCache2.mockReset();
  DataCache2.mockImplementation(() => ({
    get: cacheGet,
    set: cacheSet,
    del: jest.fn(),
  }));
});
// ─── Aufrufhilfen ───────────────────────────────────────────────────────────

function runEndpoint(endpoint, { query = {}, scopes } = {}) {
  const responseObject = {
    json: jest.fn(),
    status: jest.fn(),
    send: jest.fn(),
  };
  endpoint
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({ query })
    .setResponseObject(responseObject);
  if (scopes) {
    // Die Endpoints erwarten ein Set (`this.scopes?.has('edit')`).
    endpoint.setScopes(new Set(scopes));
  }
  return endpoint.execute().then(() => responseObject.json.mock.calls[0][0]);
}

const getNode = (options) =>
  runEndpoint(new TypeFreeQueryEndpoint('node'), options);
const getContent = (options) =>
  runEndpoint(new TypeFreeQueryEndpoint('content'), options);
const getContents = (options) => runEndpoint(new ContentsEndpoint(), options);

/** Wurde überhaupt gegen Postgres gefragt? */
function queriedDatabase() {
  return executedStatements.length > 0;
}

describe('Lesepfad', () => {
  describe('Quelle', () => {
    it('fragt node und app_node ab — die alten Tabellen gibt es nicht mehr', async () => {
      await getNode({ query: { id: 'n-story' } });

      expect(executedStatements.some((sql) => sql.includes('FROM node'))).toBe(
        true
      );
      expect(
        executedStatements.some((sql) => sql.includes('FROM app_node'))
      ).toBe(true);
      expect(executedStatements.some((sql) => /FROM Story/i.test(sql))).toBe(
        false
      );
    });

    it('löst einen Deep-Link auf die alte Id auf', async () => {
      // Die Spalte `legacy_id` bleibt, damit alte Links auflösbar sind —
      // zurück kommt aber die neue Id.
      const node = await getNode({ query: { id: '000s00000000000011' } });

      expect(node.id).toBe('n-story');
      expect(node.legacy_id).toBe('000s00000000000011');
    });
  });

  describe('Cache', () => {
    it('schreibt den Knoten nach einem Cache-Miss in den Cache', async () => {
      const node = await getNode({ query: { id: 'n-story' } });

      expect(cacheGet).toHaveBeenCalled();
      expect(cacheSet).toHaveBeenCalled();
      const [, cachedValue] = cacheSet.mock.calls[0];
      expect(cachedValue).toEqual(node);
    });

    it('beantwortet den zweiten Aufruf aus dem Cache, ohne erneut abzufragen', async () => {
      const erste = await getNode({ query: { id: 'n-story' } });

      executedStatements = [];
      const zweite = await getNode({ query: { id: 'n-story' } });

      expect(zweite).toEqual(erste);
      expect(queriedDatabase()).toBe(false);
    });

    it('legt nur bereits gefilterte Inhalte im Cache ab', async () => {
      // Die App-Zugehörigkeit wird direkt nach der Abfrage aufgelöst, noch vor
      // dem Cache-Schlüssel. Ein für diese App unsichtbares Kapitel darf
      // deshalb gar nicht erst im Cache landen.
      rows.appNodes = [
        { node_id: 'n-story', relation: 'include', app_name: APPLICATION_KEY },
        {
          node_id: 'n-kapitel',
          relation: 'exclude',
          app_name: APPLICATION_KEY,
        },
      ];

      await getNode({ query: { id: 'n-story' } });

      const [, cachedValue] = cacheSet.mock.calls[0];
      expect(cachedValue.nodes).toEqual([]);
    });
  });

  describe('App-Zugehörigkeit', () => {
    it('liefert nichts, wenn der Knoten einer anderen App gehört', async () => {
      rows.appNodes = [
        { node_id: 'n-story', relation: 'include', app_name: FREMDE_APP },
      ];

      expect(await getNode({ query: { id: 'n-story' } })).toEqual({});
    });

    it('erbt die Sichtbarkeit vom Parent, wo der Knoten es zulässt', async () => {
      // Das Kapitel hat keine eigene app_node-Zeile; sichtbar ist es allein,
      // weil `is_parent_controls_visibility` gesetzt ist.
      const node = await getNode({ query: { id: 'n-kapitel' } });

      expect(node.id).toBe('n-kapitel');
    });

    it('liefert nichts, wenn die Vererbungskette unterbrochen ist', async () => {
      rows.nodes = [
        STORY_NODE,
        { ...KAPITEL_NODE, is_parent_controls_visibility: false },
      ];

      expect(await getNode({ query: { id: 'n-kapitel' } })).toEqual({});
    });
  });

  describe('Publish-Filter', () => {
    it('lässt unveröffentlichte Kind-Knoten heraus', async () => {
      const node = await getNode({ query: { id: 'n-story' } });

      expect(node.nodes.map((child) => child.id)).toEqual(['n-kapitel']);
    });

    it('liefert mit edit-Scope auch unveröffentlichte Kind-Knoten', async () => {
      const node = await getNode({
        query: { id: 'n-story' },
        scopes: ['edit'],
      });

      expect(node.nodes.map((child) => child.id)).toEqual([
        'n-kapitel',
        'n-kapitel-morgen',
      ]);
    });

    it('umgeht mit edit-Scope den Cache', async () => {
      await getNode({ query: { id: 'n-story' }, scopes: ['edit'] });

      expect(cacheGet).not.toHaveBeenCalled();
      expect(queriedDatabase()).toBe(true);
    });

    it('hält einen unveröffentlichten Inhalt zurück — anders als früher', async () => {
      // Der alte direkte Absatz-Zugriff kannte gar keinen Publish-Filter.
      rows.content = rows.content.map((row) => ({
        ...row,
        published_date: MORGEN,
      }));

      expect(await getContent({ query: { id: 'cn-absatz' } })).toEqual({});
    });
  });

  describe('Knoten und Inhalt', () => {
    it('liefert die Inhalts-Kopfdaten ohne die Repräsentationen', async () => {
      const node = await getNode({ query: { id: 'n-kapitel' } });

      expect(node.contents).toEqual([
        {
          id: 'cn-absatz',
          legacy_id: '000p00000000000033',
          name: 'Absatz 1',
          sortnumber: 1,
          published_date: GESTERN,
        },
      ]);
    });

    it('liefert den Inhalt mit allen Repräsentationen', async () => {
      const content = await getContent({ query: { id: 'cn-absatz' } });

      expect(content.items).toEqual([
        { id: 'ci-text', type: 'text', content: 'Reiner Text' },
        { id: 'ci-html', type: 'html', content: '<p>Reiner Text</p>' },
      ]);
      expect(content.active_type).toBe('html');
      expect(content.node_id).toBe('n-kapitel');
    });

    it('benennt die aktive Fassung, statt sie auszuwählen', async () => {
      rows.content = rows.content.map((row) => ({
        ...row,
        active_content_item: 'ci-text',
      }));

      const content = await getContent({ query: { id: 'cn-absatz' } });

      expect(content.active_type).toBe('text');
      expect(content.items).toHaveLength(2);
    });
  });

  describe('Inhaltsbaum', () => {
    it('liefert Wurzelknoten mit ihren Kindern als childnodes', async () => {
      const { result } = await getContents();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('n-story');
      expect(result[0].childnodes.map((node) => node.id)).toEqual([
        'n-kapitel',
      ]);
    });

    it('filtert unveröffentlichte Knoten erst bei der Auslieferung', async () => {
      // Der Baum kommt vollständig aus der Datenschicht; ohne edit-Scope
      // entfernt der ContentVisibilityFilter das unveröffentlichte Kapitel,
      // mit edit-Scope bleibt es stehen.
      const { result } = await getContents({ scopes: ['edit'] });

      expect(result[0].childnodes.map((node) => node.id)).toEqual([
        'n-kapitel',
        'n-kapitel-morgen',
      ]);
    });

    it('lässt publishdate und die App-Spalten nie in die Antwort', async () => {
      const { result } = await getContents();

      expect(result[0]).not.toHaveProperty('publishdate');
      expect(result[0]).not.toHaveProperty('applicationincluded');
      expect(result[0].childnodes[0]).not.toHaveProperty('publishdate');
    });
  });
});
