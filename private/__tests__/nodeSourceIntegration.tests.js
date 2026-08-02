/**
 * Integrationstests des Lesepfads auf dem NEUEN Datenmodell.
 *
 * Gegenstück zu den Charakterisierungstests: die halten den alten Lesepfad fest
 * und lesen dafür ausdrücklich aus `story` / `chapter` / `paragraph`. Diese
 * Datei prüft, was ab der Umstellung tatsächlich läuft — Endpoint, `DataFacade`,
 * Cache-Verhalten, Scopes und `NodeContentRepository` echt, gemockt ist nur
 * externes I/O (`pgConnector`, `DataCache2`, Logging).
 *
 * Der gemeinsame Vertrag (`repositories/__tests__/contentRepositoryContract.tests.js`)
 * sichert zu, dass beide Quellen dieselbe Antwort bauen. Was er nicht abdeckt,
 * ist alles oberhalb der Quelle: dass die Facade den Cache zur richtigen Zeit
 * fragt, dass der `edit`-Scope Cache und Publish-Filter aussetzt und dass die
 * App-Zugehörigkeit greift, **bevor** ein Cache-Schlüssel entsteht. Genau das
 * steht hier.
 */

jest.mock('../database2/DataStorage/pgConnector.js');
jest.mock('../database2/DataCache/DataCache.js');
jest.mock('../modules/logging');

const { PostgresActions } = require('../database2/DataStorage/pgConnector.js');
const { DataCache2 } = require('../database2/DataCache/DataCache.js');

const {
  SingleStoryEndpoint,
} = require('../endpoints/data/query/SingleStoryEndpoint');
const { ChapterEndpoint } = require('../endpoints/data/query/ChapterEndpoint');
const {
  ParagraphEndpoint,
} = require('../endpoints/data/query/ParagraphEndpoint');
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
  // CONTENT_SOURCE bleibt bewusst ungesetzt: geprüft wird der Standard.
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

function runEndpoint(EndpointClass, { query = {}, scopes } = {}) {
  const responseObject = {
    json: jest.fn(),
    status: jest.fn(),
    send: jest.fn(),
  };
  const endpoint = new EndpointClass()
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({ query })
    .setResponseObject(responseObject);
  if (scopes) {
    // Die Endpoints erwarten ein Set (`this.scopes?.has('edit')`).
    endpoint.setScopes(new Set(scopes));
  }
  return endpoint.execute().then(() => responseObject.json.mock.calls[0][0]);
}

const getStory = (options) => runEndpoint(SingleStoryEndpoint, options);
const getChapter = (options) => runEndpoint(ChapterEndpoint, options);
const getParagraph = (options) => runEndpoint(ParagraphEndpoint, options);
const getContents = (options) => runEndpoint(ContentsEndpoint, options);

/** Wurde überhaupt gegen Postgres gefragt? */
function queriedDatabase() {
  return executedStatements.length > 0;
}

describe('Lesepfad auf dem neuen Datenmodell', () => {
  describe('Quelle', () => {
    it('fragt node und app_node ab — nicht die alten Tabellen', async () => {
      await getStory({ query: { id: '000s00000000000011' } });

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

    it('löst einen Deep-Link auf die alte Id auf und gibt sie zurück', async () => {
      const story = await getStory({ query: { id: '000s00000000000011' } });

      expect(story.id).toBe('000s00000000000011');
      expect(story.chapters[0].id).toBe('000c00000000000022');
    });
  });

  describe('Cache', () => {
    it('schreibt die Story nach einem Cache-Miss in den Cache', async () => {
      const story = await getStory({ query: { id: '000s00000000000011' } });

      expect(cacheGet).toHaveBeenCalled();
      expect(cacheSet).toHaveBeenCalled();
      const [, cachedValue] = cacheSet.mock.calls[0];
      expect(cachedValue).toEqual(story);
    });

    it('beantwortet den zweiten Aufruf aus dem Cache, ohne erneut abzufragen', async () => {
      const erste = await getStory({ query: { id: '000s00000000000011' } });

      executedStatements = [];
      const zweite = await getStory({ query: { id: '000s00000000000011' } });

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

      await getStory({ query: { id: '000s00000000000011' } });

      const [, cachedValue] = cacheSet.mock.calls[0];
      expect(cachedValue.chapters).toEqual([]);
    });
  });

  describe('App-Zugehörigkeit', () => {
    it('liefert nichts, wenn die Story einer anderen App gehört', async () => {
      rows.appNodes = [
        { node_id: 'n-story', relation: 'include', app_name: FREMDE_APP },
      ];

      expect(await getStory({ query: { id: '000s00000000000011' } })).toEqual(
        {}
      );
    });

    it('erbt die Sichtbarkeit vom Parent, wo der Knoten es zulässt', async () => {
      // Das Kapitel hat keine eigene app_node-Zeile; sichtbar ist es allein,
      // weil `is_parent_controls_visibility` gesetzt ist.
      const chapter = await getChapter({
        query: { id: '000c00000000000022' },
      });

      expect(chapter.id).toBe('000c00000000000022');
    });

    it('liefert nichts, wenn die Vererbungskette unterbrochen ist', async () => {
      rows.nodes = [
        STORY_NODE,
        { ...KAPITEL_NODE, is_parent_controls_visibility: false },
      ];

      expect(await getChapter({ query: { id: '000c00000000000022' } })).toEqual(
        {}
      );
    });
  });

  describe('Publish-Filter', () => {
    it('lässt unveröffentlichte Kapitel aus der Story heraus', async () => {
      const story = await getStory({ query: { id: '000s00000000000011' } });

      expect(story.chapters.map((chapter) => chapter.id)).toEqual([
        '000c00000000000022',
      ]);
    });

    it('liefert mit edit-Scope auch unveröffentlichte Kapitel', async () => {
      const story = await getStory({
        query: { id: '000s00000000000011' },
        scopes: ['edit'],
      });

      expect(story.chapters.map((chapter) => chapter.id)).toEqual([
        '000c00000000000022',
        '000c00000000000023',
      ]);
    });

    it('umgeht mit edit-Scope den Cache', async () => {
      await getStory({ query: { id: '000s00000000000011' }, scopes: ['edit'] });

      expect(cacheGet).not.toHaveBeenCalled();
      expect(queriedDatabase()).toBe(true);
    });

    it('hält einen unveröffentlichten Absatz zurück — anders als früher', async () => {
      // Der alte direkte Absatz-Zugriff kannte gar keinen Publish-Filter.
      rows.content = rows.content.map((row) => ({
        ...row,
        published_date: MORGEN,
      }));

      expect(
        await getParagraph({ query: { id: '000p00000000000033' } })
      ).toEqual({});
    });
  });

  describe('Kapitel und Absatz', () => {
    it('liefert die Absatz-Kopfdaten ohne Inhalt', async () => {
      const chapter = await getChapter({
        query: { id: '000c00000000000022' },
      });

      expect(chapter.paragraphs).toEqual([
        { id: '000p00000000000033', name: 'Absatz 1', sortnumber: 1 },
      ]);
    });

    it('liefert den Absatz mit beiden Repräsentationen', async () => {
      const paragraph = await getParagraph({
        query: { id: '000p00000000000033' },
      });

      expect(paragraph).toEqual({
        id: '000p00000000000033',
        name: 'Absatz 1',
        lastupdate: null,
        content: 'Reiner Text',
        htmlcontent: '<p>Reiner Text</p>',
        sortnumber: 1,
        chapterid: '000c00000000000022',
        storyid: '000s00000000000011',
        publishdate: GESTERN,
      });
    });

    it('liefert htmlcontent nur, wenn die HTML-Fassung die aktive ist', async () => {
      rows.content = rows.content.map((row) => ({
        ...row,
        active_content_item: 'ci-text',
      }));

      const paragraph = await getParagraph({
        query: { id: '000p00000000000033' },
      });

      expect(paragraph.content).toBe('Reiner Text');
      expect(paragraph.htmlcontent).toBeNull();
    });
  });

  describe('Inhaltsbaum', () => {
    it('liefert Stories mit ihren Kapiteln als childnodes', async () => {
      const { result } = await getContents();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('000s00000000000011');
      expect(result[0].childnodes.map((node) => node.id)).toEqual([
        '000c00000000000022',
      ]);
    });

    it('filtert unveröffentlichte Knoten erst bei der Auslieferung', async () => {
      // Der Baum kommt vollständig aus der Datenschicht; ohne edit-Scope
      // entfernt der ContentVisibilityFilter das unveröffentlichte Kapitel,
      // mit edit-Scope bleibt es stehen.
      const { result } = await getContents({ scopes: ['edit'] });

      expect(result[0].childnodes.map((node) => node.id)).toEqual([
        '000c00000000000022',
        '000c00000000000023',
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
