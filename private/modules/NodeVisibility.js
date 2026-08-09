/**
 * Auflösung der App-Zugehörigkeit über den Knotenbaum.
 *
 * Setzt die Regel aus `doc/datamodel-overhaul/datamodel.md` Abschnitt 5 um:
 *
 *   member(node, K) ⟺ ( include für K ODER include-Wildcard
 *                       ODER (is_parent_controls_visibility UND member(parent, K)) )
 *                     UND NICHT ( exclude für K ODER exclude-Wildcard )
 *
 * **Warum in JavaScript und nicht in SQL.** Als rekursive CTE war dieselbe Regel
 * zwar korrekt, aber praktisch nicht prüfbar: gegen 60 Zeilen Rekursion beweist
 * ein `expect(sql).toContain(…)` nichts. Belegt hat das ein fehlender Typ-Cast —
 * die Abfrage bestand jede String-Zusicherung und war trotzdem nicht ausführbar.
 * Hier ist jede Zeile der Wahrheitstabelle ein gewöhnlicher Unit-Test ohne
 * Datenbank.
 *
 * **Abgrenzung: nur die App-Dimension.** `published_date` bleibt außen vor. Der
 * Publish-Filter wirkt an anderer Stelle — beim Einzelabruf im Repository, beim
 * Inhaltsbaum erst bei der Auslieferung (`ContentVisibilityFilter`), damit
 * derselbe Baum auch für andere Zwecke nutzbar bleibt.
 *
 * Erwartete Zeilenformen (so, wie Postgres sie liefert):
 *   nodes:    { id, parent_node_id, is_parent_controls_visibility, … }
 *   appNodes: { node_id, relation, app_name }   — app_name null = Wildcard
 */
class NodeVisibility {
  constructor({ nodes = [], appNodes = [] } = {}) {
    this.nodes = nodes;
    this.nodesById = new Map(nodes.map((node) => [node.id, node]));
    this.childrenByParent = new Map();
    nodes.forEach((node) => {
      const parentId = node.parent_node_id;
      if (!parentId) {
        return;
      }
      if (!this.childrenByParent.has(parentId)) {
        this.childrenByParent.set(parentId, []);
      }
      this.childrenByParent.get(parentId).push(node);
    });

    this.relations = new Map();
    appNodes.forEach((row) => {
      if (!this.relations.has(row.node_id)) {
        this.relations.set(row.node_id, []);
      }
      this.relations.get(row.node_id).push(row);
    });

    this.cache = new Map();
  }

  getNode(nodeId) {
    return this.nodesById.get(nodeId);
  }

  /** Kind-Knoten in Anlage-unabhängiger, stabiler Reihenfolge. */
  childrenOf(nodeId) {
    return [...(this.childrenByParent.get(nodeId) || [])];
  }

  /**
   * Findet einen Knoten über die alte **oder** die neue Id. Die Kompat-Schicht
   * bekommt `000s…`/`000c…` herein und muss beides auflösen können.
   */
  findByAnyId(id) {
    if (!id) {
      return undefined;
    }
    return (
      this.nodesById.get(id) || this.nodes.find((node) => node.legacy_id === id)
    );
  }

  hasRelation(nodeId, relation, applicationKey) {
    const rows = this.relations.get(nodeId) || [];
    return rows.some(
      (row) =>
        row.relation === relation &&
        // app_name null ist die Wildcard-Zeile: sie gilt für JEDE App, auch
        // für einen Schlüssel, zu dem es gar keine app-Zeile gibt. Genau so
        // verhielt sich '*' im Altmodell.
        (row.app_name === null ||
          row.app_name === undefined ||
          row.app_name === applicationKey)
    );
  }

  /**
   * Ids aller Knoten, die für diesen App-Schlüssel sichtbar sind.
   *
   * Läuft von den Wurzeln nach unten — dieselbe Verankerung wie die frühere
   * rekursive CTE. Ein Knoten, dessen Elternkette nicht an einer Wurzel endet
   * (verwaist oder in einem Zyklus), wird dabei **nie erreicht** und ist damit
   * nicht sichtbar. Das ist beabsichtigt: im Altmodell fielen solche Knoten beim
   * Zusammenbau des Baums genauso heraus.
   */
  visibleNodeIds(applicationKey) {
    if (this.cache.has(applicationKey)) {
      return this.cache.get(applicationKey);
    }

    const visible = new Set();
    const seen = new Set();
    const roots = this.nodes.filter((node) => !node.parent_node_id);
    const queue = roots.map((node) => ({ node, parentIsMember: false }));

    while (queue.length > 0) {
      const { node, parentIsMember } = queue.shift();
      // Zyklus-Schutz: jeder Knoten wird höchstens einmal besucht. Ohne ihn
      // liefe die Schleife bei A -> B -> A endlos.
      if (seen.has(node.id)) {
        continue;
      }
      seen.add(node.id);

      const included = this.hasRelation(node.id, 'include', applicationKey);
      const excluded = this.hasRelation(node.id, 'exclude', applicationKey);
      const inherits = node.is_parent_controls_visibility === true;
      const isMember = (included || (inherits && parentIsMember)) && !excluded;

      if (isMember) {
        visible.add(node.id);
      }

      this.childrenOf(node.id).forEach((child) => {
        // Auch nicht sichtbare Knoten werden weiterverfolgt: ein Kind kann per
        // eigenem include sichtbar sein, obwohl sein Parent es nicht ist.
        queue.push({ node: child, parentIsMember: isMember });
      });
    }

    this.cache.set(applicationKey, visible);
    return visible;
  }

  /** Sichtbare Knoten als Datensätze, in der Reihenfolge der Eingabe. */
  visibleNodes(applicationKey) {
    const visible = this.visibleNodeIds(applicationKey);
    return this.nodes.filter((node) => visible.has(node.id));
  }

  isVisible(nodeId, applicationKey) {
    return this.visibleNodeIds(applicationKey).has(nodeId);
  }
}

module.exports = { NodeVisibility };
