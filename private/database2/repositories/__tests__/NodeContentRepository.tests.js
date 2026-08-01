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
  executeParameterizedSql = jest.fn(async (statement) => {
    if (statement.includes('FROM app_node')) return sources.appNodes;
    if (statement.includes('FROM content_node cn')) return sources.content;
    if (statement.includes('FROM content_node')) return sources.contentNodes;
    return sources.nodes;
  });
  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql,
    executeSql: jest.fn(),
  }));
});

function newRepository() {
  return new NodeContentRepository(ENVIRONMENT).setApplicationKey('testApp');
}

describe('NodeContentRepository — Abfragen', () => {
  it('verlangt einen App-Schlüssel', async () => {
    await expect(
      new NodeContentRepository(ENVIRONMENT).getStory('000s1')
    ).rejects.toThrow('Application key is required');
  });

  it('lädt Knoten und Zugehörigkeiten über eine Verbindung und schließt sie danach', async () => {
    await newRepository().getStory('000s00000000000011');

    const calls = executeParameterizedSql.mock.calls;
    expect(calls[0][2]).toBeUndefined();
    expect(calls[1][2]).toEqual({ closeConnection: true });
  });

  it('lädt den Baum nur einmal je Repository', async () => {
    const repository = newRepository();

    await repository.getStory('000s00000000000011');
    await repository.getStory('000s00000000000011');

    const treeQueries = executeParameterizedSql.mock.calls.filter(
      ([statement]) => statement.includes('FROM node')
    );
    expect(treeQueries).toHaveLength(1);
  });

  it('filtert weder nach App noch nach Veröffentlichung in SQL', async () => {
    // Beides entscheidet JavaScript, direkt nach der Abfrage.
    await newRepository().getStory('000s00000000000011');

    executeParameterizedSql.mock.calls.forEach(([statement]) => {
      expect(statement).not.toContain('published_date <=');
      expect(statement).not.toContain('relation =');
    });
  });

  it('bindet Ids als Parameter, statt sie einzusetzen', async () => {
    setSources({ content: [] });

    await newRepository().getParagraph('000p00000000000033');

    const contentCall = executeParameterizedSql.mock.calls.find(([statement]) =>
      statement.includes('FROM content_node cn')
    );
    expect(contentCall[1]).toEqual(['000p00000000000033']);
    expect(contentCall[0]).not.toContain('000p00000000000033');
  });
});

describe('getStory', () => {
  it('liefert die Story-Felder und die Kapitel unter chapters[]', async () => {
    expect(await newRepository().getStory('000s00000000000011')).toEqual({
      id: '000s00000000000011',
      name: 'Erste Story',
      lastupdate: null,
      sortnumber: 10,
      publishdate: '2026-01-01T00:00:00.000Z',
      coverid: '000c00000000000022',
      chapters: [
        { id: '000c00000000000022', name: 'Kapitel A', sortnumber: 1 },
      ],
    });
  });

  it('findet die Story auch über die neue Id', async () => {
    expect((await newRepository().getStory('000n1')).id).toBe(
      '000s00000000000011'
    );
  });

  it('fällt auf die neue Id zurück, wenn es keine alte gibt', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, legacy_id: null, cover_node_id: null }],
    });

    const story = await newRepository().getStory('000n1');

    expect(story.id).toBe('000n1');
    expect(story.coverid).toBeNull();
  });

  it('liefert ein leeres Objekt, wenn die Story für die App nicht sichtbar ist', async () => {
    setSources({ appNodes: [] });

    expect(await newRepository().getStory('000s00000000000011')).toEqual({});
  });

  it('liefert ein leeres Objekt, wenn die Story nicht veröffentlicht ist', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, published_date: null }, CHAPTER_NODE],
    });

    expect(await newRepository().getStory('000s00000000000011')).toEqual({});
  });

  it('lässt unveröffentlichte Kapitel aus chapters[] heraus', async () => {
    setSources({
      nodes: [STORY_NODE, { ...CHAPTER_NODE, published_date: null }],
    });

    expect(
      (await newRepository().getStory('000s00000000000011')).chapters
    ).toEqual([]);
  });

  it('lässt für die App ausgeschlossene Kapitel heraus', async () => {
    setSources({
      appNodes: [
        { node_id: '000n1', relation: 'include', app_name: 'testApp' },
        { node_id: '000n2', relation: 'exclude', app_name: 'testApp' },
      ],
    });

    expect(
      (await newRepository().getStory('000s00000000000011')).chapters
    ).toEqual([]);
  });

  it('sortiert die Kapitel nach sortnumber, bei Gleichstand nach alter Id', async () => {
    setSources({
      nodes: [
        STORY_NODE,
        { ...CHAPTER_NODE, id: '000n4', legacy_id: '000c4', sortnumber: 2 },
        { ...CHAPTER_NODE, id: '000n3', legacy_id: '000c3', sortnumber: 1 },
        { ...CHAPTER_NODE, id: '000n2', legacy_id: '000c2', sortnumber: 1 },
      ],
    });

    const story = await newRepository().getStory('000s00000000000011');

    expect(story.chapters.map((chapter) => chapter.id)).toEqual([
      '000c2',
      '000c3',
      '000c4',
    ]);
  });

  it('sortiert Kapitel ohne sortnumber ans Ende', async () => {
    setSources({
      nodes: [
        STORY_NODE,
        { ...CHAPTER_NODE, id: '000n3', legacy_id: '000c3', sortnumber: null },
        { ...CHAPTER_NODE, id: '000n2', legacy_id: '000c2', sortnumber: 5 },
      ],
    });

    const story = await newRepository().getStory('000s00000000000011');

    expect(story.chapters.map((chapter) => chapter.id)).toEqual([
      '000c2',
      '000c3',
    ]);
  });

  it('lässt leere Kopfdaten-Felder weg, statt sie als null zu liefern', async () => {
    // Das Altmodell baut die Kind-Datensätze mit `if (!row[field]) return;`.
    setSources({
      nodes: [STORY_NODE, { ...CHAPTER_NODE, name: null, sortnumber: 0 }],
    });

    const story = await newRepository().getStory('000s00000000000011');

    expect(Object.keys(story.chapters[0])).toEqual(['id']);
  });

  it('liefert fehlende Werte als null, nicht als undefined', async () => {
    setSources({
      nodes: [
        {
          ...STORY_NODE,
          name: null,
          sortnumber: null,
          cover_node_id: null,
          legacy_id: null,
        },
      ],
    });

    const story = await newRepository().getStory('000n1');

    // undefined verschwindet beim Serialisieren aus der Antwort, null nicht.
    expect(JSON.parse(JSON.stringify(story))).toEqual({
      id: '000n1',
      name: null,
      lastupdate: null,
      sortnumber: null,
      publishdate: '2026-01-01T00:00:00.000Z',
      coverid: null,
      chapters: [],
    });
  });
});

describe('getChapter', () => {
  const contentNode = {
    id: '00cn1',
    name: 'Absatz 1',
    sortnumber: 1,
    legacy_id: '000p00000000000033',
    published_date: '2026-01-01T00:00:00.000Z',
    node_id: '000n2',
  };

  it('liefert die Kapitel-Felder und die Absätze unter paragraphs[]', async () => {
    setSources({ contentNodes: [contentNode] });

    expect(await newRepository().getChapter('000c00000000000022')).toEqual({
      id: '000c00000000000022',
      storyid: '000s00000000000011',
      name: 'Kapitel A',
      lastupdate: null,
      sortnumber: 1,
      reversed: true,
      publishdate: '2026-01-01T00:00:00.000Z',
      paragraphs: [
        { id: '000p00000000000033', name: 'Absatz 1', sortnumber: 1 },
      ],
    });
  });

  it('liefert je Absatz nur Kopfdaten — keinen Inhalt', async () => {
    setSources({ contentNodes: [contentNode] });

    const chapter = await newRepository().getChapter('000c00000000000022');

    expect(Object.keys(chapter.paragraphs[0]).sort()).toEqual([
      'id',
      'name',
      'sortnumber',
    ]);
  });

  it('lässt unveröffentlichte Absätze heraus', async () => {
    setSources({
      contentNodes: [
        contentNode,
        { ...contentNode, id: '00cn2', published_date: null },
      ],
    });

    expect(
      (await newRepository().getChapter('000c00000000000022')).paragraphs
    ).toHaveLength(1);
  });

  it('liefert ein leeres Objekt, wenn das Kapitel nicht sichtbar ist', async () => {
    setSources({
      appNodes: [
        { node_id: '000n1', relation: 'include', app_name: 'testApp' },
        { node_id: '000n2', relation: 'exclude', app_name: 'testApp' },
      ],
    });

    expect(await newRepository().getChapter('000c00000000000022')).toEqual({});
  });

  it('fragt die Absätze gar nicht erst ab, wenn das Kapitel nicht sichtbar ist', async () => {
    setSources({ appNodes: [] });

    await newRepository().getChapter('000c00000000000022');

    const contentQueries = executeParameterizedSql.mock.calls.filter(
      ([statement]) => statement.includes('FROM content_node')
    );
    expect(contentQueries).toHaveLength(0);
  });

  it('liefert ein leeres Objekt für eine unbekannte Id', async () => {
    expect(await newRepository().getChapter('000c99999999999999')).toEqual({});
  });
});

describe('getParagraph', () => {
  const base = {
    id: '00cn1',
    name: 'Absatz 1',
    sortnumber: 1,
    legacy_id: '000p00000000000033',
    published_date: '2026-01-01T00:00:00.000Z',
    node_id: '000n2',
    active_content_item: '00ci2',
  };

  it('setzt content und htmlcontent aus den Items zusammen', async () => {
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

    expect(await newRepository().getParagraph('000p00000000000033')).toEqual({
      id: '000p00000000000033',
      name: 'Absatz 1',
      lastupdate: null,
      content: 'Text',
      htmlcontent: '<p>Text</p>',
      sortnumber: 1,
      chapterid: '000c00000000000022',
      storyid: '000s00000000000011',
      publishdate: '2026-01-01T00:00:00.000Z',
    });
  });

  it('liefert htmlcontent nur, wenn die HTML-Fassung die aktive ist', async () => {
    // Das Frontend entscheidet über `htmlcontent ? html : text`. Zeigt
    // active_content_item auf die Textfassung, darf htmlcontent nicht gefüllt
    // sein — sonst setzt sich die alte implizite Regel gegen den expliziten
    // Zeiger durch.
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

    const paragraph = await newRepository().getParagraph('000p00000000000033');

    expect(paragraph.content).toBe('Text');
    expect(paragraph.htmlcontent).toBeNull();
  });

  it('liefert content und htmlcontent als null, wenn es kein Item gibt', async () => {
    setSources({
      content: [
        { ...base, active_content_item: null, item_id: null, item_type: null },
      ],
    });

    const paragraph = await newRepository().getParagraph('000p00000000000033');

    expect(paragraph.content).toBeNull();
    expect(paragraph.htmlcontent).toBeNull();
  });

  it('liefert ein leeres Objekt, wenn der Knoten des Absatzes nicht sichtbar ist', async () => {
    // ABWEICHUNG VOM ALTMODELL: dort entschieden allein die App-Spalten des
    // Absatzes. Im neuen Modell folgt der Content-Halter seinem Knoten.
    setSources({
      appNodes: [],
      content: [
        { ...base, item_id: '00ci1', item_type: 'text', item_content: 'Text' },
      ],
    });

    expect(await newRepository().getParagraph('000p00000000000033')).toEqual(
      {}
    );
  });

  it('liefert ein leeres Objekt, wenn der Absatz nicht veröffentlicht ist', async () => {
    // ABWEICHUNG VOM ALTMODELL: der direkte Absatz-Zugriff hatte dort gar
    // keinen Publish-Filter.
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

    expect(await newRepository().getParagraph('000p00000000000033')).toEqual(
      {}
    );
  });

  it('liefert ein leeres Objekt für eine unbekannte Id', async () => {
    expect(await newRepository().getParagraph('000p99999999999999')).toEqual(
      {}
    );
  });
});

describe('Publish-Filter', () => {
  it('liefert ohne Vorgabe nur Veröffentlichtes', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, published_date: '2099-01-01T00:00:00.000Z' }],
    });

    expect(await newRepository().getStory('000s00000000000011')).toEqual({});
  });

  it('liefert mit null auch Unveröffentlichtes (edit-Scope)', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, published_date: null }, CHAPTER_NODE],
    });

    const story = await newRepository()
      .setPublishDate(null)
      .getStory('000s00000000000011');

    expect(story.id).toBe('000s00000000000011');
    expect(story.chapters).toHaveLength(1);
  });

  it('vergleicht gegen ein vorgegebenes Datum', async () => {
    setSources({
      nodes: [{ ...STORY_NODE, published_date: '2026-06-01T00:00:00.000Z' }],
    });

    const repository = () =>
      new NodeContentRepository(ENVIRONMENT).setApplicationKey('testApp');

    expect(
      await repository().setPublishDate('2026-01-01').getStory('000n1')
    ).toEqual({});
    expect(
      (await repository().setPublishDate('2026-12-01').getStory('000n1')).id
    ).toBe('000s00000000000011');
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
