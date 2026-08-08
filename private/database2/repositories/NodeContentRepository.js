const { ContentRepository } = require('./ContentRepository.js');
const { PostgresActions } = require('../DataStorage/pgConnector.js');
const { NodeVisibility } = require('../../modules/NodeVisibility.js');
const { NodeWriteMapping } = require('../../modules/NodeWriteMapping.js');
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
 * Die Inhaltsquelle: `node` / `content_node` / `content_item`.
 *
 * **Reihenfolge der Verarbeitung** — die Sichtbarkeit wird direkt nach der
 * Abfrage aufgelöst, noch vor dem Mapping und damit weit vor dem Cache: was die
 * `DataFacade` unter einem Cache-Schlüssel ablegt, ist bereits gefiltert.
 *
 * Nach außen gilt die Id des Datensatzes. Die Spalte `legacy_id` bleibt, weil
 * sie der einzige Ort ist, an dem ein Deep-Link von früher noch auflösbar ist —
 * eingehend wird sie mitgeprüft, ausgehend steht sie als Feld daneben.
 */
class NodeContentRepository extends ContentRepository {
  /**
   * Der Zugang zur Datenbank — **einer je Repository**.
   *
   * Ein Repository lebt genau eine Anfrage lang; damit gilt: eine Anfrage, ein
   * Zugang. Vorher baute jeder Aufruf einen neuen, und solange jeder davon
   * seinen eigenen Pool mitbrachte, kostete das je Inhalts-Abruf einen zweiten
   * Handshake. Seit der Pool geteilt wird, kostet es nichts mehr — die Regel
   * bleibt trotzdem, damit sie nicht wieder etwas kostet, wenn jemand den Pool
   * zurück an die Instanz hängt.
   */
  createConnector() {
    if (!this.connector) {
      this.connector = new PostgresActions(this.environment);
    }
    return this.connector;
  }

  /** Lädt Knoten und Zugehörigkeiten und gibt die Auflösung zurück. */
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
    const appNodes = await connector.executeParameterizedSql(APP_NODES_SQL, []);

    this.visibility = new NodeVisibility({ nodes, appNodes });
    return this.visibility;
  }

  /** Führt eine Abfrage über den geteilten Pool aus. */
  async execute(statement, parameters) {
    return this.createConnector().executeParameterizedSql(
      statement,
      parameters
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
   * Inhaltsbaum: Wurzelknoten mit ihren Kindern unter `nodes`.
   *
   * **Kein Publish-Filter.** Der Baum enthält veröffentlichte wie
   * unveröffentlichte Knoten; gefiltert wird erst bei der Auslieferung durch den
   * `ContentVisibilityFilter`. Nur so bleibt dieselbe Quelle auch für andere
   * Zwecke — etwa `sitemap.xml` — brauchbar. Die App-Zugehörigkeit ist dagegen
   * bereits aufgelöst.
   *
   * **Zwei Ebenen.** Der Baum kann tiefer sein; hier werden Enkel weggelassen,
   * passend zu `MAX_DEPTH = 2` im `ContentsEndpoint`.
   */
  async getContentsTree() {
    const visibility = await this.loadVisibility();
    const visible = visibility.visibleNodes(this.applicationKey);
    const visibleIds = new Set(visible.map((node) => node.id));

    return sortSiblings(visible.filter((node) => !node.parent_node_id)).map(
      (root) => ({
        ...nodeFields(root),
        nodes: sortSiblings(
          visibility
            .childrenOf(root.id)
            .filter((child) => visibleIds.has(child.id))
        ).map(nodeFields),
      })
    );
  }

  /**
   * Ein Knoten mit seinen Kind-Knoten und seinen Inhalts-Kopfdaten.
   *
   * Ein Knoten mit Kindern und ohne Inhalte hieß früher Story, einer mit
   * Inhalten und ohne Kinder Kapitel. Beides beantwortet derselbe Aufruf, weil
   * das Modell die Unterscheidung nicht kennt.
   *
   * Die eingehende Id darf die neue oder die alte sein.
   */
  async getNode(nodeId) {
    const visibility = await this.loadVisibility();
    const node = visibility.findByAnyId(nodeId);
    if (!this.isDeliverable(node, visibility)) {
      return {};
    }

    const contentNodes = await this.execute(CONTENT_NODES_SQL, [node.id]);

    return {
      ...nodeFields(node),
      nodes: sortSiblings(
        visibility
          .childrenOf(node.id)
          .filter((child) => this.isDeliverable(child, visibility))
      ).map(nodeFields),
      // Der Inhalts-Halter hat keine eigene App-Zugehörigkeit; er folgt seinem
      // Knoten, und der ist an dieser Stelle bereits als sichtbar erwiesen.
      contents: sortSiblings(
        contentNodes.filter((row) => this.isPublished(row))
      ).map(contentHeadFields),
    };
  }

  /**
   * Ein Inhalt mit **allen** seinen Repräsentationen.
   *
   * Die Datenschicht entscheidet **nicht**, welche Fassung gilt — sie liefert
   * alle und dazu den Zeiger auf die aktive. Ein künftiger Typ (`markdown`,
   * `mermaid`) braucht damit keine Änderung an dieser Stelle.
   */
  async getContent(contentId) {
    const visibility = await this.loadVisibility();
    const rows = await this.execute(CONTENT_SQL, [contentId]);
    if (rows.length === 0) {
      return {};
    }

    const first = rows[0];
    const node = visibility.getNode(first.node_id);
    if (!this.isDeliverable(node, visibility) || !this.isPublished(first)) {
      return {};
    }

    // Ein Halter ohne Repräsentation ist möglich (LEFT JOIN): dann trägt die
    // einzige Zeile leere Item-Spalten und `items` bleibt leer.
    const items = rows.filter((row) => row.item_id);

    return {
      ...contentHeadFields(first),
      node_id: first.node_id,
      active_content_item: first.active_content_item ?? null,
      active_type:
        items.find((row) => row.item_id === first.active_content_item)
          ?.item_type ?? null,
      items: items.map((row) => ({
        id: row.item_id,
        type: row.item_type,
        content: row.item_content ?? null,
      })),
    };
  }

  // ─── Schreibpfad ─────────────────────────────────────────────────────────

  /**
   * Löst eine eingehende Id auf die Id im neuen Modell auf.
   *
   * Herein kommt beides: die alte Id aus einem Deep-Link oder einem gelesenen
   * Datensatz, oder die neue. Nach innen gilt immer die neue.
   */
  async resolveId(run, object, incomingId) {
    if (!incomingId) {
      return null;
    }
    const table = NodeWriteMapping.tableFor(object);
    const rows = await run(
      `SELECT id FROM ${table} WHERE legacy_id = $1 OR id = $1`,
      [incomingId]
    );
    return rows.length ? rows[0].id : null;
  }

  /**
   * Löst die Referenz-Spalten eines Payloads auf.
   *
   * `parent_node_id` und `cover_node_id` zeigen auf Knoten, `node_id` eines
   * Absatzes ebenfalls — hereinkommen kann dort überall eine alte Id.
   */
  async resolveReferences(run, columns) {
    const resolved = { ...columns };
    for (const column of NodeWriteMapping.referenceColumns(columns)) {
      const value = resolved[column];
      if (!value) {
        continue;
      }
      // Alle drei Referenz-Spalten zeigen auf einen Knoten — auch `node_id`
      // eines Inhalts.
      const target = await this.resolveId(run, 'node', value);
      if (!target) {
        throw new Error(`Referenced node not found: ${value}`);
      }
      resolved[column] = target;
    }
    return resolved;
  }

  async createRecord(object, payload) {
    const LOCATION = 'NodeContentRepository.createRecord';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Creating ${object}`,
    });

    return this.createConnector().transaction(async (run) =>
      NodeWriteMapping.isNodeObject(object)
        ? this.createNode(run, object, payload)
        : this.createContent(run, object, payload)
    );
  }

  /** Story oder Kapitel: eine Zeile in `node`, dazu ihre App-Zugehörigkeit. */
  async createNode(run, object, payload) {
    const columns = await this.resolveReferences(
      run,
      NodeWriteMapping.columnsFor(object, payload)
    );

    // Vererbung ist der Normalfall (`datamodel.md` Abschnitt 4). Die
    // Bestandsknoten tragen bis Schritt 13a `false`, weil die Kopie die alten
    // App-Spalten Knoten für Knoten abgebildet hat — für Neuanlagen gilt die
    // Regel des Zielmodells.
    const withDefaults = {
      ...columns,
      is_parent_controls_visibility: true,
    };
    const insert = insertClause(withDefaults);
    const [node] = await run(
      `INSERT INTO node (${insert.names}) VALUES (${insert.placeholders}) RETURNING *`,
      insert.values
    );

    // Ein Wurzelknoten hat keinen Parent, von dem er erben könnte, und wäre
    // ohne eigene Zeile in keiner App sichtbar. Die Entsprechung des alten
    // `applicationIncluded = <eigener Schlüssel>`.
    if (!withDefaults.parent_node_id) {
      await this.addAppInclude(run, node.id);
    }

    return this.outwardRecord(object, node);
  }

  /** Absatz: `content_node` plus je Repräsentation eine `content_item`-Zeile. */
  async createContent(run, object, payload) {
    const columns = await this.resolveReferences(
      run,
      NodeWriteMapping.columnsFor(object, payload)
    );
    if (!columns.node_id) {
      throw new Error('Creating a paragraph requires a chapter reference');
    }

    const insert = insertClause(columns);
    const [contentNode] = await run(
      `INSERT INTO content_node (${insert.names}) VALUES (${insert.placeholders}) RETURNING *`,
      insert.values
    );

    await this.writeContentItems(run, contentNode.id, payload);
    return this.outwardRecord(object, contentNode);
  }

  /**
   * Schreibt die Repräsentationen eines Absatzes und setzt den Zeiger auf die
   * aktive.
   *
   * Je `content_node` höchstens eine Zeile pro Typ — das erzwingt
   * `content_item_node_type_unique`, weshalb hier `ON CONFLICT` greift statt
   * einer Vorab-Abfrage. Trägt der Payload gar keinen Inhalt (etwa beim reinen
   * Umbenennen), bleibt alles, wie es ist.
   */
  async writeContentItems(run, contentNodeId, payload) {
    const { items, activeType } = NodeWriteMapping.contentItemsFor(payload);
    if (activeType === null) {
      return;
    }

    for (const [type, content] of Object.entries(items)) {
      await run(
        `INSERT INTO content_item (content_node_id, type, content)
         VALUES ($1, $2, $3)
         ON CONFLICT (content_node_id, type) DO UPDATE SET content = EXCLUDED.content`,
        [contentNodeId, type, content]
      );
    }

    await run(
      `UPDATE content_node SET active_content_item = (
         SELECT id FROM content_item WHERE content_node_id = $1 AND type = $2
       ) WHERE id = $1`,
      [contentNodeId, activeType]
    );
  }

  /** `include`-Zeile für die eigene App; doppelte Aufrufe bleiben wirkungslos. */
  async addAppInclude(run, nodeId) {
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    await run(
      `INSERT INTO app_node (node_id, app_id, relation)
       SELECT $1, a.id, 'include' FROM app a WHERE a.name = $2
       ON CONFLICT (app_id, node_id, relation) WHERE app_id IS NOT NULL
       DO NOTHING`,
      [nodeId, this.applicationKey]
    );
  }

  async updateRecord(object, payload) {
    const LOCATION = 'NodeContentRepository.updateRecord';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Updating ${object} ${payload?.id}`,
    });

    if (!payload || !payload.id) {
      throw new Error('Update requires an id');
    }

    return this.createConnector().transaction(async (run) => {
      const table = NodeWriteMapping.tableFor(object);
      const isNode = NodeWriteMapping.isNodeObject(object);
      const recordId = await this.resolveId(run, object, payload.id);
      if (!recordId) {
        throw new Error(`Record not found: ${payload.id}`);
      }

      const columns = await this.resolveReferences(
        run,
        NodeWriteMapping.columnsFor(object, payload)
      );

      let record;
      if (Object.keys(columns).length > 0) {
        const update = updateClause(columns);
        [record] = await run(
          `UPDATE ${table} SET ${update.assignments} WHERE id = $${
            update.values.length + 1
          } RETURNING *`,
          [...update.values, recordId]
        );
      } else {
        // Ein Payload ohne setzbare Felder ist kein Fehler — der Absatz
        // schickt auch dann seinen ganzen Datensatz, wenn sich nur der
        // Inhalt geändert hat.
        [record] = await run(`SELECT * FROM ${table} WHERE id = $1`, [
          recordId,
        ]);
      }

      if (!isNode) {
        await this.writeContentItems(run, recordId, payload);
      }

      return this.outwardRecord(object, record);
    });
  }

  /**
   * Löscht mehrstufig in der Reihenfolge, die `ON DELETE RESTRICT` erzwingt.
   *
   * Beim Knoten gehört der **ganze Teilbaum** dazu: Kinder, deren Inhalte und
   * die App-Zeilen. Das ist eine bewusste Änderung gegenüber dem alten
   * einstufigen `DELETE`, das Kinder verwaisen ließ — im neuen Modell würde es
   * schlicht am Fremdschlüssel scheitern.
   *
   * `cover_node_id` wird auch **außerhalb** des Teilbaums genullt: ein
   * Geschwisterknoten darf nicht auf einen gelöschten Knoten zeigen.
   *
   * **Zurück kommt, was gelöscht wurde** — Knoten und Inhalte, jeweils mit
   * beiden Ids. Die `DataFacade` braucht das, um die Cache-Einträge
   * abzuräumen: beim Löschen eines Teilbaums sind das nicht nur die des
   * angefragten Knotens.
   */
  async deleteRecord(object, id) {
    const LOCATION = 'NodeContentRepository.deleteRecord';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Deleting ${object} ${id}`,
    });

    return this.createConnector().transaction(async (run) => {
      const recordId = await this.resolveId(run, object, id);
      if (!recordId) {
        throw new Error(`Record not found: ${id}`);
      }

      if (!NodeWriteMapping.isNodeObject(object)) {
        const [content] = await run(
          `SELECT id, legacy_id FROM content_node WHERE id = $1`,
          [recordId]
        );
        await this.deleteContentNodes(run, [recordId]);
        return { nodes: [], contents: content ? [content] : [] };
      }

      // Teilbaum, tiefste Ebene zuerst — Kinder vor Eltern.
      const subtree = await run(
        `WITH RECURSIVE descendants AS (
             SELECT id, legacy_id, 0 AS depth FROM node WHERE id = $1
             UNION ALL
             SELECT n.id, n.legacy_id, d.depth + 1
             FROM node n JOIN descendants d ON n.parent_node_id = d.id
           )
           SELECT id, legacy_id FROM descendants ORDER BY depth DESC`,
        [recordId]
      );
      const nodeIds = subtree.map((row) => row.id);

      const contentNodes = await run(
        `SELECT id, legacy_id FROM content_node WHERE node_id = ANY($1)`,
        [nodeIds]
      );
      await this.deleteContentNodes(
        run,
        contentNodes.map((row) => row.id)
      );

      await run(
        `UPDATE node SET cover_node_id = NULL WHERE cover_node_id = ANY($1)`,
        [nodeIds]
      );
      await run(`DELETE FROM app_node WHERE node_id = ANY($1)`, [nodeIds]);

      // Einzeln in Tiefenreihenfolge: parent_node_id ist RESTRICT, ein
      // Sammel-DELETE prüft die Bedingung je Zeile und träfe die Eltern
      // womöglich zuerst.
      for (const nodeId of nodeIds) {
        await run(`DELETE FROM node WHERE id = $1`, [nodeId]);
      }

      return { nodes: subtree, contents: contentNodes };
    });
  }

  /** `active_content_item` lösen, dann Items, dann die Halter. */
  async deleteContentNodes(run, contentNodeIds) {
    if (contentNodeIds.length === 0) {
      return;
    }
    await run(
      `UPDATE content_node SET active_content_item = NULL WHERE id = ANY($1)`,
      [contentNodeIds]
    );
    await run(`DELETE FROM content_item WHERE content_node_id = ANY($1)`, [
      contentNodeIds,
    ]);
    await run(`DELETE FROM content_node WHERE id = ANY($1)`, [contentNodeIds]);
  }

  /** Antwort eines Schreibvorgangs — die Zeile, wie sie jetzt in der DB steht. */
  outwardRecord(object, record) {
    return record ? { ...record } : {};
  }
}

/**
 * Ein Knoten in der neuen Antwortform — für den angefragten Knoten und für
 * seine Kinder dieselbe Auswahl, damit ein Kind ohne zweiten Aufruf schon
 * darstellbar ist.
 *
 * `is_parent_controls_visibility` fehlt bewusst: die Sichtbarkeit ist an dieser
 * Stelle bereits aufgelöst, die Regel dahinter geht den Client nichts an.
 */
function nodeFields(node) {
  return {
    id: node.id,
    legacy_id: node.legacy_id ?? null,
    name: node.name ?? null,
    description: node.description ?? null,
    sortnumber: node.sortnumber ?? null,
    reversed: node.reversed ?? null,
    parent_node_id: node.parent_node_id ?? null,
    cover_node_id: node.cover_node_id ?? null,
    published_date: node.published_date ?? null,
  };
}

/** Kopfdaten eines Inhalts-Halters — ohne die Repräsentationen. */
function contentHeadFields(row) {
  return {
    id: row.id,
    legacy_id: row.legacy_id ?? null,
    name: row.name ?? null,
    sortnumber: row.sortnumber ?? null,
    published_date: row.published_date ?? null,
  };
}

/** Wert-Liste für ein INSERT: Spaltennamen und gebundene Platzhalter. */
function insertClause(columns, firstPlaceholder = 1) {
  const names = Object.keys(columns);
  const placeholders = names.map((_, index) => `$${firstPlaceholder + index}`);
  return {
    names: names.join(', '),
    placeholders: placeholders.join(', '),
    values: names.map((name) => columns[name]),
  };
}

/** SET-Liste für ein UPDATE: `spalte = $n`, Werte gebunden. */
function updateClause(columns, firstPlaceholder = 1) {
  const names = Object.keys(columns);
  return {
    assignments: names
      .map((name, index) => `${name} = $${firstPlaceholder + index}`)
      .join(', '),
    values: names.map((name) => columns[name]),
  };
}

/**
 * Geschwister-Reihenfolge: `sortnumber` aufsteigend, leere Werte ans Ende.
 *
 * Der Tiebreaker ist nicht kosmetisch: bei gleicher `sortnumber` entschiede
 * sonst die physische Zeilenreihenfolge, also Zufall. Die Id folgt der
 * Anlagereihenfolge und macht das Ergebnis reproduzierbar.
 */
function sortSiblings(records) {
  return [...records].sort((first, second) => {
    const firstSort = first.sortnumber ?? Number.MAX_SAFE_INTEGER;
    const secondSort = second.sortnumber ?? Number.MAX_SAFE_INTEGER;
    if (firstSort !== secondSort) {
      return firstSort - secondSort;
    }
    return String(first.id).localeCompare(String(second.id));
  });
}

module.exports = {
  NodeContentRepository,
  NODES_SQL,
  APP_NODES_SQL,
  CONTENT_NODES_SQL,
  CONTENT_SQL,
};
