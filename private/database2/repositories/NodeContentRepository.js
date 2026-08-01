const { ContentRepository } = require('./ContentRepository.js');
const { PostgresActions } = require('../DataStorage/pgConnector.js');
const { Logging } = require('../../modules/logging.js');

/**
 * Knoten, die für eine App sichtbar sind — als flache Liste mit `depth`.
 *
 * Setzt die Auflösungsregel aus `doc/datamodel-overhaul/datamodel.md`
 * Abschnitt 5 um:
 *
 *   member(node, K) ⟺ ( include für K ODER include-Wildcard
 *                       ODER (is_parent_controls_visibility UND member(parent, K)) )
 *                     UND NICHT ( exclude für K ODER exclude-Wildcard )
 *
 * Drei Eigenschaften, die nicht offensichtlich sind:
 *
 * 1. **Kein Publish-Filter.** Genau wie im Altmodell wird hier nur die
 *    App-Zugehörigkeit aufgelöst; `published_date` wirkt erst bei der
 *    Auslieferung (`ContentVisibilityFilter`). Sonst wäre derselbe Baum nicht
 *    mehr für andere Zwecke — etwa `sitemap.xml` — verwendbar.
 * 2. **Zyklus-Schutz über `path`.** Hier Vorsorge, nicht Notwendigkeit: weil die
 *    Rekursion an den Wurzeln verankert ist und jeder Knoten genau einen Parent
 *    hat, bildet ein Zyklus eine abgeschlossene, von keiner Wurzel erreichbare
 *    Komponente — er kann diese Abfrage nicht zum Hängen bringen, sondern lässt
 *    seinen Teilbaum still verschwinden. Der Guard bleibt trotzdem, weil er in
 *    jeder anders verankerten Abfrage („Teilbaum ab Knoten X") sofort greift.
 * 3. **Ein unbekannter App-Schlüssel liefert die Wildcard-Knoten.**
 *    `target_app` ist dann leer, `an.app_id = NULL` ergibt NULL, es bleiben die
 *    Zeilen mit `app_id IS NULL`. Das entspricht dem Altmodell exakt: dort
 *    greift `applicationincluded = '*'` ebenfalls unabhängig davon, ob der
 *    Schlüssel existiert.
 *
 * Nicht am Baum hängende Knoten (Parent zeigt ins Leere) erscheinen nicht — die
 * Rekursion erreicht sie nie. Im Altmodell fielen solche Waisen beim
 * Zusammenbau des Baums genauso heraus.
 */
const VISIBLE_TREE_CTE = `
WITH RECURSIVE
  target_app AS (
    SELECT id FROM app WHERE name = $1
  ),
  flags AS (
    SELECT
      n.id,
      n.parent_node_id,
      COALESCE(n.is_parent_controls_visibility, false) AS inherits,
      EXISTS (
        SELECT 1 FROM app_node an
         WHERE an.node_id = n.id
           AND an.relation = 'include'
           AND (an.app_id IS NULL OR an.app_id = (SELECT id FROM target_app))
      ) AS included,
      EXISTS (
        SELECT 1 FROM app_node an
         WHERE an.node_id = n.id
           AND an.relation = 'exclude'
           AND (an.app_id IS NULL OR an.app_id = (SELECT id FROM target_app))
      ) AS excluded
    FROM node n
  ),
  tree AS (
    -- Wurzeln: nichts zu erben, es zaehlt allein die eigene Zugehoerigkeit
    SELECT
      f.id,
      f.parent_node_id,
      (f.included AND NOT f.excluded) AS member,
      1 AS depth,
      -- Cast noetig: ohne ihn ist der nicht-rekursive Term varchar(18)[], der
      -- rekursive varchar[] -- Postgres lehnt die Abfrage dann ab.
      ARRAY[f.id]::varchar[] AS path
    FROM flags f
    WHERE f.parent_node_id IS NULL
    UNION ALL
    SELECT
      c.id,
      c.parent_node_id,
      ((c.included OR (c.inherits AND t.member)) AND NOT c.excluded) AS member,
      t.depth + 1,
      t.path || c.id
    FROM flags c
    JOIN tree t ON c.parent_node_id = t.id
    WHERE NOT c.id = ANY(t.path)
  )`;

/** Sichtbare Knoten, flach — Basis für den Inhaltsbaum. */
const VISIBLE_NODES_SQL = `${VISIBLE_TREE_CTE}
SELECT
  n.id,
  n.name,
  n.description,
  n.sortnumber,
  n.reversed,
  n.parent_node_id,
  n.cover_node_id,
  n.legacy_id,
  n.published_date,
  t.depth
FROM tree t
JOIN node n ON n.id = t.id
WHERE t.member
ORDER BY t.depth, n.sortnumber NULLS LAST, n.id
`;

/**
 * Inhaltsquelle auf dem NEUEN Datenmodell (`node` / `content_node` /
 * `content_item`).
 *
 * Tritt gegen `LegacyContentRepository` an: solange die Charakterisierungstests
 * des Lesepfads für beide grün sind, ist die Umschaltung von außen nicht
 * beobachtbar.
 */
class NodeContentRepository extends ContentRepository {
  createConnector() {
    return new PostgresActions(this.environment);
  }

  /**
   * Publish-Schranke als SQL-Ausdruck, oder `null` für „kein Filter".
   *
   * Die drei Zustände von `publishDate` (siehe `ContentRepository`) werden hier
   * zu genau einem Ausdruck, der an mehreren Stellen derselben Abfrage
   * eingesetzt werden kann — ein gebundenes Datum bekommt dabei nur **einen**
   * Parameter, nicht je Verwendung einen.
   */
  buildPublishLimit(parameters) {
    if (this.publishDate === null) {
      return null;
    }
    if (this.publishDate === undefined) {
      // ABWEICHUNG VOM ALTMODELL (bewusst): dort vergleicht der Story-Pfad
      // gegen Mitternacht des heutigen Tages und der Kapitel-Pfad gegen NOW().
      // Eine heute um 09:00 veröffentlichte Story war deshalb erst am Folgetag
      // sichtbar, ihre gleichzeitig veröffentlichten Kapitel sofort. Hier
      // durchgehend NOW().
      return 'NOW()';
    }
    parameters.push(this.publishDate);
    return `$${parameters.length}`;
  }

  /** `<spalte> <= <schranke>` bzw. `TRUE`, wenn nicht gefiltert wird. */
  buildPublishCondition(column, limit) {
    return limit === null ? 'TRUE' : `${column} <= ${limit}`;
  }

  /**
   * Alle für den App-Schlüssel sichtbaren Knoten, flach und ungefiltert nach
   * `published_date`. Die Baumstruktur steckt in `parent_node_id` und `depth`.
   */
  async queryVisibleNodes() {
    const LOCATION = 'NodeContentRepository.queryVisibleNodes';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Querying visible nodes for application key: ${this.applicationKey}`,
    });

    // Der App-Schluessel ist gebunden, nicht konkateniert.
    return this.createConnector().executeParameterizedSql(
      VISIBLE_NODES_SQL,
      [this.applicationKey],
      { closeConnection: true }
    );
  }

  /**
   * Führt eine Abfrage aus und schließt danach die Verbindung.
   *
   * `applicationKey` ist immer `$1`; alles Weitere folgt in der Reihenfolge,
   * in der die Aufrufer es anhängen.
   */
  async execute(statement, parameters) {
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    return this.createConnector().executeParameterizedSql(
      statement,
      parameters,
      { closeConnection: true }
    );
  }

  /**
   * Story: der Knoten selbst plus seine Kind-Knoten als Kapitel-Kopfdaten.
   *
   * Die eingehende Id darf die **alte** (`000s…`, über `legacy_id`) oder die
   * neue sein. Nach außen geht immer die alte zurück, solange es eine gibt —
   * daran hängen Deep-Links, Cache-Keys und die Präfix-Typisierung im Frontend.
   */
  async getStory(storyId) {
    const parameters = [this.applicationKey, storyId];
    const limit = this.buildPublishLimit(parameters);
    const statement = `${VISIBLE_TREE_CTE}
SELECT
  n.id, n.name, n.sortnumber, n.legacy_id, n.published_date,
  cover.id AS cover_id, cover.legacy_id AS cover_legacy_id,
  (n.legacy_id = $2 OR n.id = $2) AS is_target
FROM tree t
JOIN node n ON n.id = t.id
LEFT JOIN node cover ON cover.id = n.cover_node_id
WHERE t.member
  AND ${this.buildPublishCondition('n.published_date', limit)}
  AND (
    n.legacy_id = $2 OR n.id = $2
    OR n.parent_node_id = (SELECT id FROM node WHERE legacy_id = $2 OR id = $2)
  )
ORDER BY is_target DESC, n.sortnumber ASC NULLS LAST, n.legacy_id ASC NULLS LAST, n.id ASC
`;

    const rows = await this.execute(statement, parameters);
    // Kein sichtbarer Zielknoten -> leeres Objekt, wie im Altmodell. Die
    // Sortierung stellt den Zielknoten nach vorn, sonst ist er nicht dabei.
    if (rows.length === 0 || !rows[0].is_target) {
      return {};
    }

    const [storyRow, ...chapterRows] = rows;
    return {
      id: outwardId(storyRow),
      name: storyRow.name ?? null,
      // Fehlende Werte kommen als null, nicht als undefined: undefined
      // verschwindet beim Serialisieren spurlos aus der Antwort, null nicht.
      // Das Altmodell liefert hier die Postgres-NULLs durch.
      lastupdate: null,
      sortnumber: storyRow.sortnumber ?? null,
      publishdate: storyRow.published_date ?? null,
      coverid: storyRow.cover_legacy_id || storyRow.cover_id || null,
      chapters: chapterRows.map((row) =>
        headData({
          id: outwardId(row),
          name: row.name,
          sortnumber: row.sortnumber,
        })
      ),
    };
  }

  /**
   * Kapitel: der Knoten plus die Kopfdaten seiner `content_node`-Zeilen —
   * ausdrücklich **ohne** Inhalt, genau wie im Altmodell.
   */
  async getChapter(chapterId) {
    const parameters = [this.applicationKey, chapterId];
    const limit = this.buildPublishLimit(parameters);
    const statement = `${VISIBLE_TREE_CTE}
SELECT
  n.id, n.name, n.sortnumber, n.reversed, n.legacy_id, n.published_date,
  parent.id AS parent_id, parent.legacy_id AS parent_legacy_id,
  cn.id AS content_id, cn.legacy_id AS content_legacy_id,
  cn.name AS content_name, cn.sortnumber AS content_sortnumber
FROM tree t
JOIN node n ON n.id = t.id
LEFT JOIN node parent ON parent.id = n.parent_node_id
LEFT JOIN content_node cn
       ON cn.node_id = n.id
      AND ${this.buildPublishCondition('cn.published_date', limit)}
WHERE t.member
  AND (n.legacy_id = $2 OR n.id = $2)
  AND ${this.buildPublishCondition('n.published_date', limit)}
-- Der Tiebreaker ist nicht kosmetisch: bei gleicher sortnumber sortiert das
-- Altmodell gar nicht weiter, die Reihenfolge ist dort die physische
-- Zeilenreihenfolge und damit Zufall. legacy_id folgt der Anlagereihenfolge und
-- macht das Ergebnis reproduzierbar.
ORDER BY cn.sortnumber ASC NULLS LAST, cn.legacy_id ASC NULLS LAST, cn.id ASC
`;

    const rows = await this.execute(statement, parameters);
    if (rows.length === 0) {
      return {};
    }

    const chapterRow = rows[0];
    return {
      id: outwardId(chapterRow),
      storyid: chapterRow.parent_legacy_id || chapterRow.parent_id || null,
      name: chapterRow.name ?? null,
      lastupdate: null,
      sortnumber: chapterRow.sortnumber ?? null,
      reversed: chapterRow.reversed ?? null,
      publishdate: chapterRow.published_date ?? null,
      // Der LEFT JOIN liefert bei einem Kapitel ohne Absätze eine Zeile mit
      // leeren content_-Spalten — die darf kein leerer Absatz werden.
      paragraphs: rows
        .filter((row) => row.content_id)
        .map((row) =>
          headData({
            id: row.content_legacy_id || row.content_id,
            name: row.content_name,
            sortnumber: row.content_sortnumber,
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
    const parameters = [this.applicationKey, paragraphId];
    const limit = this.buildPublishLimit(parameters);
    const statement = `${VISIBLE_TREE_CTE}
SELECT
  cn.id, cn.name, cn.sortnumber, cn.legacy_id, cn.published_date,
  cn.active_content_item,
  n.id AS chapter_id, n.legacy_id AS chapter_legacy_id,
  story.id AS story_id, story.legacy_id AS story_legacy_id,
  ci.id AS item_id, ci.type AS item_type, ci.content AS item_content
FROM tree t
JOIN node n ON n.id = t.id
JOIN content_node cn ON cn.node_id = n.id
LEFT JOIN node story ON story.id = n.parent_node_id
LEFT JOIN content_item ci ON ci.content_node_id = cn.id
WHERE t.member
  AND (cn.legacy_id = $2 OR cn.id = $2)
  AND ${this.buildPublishCondition('cn.published_date', limit)}
`;

    const rows = await this.execute(statement, parameters);
    if (rows.length === 0) {
      return {};
    }

    const first = rows[0];
    const textItem = rows.find((row) => row.item_type === 'text');
    const activeItem = rows.find(
      (row) => row.item_id && row.item_id === first.active_content_item
    );

    return {
      id: first.legacy_id || first.id,
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
      chapterid: first.chapter_legacy_id || first.chapter_id || null,
      storyid: first.story_legacy_id || first.story_id || null,
      publishdate: first.published_date ?? null,
    };
  }
}

/** Nach außen gilt die alte Id, solange es eine gibt. */
function outwardId(row) {
  return row.legacy_id || row.id;
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

module.exports = { NodeContentRepository, VISIBLE_NODES_SQL, VISIBLE_TREE_CTE };
