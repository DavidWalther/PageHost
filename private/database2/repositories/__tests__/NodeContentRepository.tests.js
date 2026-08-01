const { PostgresActions } = require('../../DataStorage/pgConnector.js');
const {
  NodeContentRepository,
  VISIBLE_NODES_SQL,
} = require('../NodeContentRepository.js');

// Unit-Test mit gemocktem Connector. Was er prüfen kann, ist die Form des
// Aufrufs — nicht, ob die Auflösungsregel stimmt: die lebt in SQL und wurde
// gegen eine echte Postgres-Instanz mit den Testdaten aus
// `doc/datamodel-overhaul/testModel_createAndTearDown.txt` verifiziert. Die
// Erwartungswerte daraus stehen unten als Dokumentation.
jest.mock('../../DataStorage/pgConnector.js');
jest.mock('../../../modules/logging');

const ENVIRONMENT = { APPLICATION_APPLICATION_KEY: 'testApp' };

let executeParameterizedSql;

beforeEach(() => {
  executeParameterizedSql = jest.fn().mockResolvedValue([]);
  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql,
    executeSql: jest.fn(),
  }));
});

function newRepository() {
  return new NodeContentRepository(ENVIRONMENT).setApplicationKey('testApp');
}

describe('NodeContentRepository.queryVisibleNodes', () => {
  it('verlangt einen App-Schlüssel', async () => {
    await expect(
      new NodeContentRepository(ENVIRONMENT).queryVisibleNodes()
    ).rejects.toThrow('Application key is required');
  });

  it('bindet den App-Schlüssel als Parameter, statt ihn einzusetzen', async () => {
    await newRepository().queryVisibleNodes();

    const [statement, parameters] = executeParameterizedSql.mock.calls[0];
    expect(parameters).toEqual(['testApp']);
    expect(statement).toContain('$1');
    expect(statement).not.toContain('testApp');
  });

  it('schließt die Verbindung nach der Abfrage', async () => {
    await newRepository().queryVisibleNodes();

    expect(executeParameterizedSql.mock.calls[0][2]).toEqual({
      closeConnection: true,
    });
  });

  it('reicht die Zeilen unverändert durch', async () => {
    const rows = [{ id: '000n1', name: 'Wurzel', depth: 1 }];
    executeParameterizedSql.mockResolvedValue(rows);

    expect(await newRepository().queryVisibleNodes()).toBe(rows);
  });
});

describe('getStory', () => {
  const storyRow = {
    id: '000n1',
    name: 'Erste Story',
    sortnumber: 10,
    legacy_id: '000s00000000000011',
    published_date: '2026-01-01T00:00:00.000Z',
    cover_id: '000n2',
    cover_legacy_id: '000c00000000000022',
    is_target: true,
  };
  const chapterRow = {
    id: '000n2',
    name: 'Kapitel A',
    sortnumber: 1,
    legacy_id: '000c00000000000022',
    is_target: false,
  };

  it('liefert die Story-Felder und die Kapitel unter chapters[]', async () => {
    executeParameterizedSql.mockResolvedValue([storyRow, chapterRow]);

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

  it('gibt nach außen die alte Id zurück, nicht die neue', async () => {
    executeParameterizedSql.mockResolvedValue([storyRow]);

    const story = await newRepository().getStory('000s00000000000011');

    expect(story.id).toBe('000s00000000000011');
    expect(story.coverid).toBe('000c00000000000022');
  });

  it('fällt auf die neue Id zurück, wenn es keine alte gibt', async () => {
    executeParameterizedSql.mockResolvedValue([
      { ...storyRow, legacy_id: null, cover_legacy_id: null },
    ]);

    const story = await newRepository().getStory('000n1');

    expect(story.id).toBe('000n1');
    expect(story.coverid).toBe('000n2');
  });

  it('liefert ein leeres Objekt, wenn der Zielknoten nicht sichtbar ist', async () => {
    // Die Sortierung stellt den Zielknoten nach vorn. Steht er nicht dort, war
    // er nicht dabei — dann dürfen auch seine Kinder nicht ausgeliefert werden.
    executeParameterizedSql.mockResolvedValue([chapterRow]);

    expect(await newRepository().getStory('000s00000000000011')).toEqual({});
  });

  it('liefert ein leeres Objekt ohne Treffer', async () => {
    executeParameterizedSql.mockResolvedValue([]);

    expect(await newRepository().getStory('000s1')).toEqual({});
  });

  it('lässt leere Kopfdaten-Felder weg, statt sie als null zu liefern', async () => {
    // Das Altmodell baut die Kind-Datensätze mit `if (!row[field]) return;`.
    executeParameterizedSql.mockResolvedValue([
      storyRow,
      { ...chapterRow, sortnumber: 0, name: null },
    ]);

    const story = await newRepository().getStory('000s00000000000011');

    expect(Object.keys(story.chapters[0])).toEqual(['id']);
  });

  it('liefert fehlende Werte als null, nicht als undefined', async () => {
    executeParameterizedSql.mockResolvedValue([
      {
        id: '000n1',
        legacy_id: null,
        name: null,
        sortnumber: null,
        published_date: null,
        cover_id: null,
        cover_legacy_id: null,
        is_target: true,
      },
    ]);

    const story = await newRepository().getStory('000n1');

    // undefined verschwindet beim Serialisieren aus der Antwort, null nicht.
    expect(JSON.parse(JSON.stringify(story))).toEqual({
      id: '000n1',
      name: null,
      lastupdate: null,
      sortnumber: null,
      publishdate: null,
      coverid: null,
      chapters: [],
    });
  });
});

describe('getChapter', () => {
  const row = (content = {}) => ({
    id: '000n2',
    name: 'Kapitel A',
    sortnumber: 3,
    reversed: true,
    legacy_id: '000c00000000000022',
    published_date: '2026-01-01T00:00:00.000Z',
    parent_id: '000n1',
    parent_legacy_id: '000s00000000000011',
    ...content,
  });

  it('liefert die Kapitel-Felder und die Absätze unter paragraphs[]', async () => {
    executeParameterizedSql.mockResolvedValue([
      row({
        content_id: '00cn1',
        content_legacy_id: '000p00000000000033',
        content_name: 'Absatz 1',
        content_sortnumber: 1,
      }),
      row({
        content_id: '00cn2',
        content_legacy_id: '000p00000000000034',
        content_name: 'Absatz 2',
        content_sortnumber: 2,
      }),
    ]);

    expect(await newRepository().getChapter('000c00000000000022')).toEqual({
      id: '000c00000000000022',
      storyid: '000s00000000000011',
      name: 'Kapitel A',
      lastupdate: null,
      sortnumber: 3,
      reversed: true,
      publishdate: '2026-01-01T00:00:00.000Z',
      paragraphs: [
        { id: '000p00000000000033', name: 'Absatz 1', sortnumber: 1 },
        { id: '000p00000000000034', name: 'Absatz 2', sortnumber: 2 },
      ],
    });
  });

  it('liefert je Absatz nur Kopfdaten — keinen Inhalt', async () => {
    executeParameterizedSql.mockResolvedValue([
      row({
        content_id: '00cn1',
        content_legacy_id: '000p1',
        content_name: 'Absatz',
        content_sortnumber: 1,
      }),
    ]);

    const chapter = await newRepository().getChapter('000c1');

    expect(Object.keys(chapter.paragraphs[0]).sort()).toEqual([
      'id',
      'name',
      'sortnumber',
    ]);
  });

  it('macht aus der leeren Zeile eines Kapitels ohne Absätze keinen Absatz', async () => {
    // Der LEFT JOIN liefert genau eine Zeile mit leeren content_-Spalten.
    executeParameterizedSql.mockResolvedValue([row()]);

    expect((await newRepository().getChapter('000c1')).paragraphs).toEqual([]);
  });

  it('liefert ein leeres Objekt ohne Treffer', async () => {
    executeParameterizedSql.mockResolvedValue([]);

    expect(await newRepository().getChapter('000c1')).toEqual({});
  });
});

describe('getParagraph', () => {
  const base = {
    id: '00cn1',
    name: 'Absatz 1',
    sortnumber: 1,
    legacy_id: '000p00000000000033',
    published_date: '2026-01-01T00:00:00.000Z',
    chapter_id: '000n2',
    chapter_legacy_id: '000c00000000000022',
    story_id: '000n1',
    story_legacy_id: '000s00000000000011',
    active_content_item: '00ci2',
  };

  it('setzt content und htmlcontent aus den Items zusammen', async () => {
    executeParameterizedSql.mockResolvedValue([
      { ...base, item_id: '00ci1', item_type: 'text', item_content: 'Text' },
      {
        ...base,
        item_id: '00ci2',
        item_type: 'html',
        item_content: '<p>Text</p>',
      },
    ]);

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
    executeParameterizedSql.mockResolvedValue([
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
    ]);

    const paragraph = await newRepository().getParagraph('000p1');

    expect(paragraph.content).toBe('Text');
    expect(paragraph.htmlcontent).toBeNull();
  });

  it('liefert content und htmlcontent als null, wenn es kein Item gibt', async () => {
    executeParameterizedSql.mockResolvedValue([
      { ...base, active_content_item: null, item_id: null, item_type: null },
    ]);

    const paragraph = await newRepository().getParagraph('000p1');

    expect(paragraph.content).toBeNull();
    expect(paragraph.htmlcontent).toBeNull();
  });

  it('liefert ein leeres Objekt ohne Treffer', async () => {
    executeParameterizedSql.mockResolvedValue([]);

    expect(await newRepository().getParagraph('000p1')).toEqual({});
  });
});

describe('Publish-Filter in den Abfragen', () => {
  async function statementFor(publishDate) {
    const repository = newRepository();
    if (publishDate !== undefined) {
      repository.setPublishDate(publishDate);
    }
    executeParameterizedSql.mockResolvedValue([]);
    await repository.getStory('000s1');
    return executeParameterizedSql.mock.calls[0];
  }

  it('vergleicht ohne Vorgabe gegen NOW() — auch bei der Story', async () => {
    const [statement] = await statementFor(undefined);

    // Bewusste Abweichung: das Altmodell vergleicht im Story-Pfad gegen
    // Mitternacht des heutigen Tages und im Kapitel-Pfad gegen NOW().
    expect(statement).toContain('n.published_date <= NOW()');
  });

  it('lässt den Filter bei null ganz weg (edit-Scope)', async () => {
    const [statement] = await statementFor(null);

    expect(statement).not.toContain('published_date <=');
    expect(statement).toContain('AND TRUE');
  });

  it('bindet ein vorgegebenes Datum als Parameter', async () => {
    const [statement, parameters] = await statementFor('2026-01-01');

    expect(statement).toContain('n.published_date <= $3');
    expect(parameters).toEqual(['testApp', '000s1', '2026-01-01']);
    expect(statement).not.toContain('2026-01-01');
  });

  it('bindet ein Datum auch dann nur einmal, wenn es zweimal geprüft wird', async () => {
    const repository = newRepository().setPublishDate('2026-01-01');
    executeParameterizedSql.mockResolvedValue([]);

    await repository.getChapter('000c1');
    const [statement, parameters] = executeParameterizedSql.mock.calls[0];

    // Kapitel und Absätze werden beide gefiltert, der Parameter existiert
    // trotzdem nur einmal.
    expect(parameters).toHaveLength(3);
    expect(statement).toContain('cn.published_date <= $3');
    expect(statement).toContain('n.published_date <= $3');
  });
});

describe('Id-Auflösung', () => {
  it('akzeptiert die alte wie die neue Id', async () => {
    executeParameterizedSql.mockResolvedValue([]);

    await newRepository().getStory('000s00000000000011');

    expect(executeParameterizedSql.mock.calls[0][0]).toContain(
      'n.legacy_id = $2 OR n.id = $2'
    );
  });

  it('bindet die Id, statt sie einzusetzen', async () => {
    executeParameterizedSql.mockResolvedValue([]);

    await newRepository().getParagraph('000p00000000000033');

    const [statement, parameters] = executeParameterizedSql.mock.calls[0];
    expect(parameters).toContain('000p00000000000033');
    expect(statement).not.toContain('000p00000000000033');
  });
});

describe('VISIBLE_NODES_SQL', () => {
  it('läuft rekursiv über parent_node_id', () => {
    expect(VISIBLE_NODES_SQL).toContain('WITH RECURSIVE');
    expect(VISIBLE_NODES_SQL).toContain('c.parent_node_id = t.id');
  });

  it('führt den Zyklus-Schutz mit — inklusive des nötigen Casts', () => {
    // Ohne den Cast hat der nicht-rekursive Term varchar(18)[], der rekursive
    // varchar[]; Postgres lehnt die Abfrage dann rundheraus ab.
    expect(VISIBLE_NODES_SQL).toContain('ARRAY[f.id]::varchar[]');
    expect(VISIBLE_NODES_SQL).toContain('NOT c.id = ANY(t.path)');
  });

  it('behandelt Wildcard-Zeilen (app_id IS NULL) als für jede App gültig', () => {
    expect(VISIBLE_NODES_SQL).toContain(
      'an.app_id IS NULL OR an.app_id = (SELECT id FROM target_app)'
    );
  });

  it('setzt exclude über include und Vererbung', () => {
    expect(VISIBLE_NODES_SQL).toContain(
      '((c.included OR (c.inherits AND t.member)) AND NOT c.excluded)'
    );
  });

  it('filtert NICHT nach published_date', () => {
    // Der Publish-Filter läuft erst bei der Auslieferung
    // (ContentVisibilityFilter) — sonst wäre derselbe Baum nicht mehr für
    // sitemap.xml verwendbar. Genauso hält es das Altmodell.
    expect(VISIBLE_NODES_SQL).not.toContain('published_date <');
    expect(VISIBLE_NODES_SQL).not.toContain('published_date IS NOT NULL');
  });

  it('behandelt fehlendes is_parent_controls_visibility als false', () => {
    expect(VISIBLE_NODES_SQL).toContain(
      'COALESCE(n.is_parent_controls_visibility, false)'
    );
  });
});

/**
 * Gegen Postgres verifiziert (2026-08-01), Testdaten aus
 * `doc/datamodel-overhaul/testModel_createAndTearDown.txt`. Deckt jede Zeile der
 * Wahrheitstabelle aus `datamodel.md` Abschnitt 4 ab:
 *
 *   testAppA      -> root, cover, branch, leaf, appAOnly, hiddenInB   (6)
 *   testAppB      -> root, cover, branch, leaf                        (4)
 *   unbekannt     -> root, cover, branch, leaf, hiddenInB             (5)
 *
 * Die Ableitungen im Einzelnen:
 * - `root` haengt per include-Wildcard drin  -> in jeder App, auch unbekannter
 * - `cover` erbt und ist unveroeffentlicht   -> hier trotzdem sichtbar; das
 *   Publish-Tor der Wahrheitstabelle wirkt erst bei der Auslieferung
 * - `leaf` liegt auf Ebene 3                 -> Vererbung reicht beliebig tief
 * - `appAOnly` bricht die Kette (false) und haengt per include an A
 *                                            -> nur in A, nicht in B, nicht bei
 *                                               unbekanntem Schluessel
 * - `hiddenInB` erbt, hat aber exclude fuer B -> ueberall ausser in B
 *
 * Ebenfalls gemessen: ein Zyklus (branch <-> leaf) bringt die Abfrage NICHT zum
 * Haengen — beide Knoten samt Teilbaum fehlen still im Ergebnis.
 */
