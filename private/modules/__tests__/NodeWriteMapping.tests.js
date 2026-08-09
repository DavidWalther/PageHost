const { NodeWriteMapping } = require('../NodeWriteMapping.js');

describe('NodeWriteMapping', () => {
  describe('Objektart und Tabelle', () => {
    it('erkennt den Knoten als Knoten und den Inhalt als Inhalt', () => {
      expect(NodeWriteMapping.isNodeObject('node')).toBe(true);
      expect(NodeWriteMapping.isNodeObject('content')).toBe(false);
    });

    it('ordnet jedem Objekt genau eine Tabelle zu', () => {
      expect(NodeWriteMapping.tableFor('node')).toBe('node');
      expect(NodeWriteMapping.tableFor('content')).toBe('content_node');
    });

    it('wirft bei einem Objekt, das keine Tabelle hat', () => {
      // Lieber ein Fehler als eine Zeile in der falschen Tabelle — genau das
      // ist einmal passiert und hat die Anmeldung zerlegt.
      ['identity', 'configuration', 'content_item', 'story'].forEach(
        (object) => {
          expect(() => NodeWriteMapping.tableFor(object)).toThrow(
            'has no table in the node model'
          );
        }
      );
    });
  });

  describe('columnsFor — Schreibweise', () => {
    it('nimmt die Spaltennamen unverändert entgegen', () => {
      expect(
        NodeWriteMapping.columnsFor('node', {
          name: 'Knoten',
          description: 'Text',
          sortnumber: 2,
          reversed: true,
          parent_node_id: 'n-1',
          cover_node_id: 'n-2',
          published_date: '2026-01-01T00:00:00.000Z',
        })
      ).toEqual({
        name: 'Knoten',
        description: 'Text',
        sortnumber: 2,
        reversed: true,
        parent_node_id: 'n-1',
        cover_node_id: 'n-2',
        published_date: '2026-01-01T00:00:00.000Z',
      });
    });

    it('ist unabhängig von der Groß-/Kleinschreibung', () => {
      // Postgres faltet unquotierte Bezeichner ohnehin; eine abweichende
      // Schreibweise darf nicht zu einem stillen Verlust führen.
      expect(
        NodeWriteMapping.columnsFor('node', { Name: 'Knoten', SortNumber: 3 })
      ).toEqual({ name: 'Knoten', sortnumber: 3 });
    });

    it('kennt beim Inhalt nur seine eigenen Spalten', () => {
      expect(
        NodeWriteMapping.columnsFor('content', {
          name: 'Absatz',
          sortnumber: 2,
          node_id: 'n-1',
          published_date: null,
        })
      ).toEqual({
        name: 'Absatz',
        sortnumber: 2,
        node_id: 'n-1',
        published_date: null,
      });
    });
  });

  describe('columnsFor — was nicht geschrieben wird', () => {
    it('lässt die Id fallen: sie ist die Identität, kein Wert', () => {
      expect(
        NodeWriteMapping.columnsFor('node', { id: 'n-1', name: 'Knoten' })
      ).toEqual({ name: 'Knoten' });
    });

    it('lässt einen unveränderten gelesenen Datensatz durch', () => {
      // Abgeleitete Felder und Kinderlisten dürfen nicht daran scheitern,
      // dass der Editor seinen ganzen Datensatz zurückschickt.
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

    it('lässt die App-Spalten fallen — daraus wird eine app_node-Zeile', () => {
      expect(
        NodeWriteMapping.columnsFor('node', {
          name: 'Knoten',
          applicationincluded: 'meineApp',
          applicationexcluded: null,
        })
      ).toEqual({ name: 'Knoten' });
    });

    it('lässt content und htmlcontent fallen — eigene Zeilen in content_item', () => {
      expect(
        NodeWriteMapping.columnsFor('content', {
          name: 'Absatz',
          content: 'Text',
          htmlContent: '<p>Text</p>',
        })
      ).toEqual({ name: 'Absatz' });
    });

    it('wirft bei einem unbekannten Feld, statt es zu schlucken', () => {
      // Ein Tippfehler soll auffallen und nicht als verschwundene Änderung enden.
      expect(() =>
        NodeWriteMapping.columnsFor('node', { sortnumbr: 1 })
      ).toThrow('Field "sortnumbr" cannot be written');
    });

    it('wirft bei einem Feld aus der alten Benennung', () => {
      ['storyid', 'chapterid', 'publishdate', 'lastupdate'].forEach((field) => {
        expect(() =>
          NodeWriteMapping.columnsFor('node', { [field]: 'x' })
        ).toThrow('cannot be written');
      });
    });

    it('wirft, wenn ein Feld zum Objekt nicht passt', () => {
      // `reversed` gibt es am Knoten, nicht am Inhalt.
      expect(() =>
        NodeWriteMapping.columnsFor('content', { reversed: true })
      ).toThrow('Field "reversed" cannot be written');
    });
  });

  describe('referenceColumns', () => {
    it('benennt die Spalten, deren Wert erst aufgelöst werden muss', () => {
      const columns = NodeWriteMapping.columnsFor('node', {
        parent_node_id: 'n-1',
        cover_node_id: 'n-2',
        name: 'Knoten',
      });

      expect(NodeWriteMapping.referenceColumns(columns).sort()).toEqual([
        'cover_node_id',
        'parent_node_id',
      ]);
    });

    it('meldet nichts, wenn keine Referenz im Payload steckt', () => {
      const columns = NodeWriteMapping.columnsFor('node', { name: 'Knoten' });

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

describe('contentItemsFor mit ausdrücklichem active_type', () => {
  it('nimmt den mitgeschickten Typ, statt ihn abzuleiten', () => {
    // Das ist der Zweck von `active_content_item`: die Auswahl steht im
    // Datensatz und wird nicht bei jedem Schreiben neu geraten.
    const { activeType } = NodeWriteMapping.contentItemsFor({
      content: 'Text',
      htmlcontent: '<p>Text</p>',
      active_type: 'text',
    });

    expect(activeType).toBe('text');
  });

  it('ignoriert einen Typ, zu dem kein Inhalt mitkommt', () => {
    // Der Zeiger darf nicht auf etwas zeigen, das gar nicht geschrieben wird.
    const { activeType } = NodeWriteMapping.contentItemsFor({
      content: 'Text',
      active_type: 'html',
    });

    expect(activeType).toBe('text');
  });

  it('fällt ohne Angabe auf die alte implizite Regel zurück', () => {
    expect(
      NodeWriteMapping.contentItemsFor({
        content: 'Text',
        htmlcontent: '<p>Text</p>',
      }).activeType
    ).toBe('html');
  });

  it('legt keine Repräsentation an, die gar nicht mitkommt', () => {
    // Ein `htmlcontent: null` würde eine leere HTML-Zeile schreiben; der
    // Editor schickt das Feld deshalb gar nicht erst mit, wenn es sie nicht gibt.
    const { items } = NodeWriteMapping.contentItemsFor({ content: 'Text' });

    expect(Object.keys(items)).toEqual(['text']);
  });
});
