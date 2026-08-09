/**
 * Prüfung und Zuordnung eines Schreib-Payloads auf Tabelle und Spalten.
 *
 * Reine Funktionen, keine Datenbank — dieselbe Trennung wie bei
 * `NodeVisibility`: die Regel ist ohne Postgres prüfbar, das Repository setzt
 * sie um.
 *
 * **Feldnamen werden case-insensitiv abgebildet.** Postgres faltet unquotierte
 * Bezeichner ohnehin auf Kleinschreibung; hier passiert dasselbe, damit eine
 * abweichende Schreibweise im Payload nicht zu einem stillen Verlust führt.
 */

/** Knoten-Objekte (eine Zeile in `node`) gegenüber Inhalts-Objekten. */
const NODE_OBJECTS = ['node'];

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
  node: 'node',
  content: 'content_node',
};

/**
 * Setzbare Spalten je Objekt: eingehender Name (klein) → Spalte.
 *
 * Absichtlich **nicht** enthalten:
 * - `id` — die Identität, kein zu setzender Wert
 * - `content`/`htmlcontent` — eigene Zeilen in `content_item`
 * - App-Zugehörigkeit — eine Zeile in `app_node`, keine Spalte
 */
const FIELD_MAP = {
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
 * Alle sind Felder der **Antwort**: `id` und `legacy_id` sind Identität,
 * `nodes`/`contents`/`items` sind Kinder und keine Spalten,
 * `active_content_item` setzt der Schreibpfad selbst. Ein Client, der einen
 * gelesenen Datensatz unverändert zurückschickt, soll daran nicht scheitern —
 * genau das tut der Inhalts-Editor.
 */
const DROPPED_FIELDS = [
  'id',
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
   * Baut die zu setzenden Spalten aus dem Payload.
   *
   * Unbekannte Felder werden **nicht** stillschweigend geschluckt, sondern
   * lösen einen Fehler aus: ein Tippfehler im Payload soll auffallen, statt als
   * verschwundene Änderung zu enden. Die bewusst fallengelassenen Felder stehen
   * in `DROPPED_FIELDS`.
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
   * Inhalts-Repräsentationen eines Inhalts-Payloads.
   *
   * Liefert je Typ den Text und dazu, welcher Typ der **aktive** ist — das,
   * was in `content_node.active_content_item` landet.
   *
   * Sagt der Payload den Typ nicht, greift die frühere implizite Regel
   * (`htmlcontent ? html : text`). Sie steht hier nur noch als Rückfall für
   * Aufrufer, die den Zeiger nicht kennen: ein leerer String zählt als „nicht
   * gesetzt", ein Leerzeichen nicht.
   */
  static contentItemsFor(payload) {
    const items = {};
    let requestedType = null;
    Object.entries(payload || {}).forEach(([field, value]) => {
      const lower = field.toLowerCase();
      if (lower === 'content') {
        items.text = value ?? null;
      }
      if (lower === 'htmlcontent') {
        items.html = value ?? null;
      }
      if (lower === 'active_type') {
        requestedType = value;
      }
    });

    // Sagt der Aufrufer, welche Fassung gilt, gilt sie — das ist der Zweck von
    // `active_content_item`. Nur wenn er schweigt, greift die alte implizite
    // Regel. Ein Typ ohne mitgeschickten Inhalt wird ignoriert: der Zeiger darf
    // nicht auf etwas zeigen, das es hier nicht gibt.
    const activeType =
      requestedType && items[requestedType] !== undefined
        ? requestedType
        : items.html
          ? 'html'
          : items.text !== undefined
            ? 'text'
            : null;
    return { items, activeType };
  }
}

module.exports = {
  NodeWriteMapping,
  FIELD_MAP,
};
