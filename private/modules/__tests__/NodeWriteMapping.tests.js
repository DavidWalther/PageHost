const { NodeWriteMapping } = require('../NodeWriteMapping.js');

describe('NodeWriteMapping', () => {
  describe('Objektart', () => {
    it('erkennt Story und Kapitel als Knoten', () => {
      expect(NodeWriteMapping.isNodeObject('story')).toBe(true);
      expect(NodeWriteMapping.isNodeObject('chapter')).toBe(true);
    });

    it('erkennt den Absatz nicht als Knoten — er ist ein Inhalt', () => {
      expect(NodeWriteMapping.isNodeObject('paragraph')).toBe(false);
    });

    it('liefert die alten Präfixe, an denen das Frontend den Typ liest', () => {
      expect(NodeWriteMapping.legacyPrefix('story')).toBe('000s');
      expect(NodeWriteMapping.legacyPrefix('chapter')).toBe('000c');
      expect(NodeWriteMapping.legacyPrefix('paragraph')).toBe('000p');
    });

    it('wirft bei unbekanntem Objekt', () => {
      expect(() => NodeWriteMapping.legacyPrefix('node')).toThrow(
        'Unknown object type'
      );
    });
  });

  describe('columnsFor — Schreibweise', () => {
    it('bildet die camelCase-Namen der Editierkomponenten ab', () => {
      const columns = NodeWriteMapping.columnsFor('chapter', {
        id: '000c00000000000022',
        storyId: '000s00000000000011',
        name: 'Kapitel A',
        sortNumber: 3,
        reversed: true,
        publishDate: '2026-01-01T00:00:00.000Z',
      });

      expect(columns).toEqual({
        parent_node_id: '000s00000000000011',
        name: 'Kapitel A',
        sortnumber: 3,
        reversed: true,
        published_date: '2026-01-01T00:00:00.000Z',
      });
    });

    it('bildet die kleingeschriebenen Namen des gelesenen Datensatzes ab', () => {
      // Der Absatz schickt zurück, was er gelesen hat — durchgehend klein.
      const columns = NodeWriteMapping.columnsFor('paragraph', {
        id: '000p00000000000033',
        name: 'Absatz 1',
        sortnumber: 2,
        chapterid: '000c00000000000022',
        storyid: '000s00000000000011',
        publishdate: null,
      });

      expect(columns).toEqual({
        name: 'Absatz 1',
        sortnumber: 2,
        node_id: '000c00000000000022',
        published_date: null,
      });
    });
  });

  describe('columnsFor — was nicht geschrieben wird', () => {
    it('lässt die Id fallen: sie ist die Identität, kein Wert', () => {
      const columns = NodeWriteMapping.columnsFor('story', {
        id: '000s00000000000011',
        name: 'Story',
      });

      expect(columns).toEqual({ name: 'Story' });
    });

    it('lässt lastupdate fallen — die Spalte gibt es nicht mehr', () => {
      const columns = NodeWriteMapping.columnsFor('story', {
        name: 'Story',
        lastUpdate: '2026-01-01',
      });

      expect(columns).toEqual({ name: 'Story' });
    });

    it('lässt die App-Spalten fallen — daraus wird eine app_node-Zeile', () => {
      const columns = NodeWriteMapping.columnsFor('story', {
        name: 'Story',
        applicationincluded: 'meineApp',
        applicationexcluded: null,
      });

      expect(columns).toEqual({ name: 'Story' });
    });

    it('lässt storyid beim Absatz fallen — die Story hängt am Kapitel', () => {
      const columns = NodeWriteMapping.columnsFor('paragraph', {
        storyId: '000s00000000000011',
        chapterId: '000c00000000000022',
      });

      expect(columns).toEqual({ node_id: '000c00000000000022' });
    });

    it('schreibt storyid beim Kapitel dagegen als parent_node_id', () => {
      const columns = NodeWriteMapping.columnsFor('chapter', {
        storyId: '000s00000000000011',
      });

      expect(columns).toEqual({ parent_node_id: '000s00000000000011' });
    });

    it('lässt content und htmlcontent fallen — eigene Zeilen in content_item', () => {
      const columns = NodeWriteMapping.columnsFor('paragraph', {
        name: 'Absatz',
        content: 'Text',
        htmlContent: '<p>Text</p>',
      });

      expect(columns).toEqual({ name: 'Absatz' });
    });

    it('wirft bei einem unbekannten Feld, statt es zu schlucken', () => {
      // Ein Tippfehler soll auffallen und nicht als verschwundene Änderung enden.
      expect(() =>
        NodeWriteMapping.columnsFor('story', { sortnumbr: 1 })
      ).toThrow('Field "sortnumbr" cannot be written');
    });

    it('wirft, wenn ein Feld zum Objekt nicht passt', () => {
      // `reversed` gibt es am Kapitel, nicht an der Story.
      expect(() =>
        NodeWriteMapping.columnsFor('story', { reversed: true })
      ).toThrow('Field "reversed" cannot be written');
    });
  });

  describe('referenceColumns', () => {
    it('benennt die Spalten, deren Wert erst aufgelöst werden muss', () => {
      const columns = NodeWriteMapping.columnsFor('chapter', {
        storyId: '000s00000000000011',
        coverId: '000c00000000000022',
        name: 'Kapitel',
      });

      expect(NodeWriteMapping.referenceColumns(columns).sort()).toEqual([
        'cover_node_id',
        'parent_node_id',
      ]);
    });

    it('meldet nichts, wenn keine Referenz im Payload steckt', () => {
      const columns = NodeWriteMapping.columnsFor('story', { name: 'Story' });

      expect(NodeWriteMapping.referenceColumns(columns)).toEqual([]);
    });
  });

  describe('contentItemsFor', () => {
    it('trennt Text und HTML und macht HTML zur aktiven Fassung', () => {
      const { items, activeType } = NodeWriteMapping.contentItemsFor({
        content: 'Reiner Text',
        htmlcontent: '<p>Reiner Text</p>',
      });

      expect(items).toEqual({
        text: 'Reiner Text',
        html: '<p>Reiner Text</p>',
      });
      expect(activeType).toBe('html');
    });

    it('macht Text zur aktiven Fassung, wenn HTML leer ist', () => {
      // Genau die Regel, nach der das Frontend heute auswählt:
      // `htmlcontent ? html : text` — ein leerer String zählt als nicht gesetzt.
      const { activeType } = NodeWriteMapping.contentItemsFor({
        content: 'Reiner Text',
        htmlcontent: '',
      });

      expect(activeType).toBe('text');
    });

    it('behandelt ein Leerzeichen als gesetzt — wie JavaScript', () => {
      const { activeType } = NodeWriteMapping.contentItemsFor({
        content: 'Reiner Text',
        htmlcontent: ' ',
      });

      expect(activeType).toBe('html');
    });

    it('meldet keinen aktiven Typ, wenn der Payload gar keinen Inhalt trägt', () => {
      const { items, activeType } = NodeWriteMapping.contentItemsFor({
        name: 'nur umbenannt',
      });

      expect(items).toEqual({});
      expect(activeType).toBeNull();
    });

    it('nimmt null als gesetzten Wert entgegen — Inhalt wurde geleert', () => {
      const { items, activeType } = NodeWriteMapping.contentItemsFor({
        content: null,
        htmlcontent: null,
      });

      expect(items).toEqual({ text: null, html: null });
      expect(activeType).toBe('text');
    });
  });
});

// ─── Typfreie Objektnamen ──────────────────────────────────────────────────

describe('node und content', () => {
  it('führen auf dieselben Tabellen wie die alten Namen', () => {
    expect(NodeWriteMapping.tableFor('node')).toBe('node');
    expect(NodeWriteMapping.tableFor('content')).toBe('content_node');
  });

  it('zählen node zu den Knoten-Objekten', () => {
    expect(NodeWriteMapping.isNodeObject('node')).toBe(true);
    expect(NodeWriteMapping.isNodeObject('content')).toBe(false);
  });

  it('tragen die alte Id weder nach außen noch vergeben sie eine', () => {
    ['story', 'chapter', 'paragraph'].forEach((object) => {
      expect(NodeWriteMapping.usesLegacyIds(object)).toBe(true);
    });
    ['node', 'content'].forEach((object) => {
      expect(NodeWriteMapping.usesLegacyIds(object)).toBe(false);
    });
  });

  it('nehmen die Spaltennamen unverändert entgegen', () => {
    // Kein Abbilden mehr, nur noch Benennen: das Feld heißt wie die Spalte.
    expect(
      NodeWriteMapping.columnsFor('node', {
        name: 'Knoten',
        description: 'Text',
        sortnumber: 2,
        reversed: true,
        parent_node_id: 'n-1',
        cover_node_id: 'n-2',
        published_date: '2026-01-01',
      })
    ).toEqual({
      name: 'Knoten',
      description: 'Text',
      sortnumber: 2,
      reversed: true,
      parent_node_id: 'n-1',
      cover_node_id: 'n-2',
      published_date: '2026-01-01',
    });
  });

  it('lassen die Repräsentationen eines Inhalts als eigene Zeilen stehen', () => {
    expect(
      NodeWriteMapping.columnsFor('content', {
        node_id: 'n-1',
        content: 'Text',
        htmlcontent: '<p>Text</p>',
      })
    ).toEqual({ node_id: 'n-1' });
  });

  it('lassen einen unveränderten gelesenen Datensatz durch', () => {
    // Der Absatz-Editor schickt seinen ganzen Datensatz zurück. Abgeleitete
    // Felder und Kinderlisten dürfen daran nicht scheitern.
    expect(
      NodeWriteMapping.columnsFor('node', {
        id: 'n-1',
        legacy_id: '000s1',
        name: 'Knoten',
        nodes: [],
        contents: [],
      })
    ).toEqual({ name: 'Knoten' });
  });

  it('werfen weiterhin bei einem Feld, das es nicht gibt', () => {
    expect(() =>
      NodeWriteMapping.columnsFor('node', { storyid: 'n-1' })
    ).toThrow('cannot be written');
  });

  it('kennen kein Präfix — die Kompat-Vergabe endet hier', () => {
    ['node', 'content'].forEach((object) => {
      expect(() => NodeWriteMapping.legacyPrefix(object)).toThrow(
        'Unknown object type'
      );
    });
  });
});
