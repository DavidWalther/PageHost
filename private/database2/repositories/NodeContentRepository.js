const { ContentRepository } = require('./ContentRepository.js');
const { PostgresActions } = require('../DataStorage/pgConnector.js');
const { NodeVisibility } = require('../../modules/NodeVisibility.js');
const { Logging } = require('../../modules/logging.js');

/**
 * Rohdaten des Knotenbaums. Bewusst **ohne** Filter — weder nach App noch nach
 * Veröffentlichung. Beides entscheidet JavaScript, unmittelbar nach der
 * Abfrage und vor allem, was danach kommt (Mapping, Cache).
 *
 * Der Baum ist klein (Storys und Kapitel, keine Absätze); ihn vollständig zu
 * laden kostet weniger als die rekursive Auflösung in SQL — und ist prüfbar.
 */
const NODES_SQL = `
SELECT
  id, name, description, sortnumber, reversed,
  parent_node_id, cover_node_id, legacy_id, published_date,
  is_parent_controls_visibility
FROM node
`;

/**
 * Zugehörigkeiten mit aufgelöstem App-Namen. `app_name IS NULL` ist die
 * Wildcard-Zeile — so muss der Schlüssel nirgends auf eine Id abgebildet werden.
 */
const APP_NODES_SQL = `
SELECT an.node_id, an.relation, a.name AS app_name
FROM app_node an
LEFT JOIN app a ON a.id = an.app_id
`;

/** Content-Halter eines Knotens, Kopfdaten ohne Inhalt. */
const CONTENT_NODES_SQL = `
SELECT id, name, sortnumber, legacy_id, published_date, node_id
FROM content_node
WHERE node_id = $1
`;

/** Ein Content-Halter mit allen seinen Repräsentationen. */
const CONTENT_SQL = `
SELECT
  cn.id, cn.name, cn.sortnumber, cn.legacy_id, cn.published_date,
  cn.node_id, cn.active_content_item,
  ci.id AS item_id, ci.type AS item_type, ci.content AS item_content
FROM content_node cn
LEFT JOIN content_item ci ON ci.content_node_id = cn.id
WHERE cn.legacy_id = $1 OR cn.id = $1
`;

/**
 * Inhaltsquelle auf dem NEUEN Datenmodell (`node` / `content_node` /
 * `content_item`).
 *
 * Tritt gegen `LegacyContentRepository` an: solange beide dieselbe Antwort
 * liefern, ist die Umschaltung von außen nicht beobachtbar. Die verbleibenden,
 * beabsichtigten Unterschiede stehen in `doc/datamodel-overhaul/datamodel.md`
 * unter „Was sich beim Umschalten sichtbar ändert".
 *
 * **Reihenfolge der Verarbeitung** — die Sichtbarkeit wird direkt nach der
 * Abfrage aufgelöst, noch vor dem Mapping und damit weit vor dem Cache: was die
 * `DataFacade` unter einem Cache-Schlüssel ablegt, ist bereits gefiltert.
 */
class NodeContentRepository extends ContentRepository {
  createConnector() {
    return new PostgresActions(this.environment);
  }

  /**
   * Lädt Knoten und Zugehörigkeiten und gibt die Auflösung zurück. Beide
   * Abfragen laufen über **eine** Verbindung, die danach geschlossen wird.
   */
  async loadVisibility() {
    const LOCATION = 'NodeContentRepository.loadVisibility';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    if (this.visibility) {
      return this.visibility;
    }
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Loading node tree for application key: ${this.applicationKey}`,
    });

    const connector = this.createConnector();
    const nodes = await connector.executeParameterizedSql(NODES_SQL, []);
    const appNodes = await connector.executeParameterizedSql(
      APP_NODES_SQL,
      [],
      { closeConnection: true }
    );

    this.visibility = new NodeVisibility({ nodes, appNodes });
    return this.visibility;
  }

  /** Führt eine Abfrage aus und schließt danach die Verbindung. */
  async execute(statement, parameters) {
    return this.createConnector().executeParameterizedSql(
      statement,
      parameters,
      { closeConnection: true }
    );
  }

  /**
   * Publish-Tor. Drei Zustände wie in `ContentRepository` beschrieben:
   * nicht gesetzt → gegen jetzt, `null` → kein Filter (edit-Scope),
   * ein Datum → gegen dieses Datum.
   *
   * ABWEICHUNG VOM ALTMODELL (bewusst): dort verglich der Story-Pfad gegen
   * Mitternacht des heutigen Tages und der Kapitel-Pfad gegen `NOW()`. Eine
   * heute um 09:00 veröffentlichte Story war deshalb erst am Folgetag sichtbar,
   * ihre gleichzeitig veröffentlichten Kapitel sofort.
   */
  isPublished(record) {
    if (this.publishDate === null) {
      return true;
    }
    if (!record || !record.published_date) {
      return false;
    }
    const limit =
      this.publishDate === undefined ? new Date() : new Date(this.publishDate);
    return new Date(record.published_date) <= limit;
  }

  /** Sichtbar für die App **und** veröffentlicht. */
  isDeliverable(node, visibility) {
    return (
      !!node &&
      visibility.isVisible(node.id, this.applicationKey) &&
      this.isPublished(node)
    );
  }

  /**
   * Alle für den App-Schlüssel sichtbaren Knoten — ungefiltert nach
   * `published_date`. Grundlage des Inhaltsbaums, der den Publish-Filter erst
   * bei der Auslieferung anwendet (`ContentVisibilityFilter`).
   */
  async queryVisibleNodes() {
    const visibility = await this.loadVisibility();
    return visibility.visibleNodes(this.applicationKey);
  }

  /**
   * Story: der Knoten selbst plus seine Kind-Knoten als Kapitel-Kopfdaten.
   *
   * Die eingehende Id darf die **alte** (`000s…`, über `legacy_id`) oder die
   * neue sein. Nach außen geht immer die alte zurück, solange es eine gibt —
   * daran hängen Deep-Links, Cache-Keys und die Präfix-Typisierung im Frontend.
   */
  async getStory(storyId) {
    const visibility = await this.loadVisibility();
    const storyNode = visibility.findByAnyId(storyId);
    if (!this.isDeliverable(storyNode, visibility)) {
      return {};
    }

    const chapters = sortSiblings(
      visibility
        .childrenOf(storyNode.id)
        .filter((child) => this.isDeliverable(child, visibility))
    );
    const coverNode = visibility.getNode(storyNode.cover_node_id);

    return {
      id: outwardId(storyNode),
      name: storyNode.name ?? null,
      // Fehlende Werte kommen als null, nicht als undefined: undefined
      // verschwindet beim Serialisieren spurlos aus der Antwort, null nicht.
      lastupdate: null,
      sortnumber: storyNode.sortnumber ?? null,
      publishdate: storyNode.published_date ?? null,
      coverid: coverNode
        ? outwardId(coverNode)
        : (storyNode.cover_node_id ?? null),
      chapters: chapters.map((child) =>
        headData({
          id: outwardId(child),
          name: child.name,
          sortnumber: child.sortnumber,
        })
      ),
    };
  }

  /**
   * Kapitel: der Knoten plus die Kopfdaten seiner `content_node`-Zeilen —
   * ausdrücklich **ohne** Inhalt, genau wie im Altmodell.
   */
  async getChapter(chapterId) {
    const visibility = await this.loadVisibility();
    const chapterNode = visibility.findByAnyId(chapterId);
    if (!this.isDeliverable(chapterNode, visibility)) {
      return {};
    }

    const contentNodes = await this.execute(CONTENT_NODES_SQL, [
      chapterNode.id,
    ]);
    const parentNode = visibility.getNode(chapterNode.parent_node_id);

    return {
      id: outwardId(chapterNode),
      storyid: parentNode
        ? outwardId(parentNode)
        : (chapterNode.parent_node_id ?? null),
      name: chapterNode.name ?? null,
      lastupdate: null,
      sortnumber: chapterNode.sortnumber ?? null,
      reversed: chapterNode.reversed ?? null,
      publishdate: chapterNode.published_date ?? null,
      // Der Content-Halter hat keine eigene App-Zugehörigkeit; er folgt seinem
      // Knoten, und der ist an dieser Stelle bereits als sichtbar erwiesen.
      paragraphs: sortSiblings(
        contentNodes.filter((row) => this.isPublished(row))
      ).map((row) =>
        headData({
          id: outwardId(row),
          name: row.name,
          sortnumber: row.sortnumber,
        })
      ),
    };
  }

  /**
   * Absatz mit vollem Inhalt.
   *
   * Zwei bewusste Abweichungen vom Altmodell, beide in Richtung „weniger
   * ausliefern":
   *
   * 1. **Publish-Filter.** Der alte direkte Absatz-Zugriff hatte gar keinen —
   *    ein unveröffentlichter Absatz wurde ausgeliefert, sobald seine Id bekannt
   *    war. Hier gilt derselbe Filter wie überall sonst.
   * 2. **Sichtbarkeit über den Knoten.** `content_node` trägt keine eigene
   *    App-Zugehörigkeit, sie folgt ihrem `node` — so ist das Modell gebaut.
   *    Das Altmodell prüfte allein die App-Spalten des Absatzes.
   */
  async getParagraph(paragraphId) {
    const visibility = await this.loadVisibility();
    const rows = await this.execute(CONTENT_SQL, [paragraphId]);
    if (rows.length === 0) {
      return {};
    }

    const first = rows[0];
    const chapterNode = visibility.getNode(first.node_id);
    if (!this.isDeliverable(chapterNode, visibility)) {
      return {};
    }
    if (!this.isPublished(first)) {
      return {};
    }

    const storyNode = visibility.getNode(chapterNode.parent_node_id);
    const textItem = rows.find((row) => row.item_type === 'text');
    const activeItem = rows.find(
      (row) => row.item_id && row.item_id === first.active_content_item
    );

    return {
      id: outwardId(first),
      name: first.name ?? null,
      lastupdate: null,
      content: textItem ? (textItem.item_content ?? null) : null,
      // `htmlcontent` nur, wenn die HTML-Fassung auch die aktive ist. Das
      // Frontend entscheidet über `htmlcontent ? html : text` — damit setzt der
      // explizite Zeiger `active_content_item` sich gegen die alte implizite
      // Regel „html gewinnt, sobald gefüllt" durch.
      htmlcontent:
        activeItem && activeItem.item_type === 'html'
          ? (activeItem.item_content ?? null)
          : null,
      sortnumber: first.sortnumber ?? null,
      chapterid: outwardId(chapterNode),
      storyid: storyNode
        ? outwardId(storyNode)
        : (chapterNode.parent_node_id ?? null),
      publishdate: first.published_date ?? null,
    };
  }
}

/** Nach außen gilt die alte Id, solange es eine gibt. */
function outwardId(row) {
  return row.legacy_id || row.id;
}

/**
 * Geschwister-Reihenfolge: `sortnumber` aufsteigend, leere Werte ans Ende.
 *
 * Der Tiebreaker ist nicht kosmetisch: bei gleicher `sortnumber` sortiert das
 * Altmodell gar nicht weiter, die Reihenfolge ist dort die physische
 * Zeilenreihenfolge und damit Zufall. Die alte Id folgt der Anlagereihenfolge
 * und macht das Ergebnis reproduzierbar.
 */
function sortSiblings(records) {
  return [...records].sort((first, second) => {
    const firstSort = first.sortnumber ?? Number.MAX_SAFE_INTEGER;
    const secondSort = second.sortnumber ?? Number.MAX_SAFE_INTEGER;
    if (firstSort !== secondSort) {
      return firstSort - secondSort;
    }
    return String(outwardId(first)).localeCompare(String(outwardId(second)));
  });
}

/**
 * Kopfdaten wie im Altmodell: Felder ohne Wert fehlen ganz.
 *
 * `DataStorage` baut die Kind-Datensätze mit `if (!row[fieldName]) return;` —
 * ein `sortnumber` von 0 oder ein leerer Name fällt damit heraus, statt als
 * `null` aufzutauchen. Wer das nicht nachbildet, ändert die Antwortform.
 */
function headData(record) {
  const result = {};
  Object.entries(record).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    result[key] = value;
  });
  return result;
}

module.exports = {
  NodeContentRepository,
  NODES_SQL,
  APP_NODES_SQL,
  CONTENT_NODES_SQL,
  CONTENT_SQL,
};
