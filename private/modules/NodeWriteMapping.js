/**
 * Übersetzung eines Schreib-Payloads vom alten Objektmodell auf das neue.
 *
 * Reine Funktionen, keine Datenbank — dieselbe Trennung wie bei
 * `NodeVisibility`: die Regel ist ohne Postgres prüfbar, das Repository setzt
 * sie um.
 *
 * **Feldnamen kommen in gemischter Schreibweise herein.** Die Editier-
 * komponenten schicken `sortNumber`/`publishDate`/`storyId`, der Absatz dagegen
 * schickt den gelesenen Datensatz unverändert zurück und der ist
 * kleingeschrieben (`sortnumber`, `chapterid`). Gegen die alten Tabellen fiel
 * das nie auf, weil Postgres unquotierte Bezeichner ohnehin faltet. Hier wird
 * deshalb **ausschließlich** case-insensitiv abgebildet.
 */

/** Alte Präfixe. Sie bestimmen, als was das Frontend eine Id liest. */
const LEGACY_PREFIX = {
  story: '000s',
  chapter: '000c',
  paragraph: '000p',
};

/** Knoten-Objekte (eine Zeile in `node`) gegenüber Inhalts-Objekten. */
const NODE_OBJECTS = ['story', 'chapter', 'node'];

/**
 * Objekte der **alten** Benennung.
 *
 * Sie sind an die Kompat-Schicht gebunden: Neuanlagen bekommen zusätzlich eine
 * `legacy_id` im alten Präfix-Schema, und nach außen gilt diese alte Id. Für
 * `node` und `content` gilt beides nicht — dort ist die neue Id die Identität,
 * und eine alte wird gar nicht erst vergeben. Das ist die in `datamodel.md`
 * (Abschnitt 8) festgehaltene Lebensdauer der Vergabe: Sie endet mit dem
 * Frontend-Umbau, nicht erst mit den alten Tabellen.
 */
const LEGACY_OBJECTS = ['story', 'chapter', 'paragraph'];

/**
 * Zieltabelle je Objekt — **abschließend**.
 *
 * Bewusst eine Zuordnung und keine Ja/Nein-Frage: „Knoten? sonst
 * `content_node`" hält nur, solange es genau zwei Arten gibt. Ein Objekt, das
 * hier nicht steht, hat im neuen Modell keine Tabelle und darf nicht in
 * irgendeiner landen — weder `identity` noch `configuration`, und auch kein
 * künftiges `content_item`, sollte es je direkt beschreibbar werden. Dann
 * kommt es hier dazu, und bis dahin fliegt der Aufruf.
 */
const TABLE_BY_OBJECT = {
  story: 'node',
  chapter: 'node',
  paragraph: 'content_node',
  node: 'node',
  content: 'content_node',
};

/**
 * Feldabbildung je Objekt: eingehender Name (klein) → Spalte im neuen Modell.
 *
 * Absichtlich **nicht** enthalten:
 * - `id` — die Identität, kein zu setzender Wert
 * - `lastupdate` — die Spalte gibt es im neuen Modell nicht mehr
 *   (`datamodel.md`, „Was sich beim Umschalten sichtbar ändert")
 * - `applicationincluded`/`applicationexcluded` — im neuen Modell eine Zeile in
 *   `app_node`, keine Spalte. Wird getrennt behandelt
 * - `content`/`htmlcontent` beim Absatz — eigene Zeilen in `content_item`
 */
const FIELD_MAP = {
  story: {
    name: 'name',
    description: 'description',
    sortnumber: 'sortnumber',
    publishdate: 'published_date',
    coverid: 'cover_node_id',
  },
  chapter: {
    name: 'name',
    description: 'description',
    sortnumber: 'sortnumber',
    reversed: 'reversed',
    publishdate: 'published_date',
    storyid: 'parent_node_id',
    coverid: 'cover_node_id',
  },
  paragraph: {
    name: 'name',
    sortnumber: 'sortnumber',
    publishdate: 'published_date',
    chapterid: 'node_id',
  },
  // Die typfreie Benennung. Sie bildet nicht mehr ab, sondern benennt: die
  // Felder heißen wie die Spalten. Was hier fehlt, ist keine Umbenennung wert —
  // es gibt schlicht keine Entsprechung mehr für `storyid` bei einem Absatz.
  node: {
    name: 'name',
    description: 'description',
    sortnumber: 'sortnumber',
    reversed: 'reversed',
    published_date: 'published_date',
    parent_node_id: 'parent_node_id',
    cover_node_id: 'cover_node_id',
  },
  content: {
    name: 'name',
    sortnumber: 'sortnumber',
    published_date: 'published_date',
    node_id: 'node_id',
  },
};

/**
 * Spalten, die eine **Id** aufnehmen und deren Wert deshalb erst aufgelöst
 * werden muss: hereinkommen kann eine alte Id (`000c…`), in der Spalte steht
 * die neue.
 */
const REFERENCE_COLUMNS = ['parent_node_id', 'cover_node_id', 'node_id'];

/**
 * Felder, die stillschweigend fallen gelassen werden (siehe FIELD_MAP).
 *
 * Die hinteren fünf sind Felder der typfreien **Antwort**: `legacy_id` ist
 * abgeleitet, `nodes`/`contents`/`items` sind Kinder und keine Spalten, und
 * `active_content_item` setzt der Schreibpfad selbst aus dem Inhalt. Ein Client,
 * der einen gelesenen Datensatz unverändert zurückschickt, soll daran nicht
 * scheitern — das tut der Absatz-Editor heute schon.
 */
const DROPPED_FIELDS = [
  'id',
  'lastupdate',
  'legacy_id',
  'nodes',
  'contents',
  'items',
  'active_content_item',
  'active_type',
];

class NodeWriteMapping {
  /** Schreibt dieses Objekt eine Zeile in `node`? */
  static isNodeObject(object) {
    return NODE_OBJECTS.includes(String(object).toLowerCase());
  }

  /**
   * Zieltabelle des Objekts. Wirft, wenn es keine gibt — lieber ein Fehler als
   * eine Zeile in der falschen Tabelle.
   */
  static tableFor(object) {
    const table = TABLE_BY_OBJECT[String(object).toLowerCase()];
    if (!table) {
      throw new Error(`Object "${object}" has no table in the node model`);
    }
    return table;
  }

  /**
   * Trägt dieses Objekt noch die alte Id nach außen — und bekommt eine neu
   * vergeben? Für `node` und `content` nicht: dort ist die neue Id die
   * Identität.
   */
  static usesLegacyIds(object) {
    return LEGACY_OBJECTS.includes(String(object).toLowerCase());
  }

  /** Altes Id-Präfix des Objekts (`000s`, `000c`, `000p`). */
  static legacyPrefix(object) {
    const prefix = LEGACY_PREFIX[String(object).toLowerCase()];
    if (!prefix) {
      throw new Error(`Unknown object type: ${object}`);
    }
    return prefix;
  }

  /**
   * Baut die zu setzenden Spalten aus dem Payload.
   *
   * Unbekannte Felder werden **nicht** stillschweigend geschluckt, sondern
   * lösen einen Fehler aus: ein Tippfehler im Payload soll auffallen, statt als
   * verschwundene Änderung zu enden. Die bewusst fallengelassenen Felder stehen
   * in `DROPPED_FIELDS` — `storyid` gehört beim Absatz dazu, weil die Story
   * dort über den Kapitel-Knoten hängt und keine eigene Spalte hat.
   */
  static columnsFor(object, payload) {
    const key = String(object).toLowerCase();
    const map = FIELD_MAP[key];
    if (!map) {
      throw new Error(`Unknown object type: ${object}`);
    }

    const columns = {};
    Object.entries(payload || {}).forEach(([field, value]) => {
      const lower = field.toLowerCase();
      if (
        !NodeWriteMapping.isNodeObject(key) &&
        (lower === 'content' || lower === 'htmlcontent')
      ) {
        return; // eigene Zeilen in content_item
      }
      if (lower === 'applicationincluded' || lower === 'applicationexcluded') {
        return; // eigene Zeilen in app_node
      }
      if (DROPPED_FIELDS.includes(lower)) {
        return;
      }
      // `storyid` hat drei Bedeutungen: beim Kapitel ist es ein echtes Feld
      // (`parent_node_id`, steht in FIELD_MAP), beim Absatz ist es redundant —
      // die Story hängt dort am Kapitel. Unter den typfreien Namen gibt es sie
      // gar nicht mehr, und dort soll sie auffallen statt zu verschwinden.
      if (lower === 'storyid' && key === 'paragraph') {
        return;
      }
      const column = map[lower];
      if (!column) {
        throw new Error(
          `Field "${field}" cannot be written for object "${object}"`
        );
      }
      columns[column] = value;
    });

    return columns;
  }

  /** Spalten, deren Wert eine Id ist und aufgelöst werden muss. */
  static referenceColumns(columns) {
    return Object.keys(columns).filter((column) =>
      REFERENCE_COLUMNS.includes(column)
    );
  }

  /**
   * Inhalts-Repräsentationen eines Absatz-Payloads.
   *
   * Liefert je Typ den Text und dazu, welcher Typ der **aktive** ist. Die Regel
   * bildet die alte, implizite Auswahl des Frontends nach
   * (`htmlcontent ? html : text`, `custom-paragraph.js`), macht sie aber
   * explizit: was aktiv ist, steht ab jetzt in `content_node.active_content_item`.
   *
   * `nullif(text, '')` im alten Sinne: ein leerer String zählt als „nicht
   * gesetzt", ein Leerzeichen nicht — genau wie die JavaScript-Wahrheit, an der
   * das Frontend die Auswahl trifft.
   */
  static contentItemsFor(payload) {
    const items = {};
    Object.entries(payload || {}).forEach(([field, value]) => {
      const lower = field.toLowerCase();
      if (lower === 'content') {
        items.text = value ?? null;
      }
      if (lower === 'htmlcontent') {
        items.html = value ?? null;
      }
    });

    const activeType = items.html
      ? 'html'
      : items.text !== undefined
        ? 'text'
        : null;
    return { items, activeType };
  }
}

module.exports = {
  NodeWriteMapping,
  LEGACY_PREFIX,
  FIELD_MAP,
};
