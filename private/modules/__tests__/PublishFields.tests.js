const { PublishFields } = require('../PublishFields.js');

describe('PublishFields.incomingFieldFor', () => {
  it('schreibt bei den alten Namen in publishDate', () => {
    ['story', 'chapter', 'paragraph'].forEach((object) => {
      expect(PublishFields.incomingFieldFor(object)).toBe('publishDate');
    });
  });

  it('schreibt bei den typfreien Namen in published_date', () => {
    ['node', 'content'].forEach((object) => {
      expect(PublishFields.incomingFieldFor(object)).toBe('published_date');
    });
  });

  it('ist unabhängig von der Groß-/Kleinschreibung des Objekts', () => {
    expect(PublishFields.incomingFieldFor('Chapter')).toBe('publishDate');
  });

  it('wirft bei einem Objekt, das nicht veröffentlicht werden kann', () => {
    expect(() => PublishFields.incomingFieldFor('identity')).toThrow(
      'has no publish field'
    );
  });
});

describe('PublishFields.valueOf', () => {
  it('liest das Datum aus der alten Antwortform', () => {
    expect(PublishFields.valueOf({ publishdate: '2026-01-01' })).toBe(
      '2026-01-01'
    );
  });

  it('liest das Datum aus der neuen Antwortform', () => {
    expect(PublishFields.valueOf({ published_date: '2026-01-01' })).toBe(
      '2026-01-01'
    );
  });

  it('liefert null, wenn kein Datum gesetzt ist', () => {
    expect(PublishFields.valueOf({ id: 'x' })).toBeNull();
    expect(PublishFields.valueOf({ publishdate: null })).toBeNull();
    expect(PublishFields.valueOf(null)).toBeNull();
  });

  it('fällt nicht auf camelCase herein', () => {
    // Genau daran scheiterte die Prüfung „ist schon veröffentlicht?": das
    // Feld heißt in keiner der beiden Antwortformen `publishDate`.
    expect(PublishFields.valueOf({ publishDate: '2026-01-01' })).toBeNull();
  });
});
