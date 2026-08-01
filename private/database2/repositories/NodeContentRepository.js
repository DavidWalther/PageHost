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
const VISIBLE_NODES_SQL = `
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
  )
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
}

module.exports = { NodeContentRepository, VISIBLE_NODES_SQL };
