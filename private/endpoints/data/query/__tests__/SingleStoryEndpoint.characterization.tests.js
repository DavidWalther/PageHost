/**
 * Charakterisierungstests: GET /data/query/story
 *
 * Halten den heutigen Ist-Zustand der Antwort fest. Sie sind der Vertrag, gegen
 * den eine spätere zweite Datenquelle antreten muss — solange sie grün sind,
 * ist ein Wechsel der Quelle von außen nicht beobachtbar.
 *
 * Gemockt ist nur externes I/O (Postgres, Redis, Logging); `DataFacade`,
 * `DataStorage` und die SQL-Erzeugung laufen echt.
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

const { SingleStoryEndpoint } = require('../SingleStoryEndpoint');

const APPLICATION_KEY = 'charApp';

function runEndpoint({ id = '000s00000000000011', scopes } = {}) {
  const responseObject = { json: jest.fn() };
  const endpoint = new SingleStoryEndpoint()
    .setEnvironment(harness.legacyEnvironment(APPLICATION_KEY))
    .setRequestObject({ query: { id } })
    .setResponseObject(responseObject);
  if (scopes) {
    endpoint.setScopes(scopes);
  }
  return endpoint.execute().then(() => responseObject.json.mock.calls[0][0]);
}

describe('Charakterisierung: GET /data/query/story', () => {
  beforeEach(() => {
    harness.resetHarness();
  });

  describe('Antwortform', () => {
    it('liefert die Story-Felder kleingeschrieben und die Kapitel unter chapters[]', async () => {
      harness.queueResults([
        harness.storyJoinChapterRow({
          story: {
            Id: '000s00000000000011',
            Name: 'Erste Story',
            SortNumber: 10,
            PublishDate: '2026-01-01T00:00:00.000Z',
            coverId: '000c00000000000022',
          },
          chapter: {
            Id: '000c00000000000022',
            Name: 'Kapitel A',
            SortNumber: 1,
          },
        }),
        harness.storyJoinChapterRow({
          story: { Id: '000s00000000000011', Name: 'Erste Story' },
          chapter: {
            Id: '000c00000000000023',
            Name: 'Kapitel B',
            SortNumber: 2,
          },
        }),
      ]);

      const story = await runEndpoint();

      expect(story).toEqual({
        id: '000s00000000000011',
        name: 'Erste Story',
        lastupdate: undefined,
        sortnumber: 10,
        publishdate: '2026-01-01T00:00:00.000Z',
        coverid: '000c00000000000022',
        chapters: [
          { id: '000c00000000000022', name: 'Kapitel A', sortnumber: 1 },
          { id: '000c00000000000023', name: 'Kapitel B', sortnumber: 2 },
        ],
      });
    });

    it('liefert je Kapitel nur die Kopfdaten id/name/sortnumber', async () => {
      harness.queueResults([
        harness.storyJoinChapterRow({
          story: { Id: '000s00000000000011', Name: 'Story' },
          chapter: { Id: '000c00000000000022', Name: 'Kapitel', SortNumber: 1 },
        }),
      ]);

      const story = await runEndpoint();

      expect(Object.keys(story.chapters[0]).sort()).toEqual([
        'id',
        'name',
        'sortnumber',
      ]);
    });

    it('entfernt die App-Spalten aus der Antwort', async () => {
      harness.queueResults([
        harness.storyJoinChapterRow({
          story: {
            Id: '000s00000000000011',
            Name: 'Story',
            applicationincluded: APPLICATION_KEY,
            applicationexcluded: 'andereApp',
          },
        }),
      ]);

      const story = await runEndpoint();

      expect(story).not.toHaveProperty('applicationincluded');
      expect(story).not.toHaveProperty('applicationexcluded');
    });

    it('liefert ein leeres Objekt, wenn die Query nichts findet', async () => {
      harness.queueResults([]);

      const story = await runEndpoint();

      expect(story).toEqual({});
    });
  });

  describe('SQL-Bedingungen', () => {
    it('filtert die linke Tabelle über den App-Schlüssel inklusive Wildcard', async () => {
      harness.queueResults([]);

      await runEndpoint();
      const sql = harness.lastStatement();

      expect(sql).toContain(
        `applicationIncluded LIKE '%' || '${APPLICATION_KEY}' || '%'`
      );
      expect(sql).toContain(`applicationIncluded = '*'`);
      expect(sql).toContain(`applicationExcluded isNull`);
    });

    it('hängt die Bedingungen der rechten Tabelle an die JOIN-ON-Klausel', async () => {
      harness.queueResults([]);

      await runEndpoint();
      const sql = harness.lastStatement();

      expect(sql).toContain('Story LEFT JOIN Chapter ON');
      expect(sql).toContain(
        `Chapter.applicationIncluded LIKE '%' || '${APPLICATION_KEY}' || '%'`
      );
      expect(sql).toContain('Chapter.PublishDate <=');
    });

    it('sortiert die Kapitel aufsteigend nach SortNumber', async () => {
      harness.queueResults([]);

      await runEndpoint();

      expect(harness.lastStatement()).toContain('ORDER BY');
      expect(harness.lastStatement()).toMatch(/SortNumber ASC/i);
    });
  });

  describe('Edit-Scope', () => {
    it('setzt ohne edit-Scope einen Publish-Filter', async () => {
      harness.queueResults([]);

      await runEndpoint();

      expect(harness.lastStatement()).toContain('PublishDate <=');
    });

    it('vergleicht gegen Mitternacht des heutigen Tages, nicht gegen NOW()', async () => {
      harness.queueResults([]);

      await runEndpoint();

      // `DataStorage.queryStory` übergibt `new Date().toISOString().split('T')[0]`,
      // also das reine Datum — daraus wird '<heute> 00:00:00'. Der Kapitel-Pfad
      // vergleicht dagegen gegen NOW() (siehe ChapterEndpoint-Charakterisierung).
      // Eine heute um 09:00 veröffentlichte Story ist deshalb erst am Folgetag
      // sichtbar, ihre gleichzeitig veröffentlichten Kapitel sofort.
      // Ist-Zustand, hier bewusst festgehalten.
      expect(harness.lastStatement()).toMatch(
        /PublishDate <= '\d{4}-\d{2}-\d{2} 00:00:00'/
      );
      expect(harness.lastStatement()).not.toContain(
        'Story.PublishDate <= NOW()'
      );
    });

    it('lässt den Publish-Filter mit edit-Scope vollständig weg', async () => {
      harness.queueResults([]);

      await runEndpoint({ scopes: new Set(['edit']) });

      // `PublishDate` steht weiterhin in der Feldliste — es darf nur keine
      // Bedingung mehr daraus werden, weder links noch in der JOIN-ON-Klausel.
      expect(harness.lastStatement()).not.toContain('PublishDate <=');
    });

    it('liefert mit edit-Scope dieselbe Antwortform wie ohne', async () => {
      const row = harness.storyJoinChapterRow({
        story: { Id: '000s00000000000011', Name: 'Story' },
        chapter: { Id: '000c00000000000022', Name: 'Kapitel', SortNumber: 1 },
      });
      harness.queueResults([row]);

      const story = await runEndpoint({ scopes: new Set(['edit']) });

      expect(story.id).toBe('000s00000000000011');
      expect(story.chapters).toEqual([
        { id: '000c00000000000022', name: 'Kapitel', sortnumber: 1 },
      ]);
    });
  });
});
