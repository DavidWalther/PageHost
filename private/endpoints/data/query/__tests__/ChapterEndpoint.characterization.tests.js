/**
 * Charakterisierungstests: GET /data/query/chapter
 *
 * Siehe `SingleStoryEndpoint.characterization.tests.js` für Zweck und
 * Schnittebene des Harness.
 */

const harness = require('../../../../testSupport/readPathHarness');

jest.mock('../../../../database2/DataStorage/pgConnector.js', () => ({
  PostgresActions: require('../../../../testSupport/readPathHarness')
    .PostgresActionsMock,
}));
jest.mock('../../../../database2/DataCache/DataCache.js', () => ({
  DataCache2: require('../../../../testSupport/readPathHarness').DataCache2Mock,
}));
jest.mock('../../../../modules/logging');

const { ChapterEndpoint } = require('../ChapterEndpoint');

const APPLICATION_KEY = 'charApp';

function runEndpoint({ id = '000c00000000000022', scopes } = {}) {
  const responseObject = { json: jest.fn() };
  const endpoint = new ChapterEndpoint()
    .setEnvironment({ APPLICATION_APPLICATION_KEY: APPLICATION_KEY })
    .setRequestObject({ query: { id } })
    .setResponseObject(responseObject);
  if (scopes) {
    endpoint.setScopes(scopes);
  }
  return endpoint.execute().then(() => responseObject.json.mock.calls[0][0]);
}

describe('Charakterisierung: GET /data/query/chapter', () => {
  beforeEach(() => {
    harness.resetHarness();
  });

  describe('Antwortform', () => {
    it('liefert die Kapitel-Felder kleingeschrieben und die Absätze unter paragraphs[]', async () => {
      harness.queueResults([
        harness.chapterJoinParagraphRow({
          chapter: {
            Id: '000c00000000000022',
            StoryId: '000s00000000000011',
            Name: 'Kapitel A',
            SortNumber: 3,
            reversed: true,
            PublishDate: '2026-01-01T00:00:00.000Z',
          },
          paragraph: {
            Id: '000p00000000000033',
            Name: 'Absatz 1',
            SortNumber: 1,
          },
        }),
        harness.chapterJoinParagraphRow({
          chapter: { Id: '000c00000000000022', Name: 'Kapitel A' },
          paragraph: {
            Id: '000p00000000000034',
            Name: 'Absatz 2',
            SortNumber: 2,
          },
        }),
      ]);

      const chapter = await runEndpoint();

      expect(chapter).toEqual({
        id: '000c00000000000022',
        storyid: '000s00000000000011',
        name: 'Kapitel A',
        lastupdate: undefined,
        sortnumber: 3,
        reversed: true,
        publishdate: '2026-01-01T00:00:00.000Z',
        paragraphs: [
          { id: '000p00000000000033', name: 'Absatz 1', sortnumber: 1 },
          { id: '000p00000000000034', name: 'Absatz 2', sortnumber: 2 },
        ],
      });
    });

    it('liefert je Absatz nur die Kopfdaten id/name/sortnumber — insbesondere keinen Inhalt', async () => {
      harness.queueResults([
        harness.chapterJoinParagraphRow({
          chapter: { Id: '000c00000000000022', Name: 'Kapitel' },
          paragraph: {
            Id: '000p00000000000033',
            Name: 'Absatz',
            SortNumber: 1,
          },
        }),
      ]);

      const chapter = await runEndpoint();

      expect(Object.keys(chapter.paragraphs[0]).sort()).toEqual([
        'id',
        'name',
        'sortnumber',
      ]);
      expect(chapter.paragraphs[0]).not.toHaveProperty('content');
      expect(chapter.paragraphs[0]).not.toHaveProperty('htmlcontent');
    });

    it('entfernt die App-Spalten aus der Antwort', async () => {
      harness.queueResults([
        harness.chapterJoinParagraphRow({
          chapter: {
            Id: '000c00000000000022',
            Name: 'Kapitel',
            applicationincluded: APPLICATION_KEY,
            applicationexcluded: 'andereApp',
          },
        }),
      ]);

      const chapter = await runEndpoint();

      expect(chapter).not.toHaveProperty('applicationincluded');
      expect(chapter).not.toHaveProperty('applicationexcluded');
    });

    it('liefert ein leeres Objekt, wenn die Query nichts findet', async () => {
      harness.queueResults([]);

      expect(await runEndpoint()).toEqual({});
    });
  });

  describe('SQL-Bedingungen', () => {
    it('joint Kapitel auf Absätze und filtert beide Seiten über den App-Schlüssel', async () => {
      harness.queueResults([]);

      await runEndpoint();
      const sql = harness.lastStatement();

      expect(sql).toContain('Chapter LEFT JOIN Paragraph ON');
      expect(sql).toContain(
        `Chapter.applicationIncluded LIKE '%' || '${APPLICATION_KEY}' || '%'`
      );
      expect(sql).toContain(
        `Paragraph.applicationIncluded LIKE '%' || '${APPLICATION_KEY}' || '%'`
      );
    });

    it('sortiert die Absätze aufsteigend nach SortNumber', async () => {
      harness.queueResults([]);

      await runEndpoint();

      expect(harness.lastStatement()).toMatch(/ORDER BY .*SortNumber ASC/i);
    });
  });

  describe('Publish-Filter', () => {
    it('vergleicht ohne edit-Scope gegen NOW() — anders als der Story-Pfad, der gegen Mitternacht des heutigen Tages vergleicht', async () => {
      harness.queueResults([]);

      await runEndpoint();

      // `DataStorage.queryChapter` ruft `setConditionPublishDate()` ohne
      // Argument (undefined -> NOW()), während `queryStory` das heutige Datum
      // übergibt und damit auf '<heute> 00:00:00' vergleicht. Ein heute früher
      // veröffentlichtes Kapitel ist deshalb sofort sichtbar, eine heute
      // veröffentlichte Story erst am Folgetag. Ist-Zustand, hier festgehalten.
      expect(harness.lastStatement()).toContain('PublishDate <= NOW()');
    });

    it('lässt den Publish-Filter mit edit-Scope vollständig weg', async () => {
      harness.queueResults([]);

      await runEndpoint({ scopes: new Set(['edit']) });

      expect(harness.lastStatement()).not.toContain('PublishDate <=');
    });
  });
});
