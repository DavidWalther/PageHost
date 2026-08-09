/**
 * Integrationstests der typfreien Endpunkte `/data/query/node` und
 * `/data/query/content`.
 *
 * Echt sind Factory, Endpunkt-Logik, `DataFacade` und `NodeContentRepository`;
 * gemockt ist nur externes I/O (`pgConnector`, `DataCache2`, Logging). Geprüft
 * wird, was ein Client tatsächlich bekommt — nicht, wie es intern entsteht.
 *
 * Die alten Routen laufen daneben weiter; dass sie das tun und dass sich beide
 * Formen nicht in die Quere kommen, ist hier mit festgehalten.
 */

jest.mock('../database2/DataStorage/pgConnector.js');
jest.mock('../database2/DataCache/DataCache.js');
jest.mock('../modules/logging');

const { PostgresActions } = require('../database2/DataStorage/pgConnector.js');
const { DataCache2 } = require('../database2/DataCache/DataCache.js');
const { DataQueryLogicFactory } = require('../endpoints/DataQueryLogicFactory');
const {
  TypeFreeQueryEndpoint,
} = require('../endpoints/data/query/TypeFreeQueryEndpoint');
const {
  FallbackEndpoint,
} = require('../endpoints/data/query/FallbackEndpoint');

const APPLICATION_KEY = 'nodeApp';
const GESTERN = '2020-01-01T00:00:00.000Z';
const MORGEN = '2999-01-01T00:00:00.000Z';

const ENVIRONMENT = Object.freeze({
  APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
  CACHE_KEY_PREFIX: 'TEST',
  CACHE_DATA_INCREMENT: '1',
  CACHE_CONTAINER_EXPIRATION_SECONDS: 60,
});

// ─── Zeilen des neuen Modells ───────────────────────────────────────────────

const WURZEL = {
  id: 'n-wurzel',
  name: 'Wurzel',
  description: 'Eine Beschreibung',
  sortnumber: 1,
  reversed: null,
  parent_node_id: null,
  cover_node_id: 'n-kind',
  legacy_id: '000s00000000000011',
  published_date: GESTERN,
  is_parent_controls_visibility: false,
};
const KIND = {
  id: 'n-kind',
  name: 'Kind',
  description: null,
  sortnumber: 1,
  reversed: true,
  parent_node_id: 'n-wurzel',
  cover_node_id: null,
  legacy_id: '000c00000000000022',
  published_date: GESTERN,
  is_parent_controls_visibility: true,
};
const KIND_UNVEROEFFENTLICHT = {
  ...KIND,
  id: 'n-kind-morgen',
  name: 'Kind B',
  sortnumber: 2,
  legacy_id: '000c00000000000023',
  published_date: MORGEN,
};

const INHALT = {
  id: 'cn-inhalt',
  name: 'Inhalt 1',
  sortnumber: 1,
  legacy_id: '000p00000000000033',
  published_date: GESTERN,
  node_id: 'n-kind',
  active_content_item: 'ci-html',
};

let rows;
let executedStatements;
let cacheStore;
let cacheGet;
let cacheSet;

beforeEach(() => {
  executedStatements = [];
  cacheStore = new Map();
  rows = {
    nodes: [WURZEL, KIND, KIND_UNVEROEFFENTLICHT],
    appNodes: [
      { node_id: 'n-wurzel', relation: 'include', app_name: APPLICATION_KEY },
    ],
    contentNodes: [INHALT],
    content: [
      {
        ...INHALT,
        item_id: 'ci-text',
        item_type: 'text',
        item_content: 'Reiner Text',
      },
      {
        ...INHALT,
        item_id: 'ci-html',
        item_type: 'html',
        item_content: '<p>Reiner Text</p>',
      },
    ],
  };

  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql: jest.fn(async (statement, parameters = []) => {
      executedStatements.push(statement);
      if (statement.includes('FROM app_node')) return rows.appNodes;
      // Beide Inhalts-Abfragen sind gebunden; der Mock bildet das nach, sonst
      // fände auch eine unbekannte Id einen Treffer.
      if (statement.includes('FROM content_node cn')) {
        return rows.content.filter(
          (row) => row.id === parameters[0] || row.legacy_id === parameters[0]
        );
      }
      if (statement.includes('FROM content_node')) {
        return rows.contentNodes.filter((row) => row.node_id === parameters[0]);
      }
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

/** Geht durch die Factory, damit auch die Routenwahl mitgeprüft wird. */
function request(path, { query = {}, scopes } = {}) {
  const responseObject = {
    json: jest.fn(),
    status: jest.fn(),
    send: jest.fn(),
  };
  const requestObject = { url: `/data/query/${path}`, params: [path], query };
  const endpoint = DataQueryLogicFactory.getProduct(requestObject)
    .setEnvironment(ENVIRONMENT)
    .setRequestObject(requestObject)
    .setResponseObject(responseObject);
  if (scopes) {
    endpoint.setScopes(new Set(scopes));
  }
  return endpoint.execute().then(() => responseObject.json.mock.calls[0][0]);
}

const getNode = (options) => request('node', options);
const getContent = (options) => request('content', options);

describe('Routenwahl', () => {
  it('bedient /data/query/node und /data/query/content mit derselben Logik', () => {
    ['node', 'content'].forEach((table) => {
      const endpoint = DataQueryLogicFactory.getProduct({
        url: `/data/query/${table}`,
        params: [table],
        query: {},
      });

      expect(endpoint).toBeInstanceOf(TypeFreeQueryEndpoint);
      expect(endpoint.table).toBe(table);
    });
  });

  it('kennt die alten Namen nicht mehr', () => {
    // `story`, `chapter` und `paragraph` sind mit dem alten Datenmodell
    // weggefallen und landen jetzt im Fallback wie jeder unbekannte Name.
    ['story', 'chapter', 'paragraph'].forEach((name) => {
      const endpoint = DataQueryLogicFactory.getProduct({
        url: `/data/query/${name}`,
        params: [name],
        query: { id: '000s00000000000011' },
      });

      expect(endpoint).toBeInstanceOf(FallbackEndpoint);
    });
  });

  it('landet für einen unbekannten Namen weiterhin im Fallback', () => {
    const unbekannt = DataQueryLogicFactory.getProduct({
      url: '/data/query/knoten',
      params: ['knoten'],
      query: {},
    });

    expect(unbekannt).toBeInstanceOf(FallbackEndpoint);
  });

  it('nennt die Route im Klassennamen für die Protokollzeile', () => {
    expect(new TypeFreeQueryEndpoint('node').getClassName()).toBe(
      'TypeFreeQueryEndpoint(node)'
    );
  });

  it('weist eine Tabelle zurück, die es in dieser Form nicht gibt', () => {
    expect(() => new TypeFreeQueryEndpoint('story')).toThrow(
      'Unknown type-free table'
    );
  });
});

describe('GET /data/query/node', () => {
  it('liefert den Knoten mit seiner neuen Id', async () => {
    const node = await getNode({ query: { id: 'n-wurzel' } });

    expect(node.id).toBe('n-wurzel');
    expect(node.legacy_id).toBe('000s00000000000011');
    expect(node.description).toBe('Eine Beschreibung');
  });

  it('nimmt einen alten Deep-Link entgegen', async () => {
    const node = await getNode({ query: { id: '000s00000000000011' } });

    expect(node.id).toBe('n-wurzel');
  });

  it('liefert Kind-Knoten und Inhalte in einer Antwort', async () => {
    const wurzel = await getNode({ query: { id: 'n-wurzel' } });
    const kind = await getNode({ query: { id: 'n-kind' } });

    expect(wurzel.nodes.map((child) => child.id)).toEqual(['n-kind']);
    expect(wurzel.contents).toEqual([]);
    expect(kind.nodes).toEqual([]);
    expect(kind.contents.map((content) => content.id)).toEqual(['cn-inhalt']);
  });

  it('lässt unveröffentlichte Kinder heraus', async () => {
    const wurzel = await getNode({ query: { id: 'n-wurzel' } });

    expect(wurzel.nodes.map((child) => child.name)).not.toContain('Kind B');
  });

  it('liefert ein leeres Objekt für eine unbekannte Id', async () => {
    expect(await getNode({ query: { id: 'n-gibtesnicht' } })).toEqual({});
  });

  it('fragt die alten Tabellen nicht an', async () => {
    await getNode({ query: { id: 'n-wurzel' } });

    expect(executedStatements.some((sql) => /FROM Story/i.test(sql))).toBe(
      false
    );
  });
});

describe('GET /data/query/content', () => {
  it('liefert alle Repräsentationen und benennt die aktive', async () => {
    const content = await getContent({ query: { id: 'cn-inhalt' } });

    expect(content.items).toEqual([
      { id: 'ci-text', type: 'text', content: 'Reiner Text' },
      { id: 'ci-html', type: 'html', content: '<p>Reiner Text</p>' },
    ]);
    expect(content.active_type).toBe('html');
  });

  it('nennt den Knoten, an dem der Inhalt hängt', async () => {
    const content = await getContent({ query: { id: 'cn-inhalt' } });

    expect(content.node_id).toBe('n-kind');
  });

  it('nimmt einen alten Deep-Link entgegen', async () => {
    const content = await getContent({ query: { id: '000p00000000000033' } });

    expect(content.id).toBe('cn-inhalt');
  });

  it('liefert ein leeres Objekt für eine unbekannte Id', async () => {
    expect(await getContent({ query: { id: 'cn-gibtesnicht' } })).toEqual({});
  });
});

describe('Cache', () => {
  it('beantwortet den zweiten Aufruf ohne erneute Abfrage', async () => {
    const erste = await getNode({ query: { id: 'n-wurzel' } });

    executedStatements = [];
    const zweite = await getNode({ query: { id: 'n-wurzel' } });

    expect(zweite).toEqual(erste);
    expect(executedStatements).toEqual([]);
  });

  it('hält Knoten und Inhalt derselben Id auseinander', async () => {
    // Der Grund für den Marker im Schlüssel: ein Knoten und ein Inhalt dürfen
    // sich einen Eintrag nicht teilen, auch wenn dieselbe Id angefragt wird.
    await getNode({ query: { id: '000s00000000000011' } });
    await getContent({ query: { id: '000s00000000000011' } });

    expect([...cacheStore.keys()]).toEqual([
      'node:000s00000000000011',
      'content:000s00000000000011',
    ]);
  });

  it('legt einen für die App unsichtbaren Knoten gar nicht erst ab', async () => {
    rows.appNodes = [];

    await getNode({ query: { id: 'n-wurzel' } });

    expect(cacheSet).toHaveBeenCalledWith('node:n-wurzel', {});
  });
});

describe('Edit-Scope', () => {
  it('liefert auch unveröffentlichte Kinder', async () => {
    const wurzel = await getNode({
      query: { id: 'n-wurzel' },
      scopes: ['edit'],
    });

    expect(wurzel.nodes.map((child) => child.name)).toEqual(['Kind', 'Kind B']);
  });

  it('liefert einen unveröffentlichten Inhalt', async () => {
    rows.content = rows.content.map((row) => ({
      ...row,
      published_date: MORGEN,
    }));

    const ohne = await getContent({ query: { id: 'cn-inhalt' } });
    const mit = await getContent({
      query: { id: 'cn-inhalt' },
      scopes: ['edit'],
    });

    expect(ohne).toEqual({});
    expect(mit.id).toBe('cn-inhalt');
  });

  it('umgeht den Cache, statt den Bearbeitungsstand abzulegen', async () => {
    await getNode({ query: { id: 'n-wurzel' }, scopes: ['edit'] });

    expect(cacheGet).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('setzt die App-Grenze nicht aus', async () => {
    // Der Scope hebt den Publish-Filter auf, nicht die Zugehörigkeit — die
    // wird vor dem Cache aufgelöst und kennt keine Scopes.
    rows.appNodes = [];

    const node = await getNode({
      query: { id: 'n-wurzel' },
      scopes: ['edit'],
    });

    expect(node).toEqual({});
  });

  it('ändert ohne edit-Scope nichts', async () => {
    const ohne = await getNode({ query: { id: 'n-wurzel' }, scopes: ['read'] });

    expect(ohne.nodes.map((child) => child.name)).toEqual(['Kind']);
  });
});
