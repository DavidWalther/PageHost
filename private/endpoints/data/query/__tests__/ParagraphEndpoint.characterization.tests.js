/**
 * Charakterisierungstests: GET /data/query/paragraph
 *
 * Der einzige Lesepfad, der den vollen Inhalt liefert. Siehe
 * `SingleStoryEndpoint.characterization.tests.js` für Zweck und Schnittebene.
 *
 * Anders als bei Story und Kapitel gibt es hier **keinen** Join: `ActionGet`
 * läuft ohne rechte Tabelle, die Spalten kommen deshalb unaliassiert und
 * kleingeschrieben aus Postgres zurück.
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

const { ParagraphEndpoint } = require('../ParagraphEndpoint');

const APPLICATION_KEY = 'charApp';

function runEndpoint({ id = '000p00000000000033', scopes } = {}) {
  const responseObject = { json: jest.fn() };
  const endpoint = new ParagraphEndpoint()
    .setEnvironment(harness.legacyEnvironment(APPLICATION_KEY))
    .setRequestObject({ query: { id } })
    .setResponseObject(responseObject);
  if (scopes) {
    endpoint.setScopes(scopes);
  }
  return endpoint.execute().then(() => responseObject.json.mock.calls[0][0]);
}

const fullParagraphRow = {
  id: '000p00000000000033',
  name: 'Absatz 1',
  lastupdate: '2026-01-02T00:00:00.000Z',
  content: 'Reiner Text',
  htmlcontent: '<p>Reiner Text</p>',
  sortnumber: 1,
  chapterid: '000c00000000000022',
  storyid: '000s00000000000011',
  publishdate: '2026-01-01T00:00:00.000Z',
  applicationincluded: APPLICATION_KEY,
  applicationexcluded: null,
};

describe('Charakterisierung: GET /data/query/paragraph', () => {
  beforeEach(() => {
    harness.resetHarness();
  });

  describe('Antwortform', () => {
    it('liefert den vollen Datensatz inklusive content und htmlcontent', async () => {
      harness.queueResults([fullParagraphRow]);

      const paragraph = await runEndpoint();

      expect(paragraph).toEqual({
        id: '000p00000000000033',
        name: 'Absatz 1',
        lastupdate: '2026-01-02T00:00:00.000Z',
        content: 'Reiner Text',
        htmlcontent: '<p>Reiner Text</p>',
        sortnumber: 1,
        chapterid: '000c00000000000022',
        storyid: '000s00000000000011',
        publishdate: '2026-01-01T00:00:00.000Z',
      });
    });

    it('liefert beide Repräsentationen nebeneinander — die Auswahl trifft das Frontend', async () => {
      harness.queueResults([fullParagraphRow]);

      const paragraph = await runEndpoint();

      // `custom-paragraph.js` entscheidet über `htmlcontent ? html : text`.
      // Das Backend trifft diese Auswahl nicht, es liefert beide Felder.
      expect(paragraph.content).toBe('Reiner Text');
      expect(paragraph.htmlcontent).toBe('<p>Reiner Text</p>');
    });

    it('entfernt die App-Spalten aus der Antwort', async () => {
      harness.queueResults([fullParagraphRow]);

      const paragraph = await runEndpoint();

      expect(paragraph).not.toHaveProperty('applicationincluded');
      expect(paragraph).not.toHaveProperty('applicationexcluded');
    });

    it('liefert nur den ersten Treffer, wenn die Query mehrere Zeilen liefert', async () => {
      harness.queueResults([
        fullParagraphRow,
        { ...fullParagraphRow, id: '000p00000000000034', name: 'Absatz 2' },
      ]);

      const paragraph = await runEndpoint();

      expect(paragraph.id).toBe('000p00000000000033');
    });

    it('liefert ein leeres Objekt, wenn die Query nichts findet', async () => {
      harness.queueResults([]);

      expect(await runEndpoint()).toEqual({});
    });
  });

  describe('SQL-Bedingungen', () => {
    it('fragt ohne Join ab und selektiert die Spalten unaliassiert', async () => {
      harness.queueResults([]);

      await runEndpoint();
      const sql = harness.lastStatement();

      expect(sql).not.toContain('LEFT JOIN');
      expect(sql).toContain('FROM Paragraph');
      expect(sql).toContain('HtmlContent');
    });

    it('filtert über Id und App-Schlüssel', async () => {
      harness.queueResults([]);

      await runEndpoint();
      const sql = harness.lastStatement();

      expect(sql).toContain(`id = '000p00000000000033'`);
      expect(sql).toContain(
        `applicationIncluded LIKE '%' || '${APPLICATION_KEY}' || '%'`
      );
    });
  });

  describe('Publish-Filter', () => {
    it('FEHLVERHALTEN: der direkte Absatz-Zugriff hat ohne edit-Scope gar keinen Publish-Filter', async () => {
      harness.queueResults([]);

      await runEndpoint();

      // `DataStorage.queryParagraphs` setzt die Publish-Bedingung nur, wenn
      // `this.publishDate` gesetzt ist — im normalen Lesepfad ist sie undefined,
      // also entsteht überhaupt keine Bedingung. Ein unveröffentlichter Absatz
      // wird damit ausgeliefert, sobald seine Id bekannt ist. Über das Kapitel
      // ist er nicht erreichbar (dort filtert die JOIN-ON-Klausel), über den
      // Deep-Link schon.
      // Bewusst als Ist-Zustand festgehalten (siehe EPC/Missed.md) — dieser
      // Test schlägt beim Fix absichtlich um.
      // `PublishDate` steht in der Feldliste, aber in keiner Bedingung.
      expect(harness.lastStatement()).not.toContain('PublishDate <=');
      expect(harness.lastStatement()).toMatch(
        /WHERE \(id = '000p00000000000033' AND \(applicationIncluded/
      );
    });

    it('setzt mit edit-Scope ebenfalls keine Publish-Bedingung', async () => {
      harness.queueResults([]);

      await runEndpoint({ scopes: new Set(['edit']) });

      expect(harness.lastStatement()).not.toContain('PublishDate <=');
    });
  });
});
