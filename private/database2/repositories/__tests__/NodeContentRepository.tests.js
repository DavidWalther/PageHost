const { PostgresActions } = require('../../DataStorage/pgConnector.js');
const { NodeContentRepository } = require('../NodeContentRepository.js');

// Unit-Test mit gemocktem Connector. Die Abfragen holen nur noch Rohdaten;
// Sichtbarkeit und Publish-Filter entscheidet JavaScript und ist damit hier
// vollständig prüfbar — die Auflösungsregel selbst hat ihre eigenen Tests in
// `private/modules/__tests__/NodeVisibility.tests.js`.
jest.mock('../../DataStorage/pgConnector.js');
jest.mock('../../../modules/logging');

const ENVIRONMENT = { APPLICATION_APPLICATION_KEY: 'testApp' };

const STORY_NODE = {
  id: '000n1',
  name: 'Erste Story',
  sortnumber: 10,
  reversed: null,
  parent_node_id: null,
  cover_node_id: '000n2',
  legacy_id: '000s00000000000011',
  published_date: '2026-01-01T00:00:00.000Z',
  is_parent_controls_visibility: null,
};
const CHAPTER_NODE = {
  id: '000n2',
  name: 'Kapitel A',
  sortnumber: 1,
  reversed: true,
  parent_node_id: '000n1',
  cover_node_id: null,
  legacy_id: '000c00000000000022',
  published_date: '2026-01-01T00:00:00.000Z',
  is_parent_controls_visibility: true,
};

let executeParameterizedSql;
let sources;

function setSources(overrides = {}) {
  sources = {
    nodes: [STORY_NODE, CHAPTER_NODE],
    appNodes: [{ node_id: '000n1', relation: 'include', app_name: 'testApp' }],
    contentNodes: [],
    content: [],
    ...overrides,
  };
}

beforeEach(() => {
  setSources();
  executeParameterizedSql = jest.fn(async (statement, parameters = []) => {
    if (statement.includes('FROM app_node')) return sources.appNodes;
    if (statement.includes('FROM content_node cn')) return sources.content;
    // Die Abfrage der Inhalts-Kopfdaten hängt an genau einem Knoten
    // (`WHERE node_id = $1`). Der Mock bildet das nach, sonst bekäme jeder
    // Knoten die Inhalte aller anderen mit.
    if (statement.includes('FROM content_node')) {
      return sources.contentNodes.filter(
        (row) => row.node_id === parameters[0]
      );
    }
    return sources.nodes;
  });
  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql,
  }));
});

function newRepository() {
  return new NodeContentRepository(ENVIRONMENT).setApplicationKey('testApp');
}

describe('NodeContentRepository — Abfragen', () => {
  it('verlangt einen App-Schlüssel', async () => {
    await expect(
      new NodeContentRepository(ENVIRONMENT).getNode('000n1')
    ).rejects.toThrow('Application key is required');
  });

  it('reicht keine Verbindungs-Option mit', async () => {
    // Der Pool ist prozessweit und darf von einer einzelnen Anfrage nicht
    // beendet werden.
    await newRepository().getNode('000n1');

    executeParameterizedSql.mock.calls.forEach(([, , options]) => {
      expect(options).toBeUndefined();
    });
  });

  describe('Kosten eines Lesevorgangs', () => {
    // Regressionswächter. Der Absatz-Abruf war einmal doppelt so teuer wie
    // nötig, weil `loadVisibility` und die Inhalts-Abfrage sich je einen
    // eigenen Zugang holten. Die Zahl der Abfragen ist dabei die stabilere
    // Zusicherung als die Zahl der Verbindungen — sie bleibt aussagekräftig,
    // auch wenn der Pool geteilt wird.

    /** Welche Abfragen sind gelaufen, in Reihenfolge? */
    function issuedQueries() {
      return executeParameterizedSql.mock.calls.map(([statement]) => {
        if (statement.includes('FROM app_node')) return 'app_node';
        if (statement.includes('FROM content_node cn')) return 'content';
        if (statement.includes('FROM content_node')) return 'content_nodes';
        return 'node';
      });
    }

    it('getContent kommt mit einem Zugang und drei Abfragen aus', async () => {
      await newRepository().getContent('000p00000000000033');

      expect(PostgresActions).toHaveBeenCalledTimes(1);
      expect(issuedQueries()).toEqual(['node', 'app_node', 'content']);
    });

    it('getNode kommt mit einem Zugang und drei Abfragen aus', async () => {
      await newRepository().getNode('000n1');

      expect(PostgresActions).toHaveBeenCalledTimes(1);
      expect(issuedQueries()).toEqual(['node', 'app_node', 'content_nodes']);
    });

    it('getContentsTree kommt mit einem Zugang und zwei Abfragen aus', async () => {
      await newRepository().getContentsTree();

      expect(PostgresActions).toHaveBeenCalledTimes(1);
      expect(issuedQueries()).toEqual(['node', 'app_node']);
    });

    it('ein zweiter Lesevorgang holt weder Zugang noch Baum erneut', async () => {
      const repository = newRepository();

      await repository.getNode('000n1');
      await repository.getContent('000p00000000000033');

      expect(PostgresActions).toHaveBeenCalledTimes(1);
      expect(issuedQueries()).toEqual([
        'node',
        'app_node',
        'content_nodes',
        'content',
      ]);
    });

    it('fragt für einen unsichtbaren Knoten gar nicht erst weiter', async () => {
      setSources({ appNodes: [] });

      await newRepository().getNode('000n1');

      expect(issuedQueries()).toEqual(['node', 'app_node']);
    });
  });

  it('lädt den Baum nur einmal je Repository', async () => {
    const repository = newRepository();

    await repository.getNode('000n1');
    await repository.getNode('000n1');

    const treeQueries = executeParameterizedSql.mock.calls.filter(
      ([statement]) => statement.includes('FROM node')
    );
    expect(treeQueries).toHaveLength(1);
  });

  it('filtert weder nach App noch nach Veröffentlichung in SQL', async () => {
    // Beides entscheidet JavaScript, direkt nach der Abfrage.
    await newRepository().getNode('000n1');

    executeParameterizedSql.mock.calls.forEach(([statement]) => {
      expect(statement).not.toContain('published_date <=');
      expect(statement).not.toContain('relation =');
    });
  });

  it('bindet Ids als Parameter, statt sie einzusetzen', async () => {
    setSources({ content: [] });

    await newRepository().getContent('000p00000000000033');

    const contentCall = executeParameterizedSql.mock.calls.find(([statement]) =>
      statement.includes('FROM content_node cn')
    );
    expect(contentCall[1]).toEqual(['000p00000000000033']);
    expect(contentCall[0]).not.toContain('000p00000000000033');
  });
});

describe('Publish-Filter', () => {
  it('liefert ohne Vorgabe nur Veröffentlichtes', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, published_date: '2099-01-01T00:00:00.000Z' }],
    });

    expect(await newRepository().getNode('000n1')).toEqual({});
  });

  it('liefert mit null auch Unveröffentlichtes (edit-Scope)', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, published_date: null }, CHAPTER_NODE],
    });

    const node = await newRepository().setPublishDate(null).getNode('000n1');

    expect(node.id).toBe('000n1');
    expect(node.nodes).toHaveLength(1);
  });

  it('vergleicht gegen ein vorgegebenes Datum', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, published_date: '2026-06-01T00:00:00.000Z' }],
    });

    const repository = () =>
      new NodeContentRepository(ENVIRONMENT).setApplicationKey('testApp');

    expect(
      await repository().setPublishDate('2026-01-01').getNode('000n1')
    ).toEqual({});
    expect(
      (await repository().setPublishDate('2026-12-01').getNode('000n1')).id
    ).toBe('000n1');
  });
});

describe('getContentsTree', () => {
  it('liefert Wurzelknoten mit ihren Kindern unter nodes', async () => {
    expect(await newRepository().getContentsTree()).toEqual([
      {
        id: '000n1',
        legacy_id: '000s00000000000011',
        name: 'Erste Story',
        description: null,
        sortnumber: 10,
        reversed: null,
        parent_node_id: null,
        cover_node_id: '000n2',
        published_date: '2026-01-01T00:00:00.000Z',
        nodes: [
          {
            id: '000n2',
            legacy_id: '000c00000000000022',
            name: 'Kapitel A',
            description: null,
            sortnumber: 1,
            reversed: true,
            parent_node_id: '000n1',
            cover_node_id: null,
            published_date: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    ]);
  });

  it('behält unveröffentlichte Knoten im Baum', async () => {
    // Der Publish-Filter läuft erst bei der Auslieferung
    // (ContentVisibilityFilter) — sonst wäre derselbe Baum nicht mehr für
    // sitemap.xml verwendbar. Genauso hält es das Altmodell.
    setSources({
      nodes: [
        { ...STORY_NODE, published_date: null },
        { ...CHAPTER_NODE, published_date: null },
      ],
    });

    const tree = await newRepository().getContentsTree();

    expect(tree).toHaveLength(1);
    expect(tree[0].published_date).toBeNull();
    expect(tree[0].nodes).toHaveLength(1);
  });

  it('lässt für die App unsichtbare Knoten heraus', async () => {
    setSources({
      appNodes: [
        { node_id: '000n1', relation: 'include', app_name: 'testApp' },
        { node_id: '000n2', relation: 'exclude', app_name: 'testApp' },
      ],
    });

    expect((await newRepository().getContentsTree())[0].nodes).toEqual([]);
  });

  it('sortiert beide Ebenen nach sortnumber', async () => {
    setSources({
      nodes: [
        { ...STORY_NODE, id: '000n9', legacy_id: '000s9', sortnumber: 20 },
        STORY_NODE,
        { ...CHAPTER_NODE, id: '000n3', legacy_id: '000c3', sortnumber: 2 },
        { ...CHAPTER_NODE, id: '000n2', legacy_id: '000c2', sortnumber: 1 },
      ],
      appNodes: [
        { node_id: '000n1', relation: 'include', app_name: 'testApp' },
        { node_id: '000n9', relation: 'include', app_name: 'testApp' },
      ],
    });

    const tree = await newRepository().getContentsTree();

    expect(tree.map((root) => root.id)).toEqual(['000n1', '000n9']);
    expect(tree[0].nodes.map((child) => child.id)).toEqual(['000n2', '000n3']);
  });

  it('lässt Enkel weg — geliefert werden zwei Ebenen', async () => {
    setSources({
      nodes: [
        STORY_NODE,
        CHAPTER_NODE,
        {
          ...CHAPTER_NODE,
          id: '000n3',
          legacy_id: '000c3',
          parent_node_id: '000n2',
        },
      ],
    });

    const tree = await newRepository().getContentsTree();

    expect(tree[0].nodes.map((child) => child.id)).toEqual(['000n2']);
  });

  it('liefert einen leeren Baum, wenn nichts sichtbar ist', async () => {
    setSources({ appNodes: [] });

    expect(await newRepository().getContentsTree()).toEqual([]);
  });

  it('führt published_date mit, damit der ContentVisibilityFilter greifen kann', async () => {
    const tree = await newRepository().getContentsTree();

    expect(tree[0]).toHaveProperty('published_date');
    expect(tree[0].nodes[0]).toHaveProperty('published_date');
  });
});

describe('queryVisibleNodes', () => {
  it('liefert die sichtbaren Knoten ungefiltert nach published_date', async () => {
    // Der Inhaltsbaum braucht auch die unveröffentlichten Knoten: der
    // Publish-Filter läuft dort erst bei der Auslieferung.
    setSources({
      nodes: [STORY_NODE, { ...CHAPTER_NODE, published_date: null }],
    });

    const nodes = await newRepository().queryVisibleNodes();

    expect(nodes.map((node) => node.id)).toEqual(['000n1', '000n2']);
  });

  it('lässt für die App unsichtbare Knoten heraus', async () => {
    setSources({ appNodes: [] });

    expect(await newRepository().queryVisibleNodes()).toEqual([]);
  });
});

// ─── Typfreie Antwortform ──────────────────────────────────────────────────

describe('getNode', () => {
  const CONTENT_HEAD = {
    id: '00cn1',
    name: 'Absatz 1',
    sortnumber: 1,
    legacy_id: '000p00000000000033',
    published_date: '2026-01-01T00:00:00.000Z',
    node_id: '000n2',
  };

  it('liefert den Knoten mit neuer Id und der alten daneben', async () => {
    // Der Unterschied zu getStory/getChapter: die Identität ist ab hier die
    // neue Id. Die alte bleibt als Feld erhalten, damit ein Deep-Link von
    // früher noch auflösbar ist — sie ist aber nicht mehr der Schlüssel.
    const node = await newRepository().getNode('000n1');

    expect(node.id).toBe('000n1');
    expect(node.legacy_id).toBe('000s00000000000011');
  });

  it('nimmt auch die alte Id entgegen', async () => {
    const node = await newRepository().getNode('000s00000000000011');

    expect(node.id).toBe('000n1');
  });

  it('liefert Kind-Knoten und Inhalts-Kopfdaten nebeneinander', async () => {
    setSources({ contentNodes: [CONTENT_HEAD] });

    const node = await newRepository().getNode('000n1');

    expect(node.nodes.map((child) => child.id)).toEqual(['000n2']);
    expect(node.contents).toEqual([]);
  });

  it('liefert für einen Knoten mit Inhalten dieselbe Form', async () => {
    // Story und Kapitel unterscheiden sich nur darin, welche der beiden Listen
    // gefüllt ist — genau das ist der Sinn der typfreien Antwort.
    setSources({ contentNodes: [CONTENT_HEAD] });

    const node = await newRepository().getNode('000n2');

    expect(node.nodes).toEqual([]);
    expect(node.contents).toEqual([
      {
        id: '00cn1',
        legacy_id: '000p00000000000033',
        name: 'Absatz 1',
        sortnumber: 1,
        published_date: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('benennt die Felder wie das neue Modell', async () => {
    const node = await newRepository().getNode('000n2');

    expect(node).toMatchObject({
      parent_node_id: '000n1',
      published_date: '2026-01-01T00:00:00.000Z',
      reversed: true,
      description: null,
    });
    expect(node.publishdate).toBeUndefined();
    expect(node.storyid).toBeUndefined();
  });

  it('lässt fehlende Werte als null stehen, statt sie wegzulassen', async () => {
    // Die alte Form ließ leere Felder ganz weg (Eigenheit von DataStorage).
    // Hier ist jeder Schlüssel vorhanden — der Client kann sich darauf stützen.
    const node = await newRepository().getNode('000n1');

    expect(Object.keys(node).sort()).toEqual([
      'contents',
      'cover_node_id',
      'description',
      'id',
      'legacy_id',
      'name',
      'nodes',
      'parent_node_id',
      'published_date',
      'reversed',
      'sortnumber',
    ]);
  });

  it('lässt unveröffentlichte Kind-Knoten heraus', async () => {
    setSources({
      nodes: [STORY_NODE, { ...CHAPTER_NODE, published_date: null }],
    });

    const node = await newRepository().getNode('000n1');

    expect(node.nodes).toEqual([]);
  });

  it('lässt unveröffentlichte Inhalte heraus', async () => {
    setSources({
      contentNodes: [{ ...CONTENT_HEAD, published_date: null }],
    });

    const node = await newRepository().getNode('000n2');

    expect(node.contents).toEqual([]);
  });

  it('liefert ein leeres Objekt für einen unsichtbaren Knoten', async () => {
    setSources({ appNodes: [] });

    expect(await newRepository().getNode('000n1')).toEqual({});
  });

  it('liefert ein leeres Objekt für eine unbekannte Id', async () => {
    expect(await newRepository().getNode('000n99')).toEqual({});
  });
});

describe('getContent', () => {
  const base = {
    id: '00cn1',
    name: 'Absatz 1',
    sortnumber: 1,
    legacy_id: '000p00000000000033',
    published_date: '2026-01-01T00:00:00.000Z',
    node_id: '000n2',
    active_content_item: '00ci2',
  };

  it('liefert alle Repräsentationen statt zweier fester Felder', async () => {
    setSources({
      content: [
        { ...base, item_id: '00ci1', item_type: 'text', item_content: 'Text' },
        {
          ...base,
          item_id: '00ci2',
          item_type: 'html',
          item_content: '<p>Text</p>',
        },
      ],
    });

    expect(await newRepository().getContent('00cn1')).toEqual({
      id: '00cn1',
      legacy_id: '000p00000000000033',
      name: 'Absatz 1',
      sortnumber: 1,
      published_date: '2026-01-01T00:00:00.000Z',
      node_id: '000n2',
      active_content_item: '00ci2',
      active_type: 'html',
      items: [
        { id: '00ci1', type: 'text', content: 'Text' },
        { id: '00ci2', type: 'html', content: '<p>Text</p>' },
      ],
    });
  });

  it('benennt die aktive Fassung, statt sie auszuwählen', async () => {
    // getParagraph hat die Auswahl selbst getroffen und nur das Ergebnis
    // geliefert. Hier bekommt der Client beide Fassungen und den Zeiger.
    setSources({
      content: [
        {
          ...base,
          active_content_item: '00ci1',
          item_id: '00ci1',
          item_type: 'text',
          item_content: 'Text',
        },
        {
          ...base,
          active_content_item: '00ci1',
          item_id: '00ci2',
          item_type: 'html',
          item_content: '<p>Text</p>',
        },
      ],
    });

    const content = await newRepository().getContent('00cn1');

    expect(content.active_type).toBe('text');
    expect(content.items).toHaveLength(2);
  });

  it('liefert eine leere Item-Liste, wenn es keine Repräsentation gibt', async () => {
    setSources({
      content: [
        { ...base, active_content_item: null, item_id: null, item_type: null },
      ],
    });

    const content = await newRepository().getContent('00cn1');

    expect(content.items).toEqual([]);
    expect(content.active_type).toBeNull();
    expect(content.active_content_item).toBeNull();
  });

  it('nimmt auch die alte Id entgegen', async () => {
    setSources({
      content: [
        { ...base, item_id: '00ci1', item_type: 'text', item_content: 'Text' },
      ],
    });

    const content = await newRepository().getContent('000p00000000000033');

    expect(content.id).toBe('00cn1');
  });

  it('folgt der Sichtbarkeit seines Knotens', async () => {
    setSources({
      appNodes: [],
      content: [
        { ...base, item_id: '00ci1', item_type: 'text', item_content: 'Text' },
      ],
    });

    expect(await newRepository().getContent('00cn1')).toEqual({});
  });

  it('liefert ein leeres Objekt, wenn der Inhalt nicht veröffentlicht ist', async () => {
    setSources({
      content: [
        {
          ...base,
          published_date: null,
          item_id: '00ci1',
          item_type: 'text',
          item_content: 'Text',
        },
      ],
    });

    expect(await newRepository().getContent('00cn1')).toEqual({});
  });

  it('liefert ein leeres Objekt für eine unbekannte Id', async () => {
    expect(await newRepository().getContent('00cn99')).toEqual({});
  });
});
