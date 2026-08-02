/**
 * Gemeinsamer Vertrag beider Inhaltsquellen.
 *
 * Dieselben Erwartungen laufen gegen `LegacyContentRepository` und
 * `NodeContentRepository`. Jede Quelle bringt ihre **eigenen** Zeilen mit — die
 * eine aus `story`/`chapter`/`paragraph`, die andere aus
 * `node`/`content_node`/`content_item` — und muss daraus dieselbe Antwort
 * bauen. Solange das für beide gilt, ist die Umschaltung von außen nicht
 * beobachtbar.
 *
 * **Was hier NICHT steht:** alles, was an eine der beiden Implementierungen
 * gebunden ist. Die SQL-Zusicherungen der Charakterisierungstests
 * (`Chapter LEFT JOIN Paragraph ON`, `PublishDate <= NOW()`) beschreiben das
 * Altmodell und können gegen die neue Quelle nie grün werden; sie bleiben dort,
 * wo sie stehen, und verschwinden mit der alten Quelle.
 *
 * Die vier bewussten Abweichungen zwischen den Quellen stehen in
 * `doc/datamodel-overhaul/datamodel.md` („Was sich beim Umschalten sichtbar
 * ändert") — sie sind hier ausgespart, sonst könnte der Vertrag nicht für
 * beide gelten.
 */

const IDS = {
  story: '000s00000000000011',
  chapterA: '000c00000000000022',
  chapterB: '000c00000000000023',
  paragraph: '000p00000000000033',
  unbekannt: '000s99999999999999',
};

const PUBLISHED = '2026-01-01T00:00:00.000Z';

/** Erwartete Antwort auf `getStory` im Szenario „Story mit zwei Kapiteln". */
const EXPECTED_STORY = {
  id: IDS.story,
  name: 'Erste Story',
  lastupdate: null,
  sortnumber: 10,
  publishdate: PUBLISHED,
  coverid: IDS.chapterA,
  chapters: [
    { id: IDS.chapterA, name: 'Kapitel A', sortnumber: 1 },
    { id: IDS.chapterB, name: 'Kapitel B', sortnumber: 2 },
  ],
};

/** Erwartete Antwort auf `getChapter` im Szenario „Kapitel mit einem Absatz". */
const EXPECTED_CHAPTER = {
  id: IDS.chapterA,
  storyid: IDS.story,
  name: 'Kapitel A',
  lastupdate: null,
  sortnumber: 1,
  reversed: true,
  publishdate: PUBLISHED,
  paragraphs: [{ id: IDS.paragraph, name: 'Absatz 1', sortnumber: 1 }],
};

/** Erwartete Antwort auf `getParagraph` mit beiden Repräsentationen. */
const EXPECTED_PARAGRAPH = {
  id: IDS.paragraph,
  name: 'Absatz 1',
  lastupdate: null,
  content: 'Reiner Text',
  htmlcontent: '<p>Reiner Text</p>',
  sortnumber: 1,
  chapterid: IDS.chapterA,
  storyid: IDS.story,
  publishdate: PUBLISHED,
};

/** Erwarteter Inhaltsbaum: eine Story, zwei Kapitel. */
const EXPECTED_TREE = [
  {
    id: IDS.story,
    name: 'Erste Story',
    lastupdate: null,
    sortnumber: 10,
    publishdate: PUBLISHED,
    coverid: IDS.chapterA,
    chapters: [
      {
        id: IDS.chapterA,
        storyid: IDS.story,
        name: 'Kapitel A',
        lastupdate: null,
        sortnumber: 1,
        reversed: true,
        publishdate: PUBLISHED,
      },
      {
        id: IDS.chapterB,
        storyid: IDS.story,
        name: 'Kapitel B',
        lastupdate: null,
        sortnumber: 2,
        reversed: null,
        publishdate: PUBLISHED,
      },
    ],
  },
];

/**
 * @param {object}   options
 * @param {string}   options.name            Name der Quelle (für die Testausgabe)
 * @param {Function} options.createRepository liefert ein fertig konfiguriertes Repository
 * @param {object}   options.seed            installiert je Szenario die Zeilen dieser Quelle
 */
function describeContentRepositoryContract({ name, createRepository, seed }) {
  describe(`Vertrag der Inhaltsquelle: ${name}`, () => {
    describe('getStory', () => {
      it('liefert die Story-Felder und die Kapitel unter chapters[]', async () => {
        seed.storyWithTwoChapters();

        expect(await createRepository().getStory(IDS.story)).toEqual(
          EXPECTED_STORY
        );
      });

      it('liefert je Kapitel nur die Kopfdaten id/name/sortnumber', async () => {
        seed.storyWithTwoChapters();

        const story = await createRepository().getStory(IDS.story);

        expect(Object.keys(story.chapters[0]).sort()).toEqual([
          'id',
          'name',
          'sortnumber',
        ]);
      });

      it('entfernt die App-Zugehörigkeit aus der Antwort', async () => {
        seed.storyWithTwoChapters();

        const story = await createRepository().getStory(IDS.story);

        expect(story).not.toHaveProperty('applicationincluded');
        expect(story).not.toHaveProperty('applicationexcluded');
        expect(story).not.toHaveProperty('app_node');
      });

      it('liefert ein leeres Objekt, wenn nichts gefunden wird', async () => {
        seed.nothingFound();

        expect(await createRepository().getStory(IDS.unbekannt)).toEqual({});
      });
    });

    describe('getChapter', () => {
      it('liefert die Kapitel-Felder und die Absätze unter paragraphs[]', async () => {
        seed.chapterWithOneParagraph();

        expect(await createRepository().getChapter(IDS.chapterA)).toEqual(
          EXPECTED_CHAPTER
        );
      });

      it('liefert je Absatz nur Kopfdaten — insbesondere keinen Inhalt', async () => {
        seed.chapterWithOneParagraph();

        const chapter = await createRepository().getChapter(IDS.chapterA);

        expect(Object.keys(chapter.paragraphs[0]).sort()).toEqual([
          'id',
          'name',
          'sortnumber',
        ]);
        expect(chapter.paragraphs[0]).not.toHaveProperty('content');
        expect(chapter.paragraphs[0]).not.toHaveProperty('htmlcontent');
      });

      it('liefert ein leeres Objekt, wenn nichts gefunden wird', async () => {
        seed.nothingFound();

        expect(await createRepository().getChapter(IDS.unbekannt)).toEqual({});
      });
    });

    describe('getParagraph', () => {
      it('liefert den vollen Datensatz mit beiden Repräsentationen', async () => {
        seed.paragraphWithHtml();

        expect(await createRepository().getParagraph(IDS.paragraph)).toEqual(
          EXPECTED_PARAGRAPH
        );
      });

      it('liefert content und htmlcontent nebeneinander — die Auswahl trifft das Frontend', async () => {
        seed.paragraphWithHtml();

        const paragraph = await createRepository().getParagraph(IDS.paragraph);

        expect(paragraph.content).toBe('Reiner Text');
        expect(paragraph.htmlcontent).toBe('<p>Reiner Text</p>');
      });

      it('liefert ein leeres Objekt, wenn nichts gefunden wird', async () => {
        seed.nothingFound();

        expect(await createRepository().getParagraph(IDS.unbekannt)).toEqual(
          {}
        );
      });
    });

    describe('getContentsTree', () => {
      it('liefert Storys mit ihren Kapiteln unter chapters', async () => {
        seed.contentsTree();

        expect(await createRepository().getContentsTree()).toEqual(
          EXPECTED_TREE
        );
      });

      it('führt publishdate mit, damit der Filter bei der Auslieferung greifen kann', async () => {
        seed.contentsTree();

        const tree = await createRepository().getContentsTree();

        expect(tree[0]).toHaveProperty('publishdate');
        expect(tree[0].chapters[0]).toHaveProperty('publishdate');
      });

      it('entfernt die App-Zugehörigkeit auf der Story-Ebene', async () => {
        seed.contentsTree();

        const tree = await createRepository().getContentsTree();

        expect(tree[0]).not.toHaveProperty('applicationincluded');
      });

      // Die KAPITEL-Ebene ist hier bewusst nicht zugesichert: die alte Quelle
      // räumt dort nicht auf. `DataCleaner.removeApplicationKeysFromObject`
      // löscht nur Schlüssel der obersten Ebene und steigt nicht in
      // `story.chapters` hinab, und `buildContentsTree` hängt die Kapitel schon
      // vorher an. Beim Client kommt das nicht an — der `ContentsEndpoint`
      // mappt über eine Allow-List — wohl aber im Cache. Die neue Quelle liefert
      // die Spalten gar nicht erst mit. Der Unterschied ist damit nicht von
      // außen beobachtbar und gehört nicht in den Vertrag.
    });
  });
}

module.exports = {
  describeContentRepositoryContract,
  IDS,
  PUBLISHED,
};
