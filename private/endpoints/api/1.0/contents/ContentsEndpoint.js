const { Logging } = require('../../../../modules/logging');
const { EndpointLogic } = require('../../../EndpointLogic');
const { DataFacade } = require('../../../../database2/DataFacade');
const { SubtreeExclusion } = require('../../../../modules/SubtreeExclusion');

// No depth given: the whole tree, however deep it is.
const FULL_DEPTH = Infinity;

/**
 * GET /api/1.0/contents/* — delivers the navigation as a tree of Nodes.
 *
 * Node = { id, label, name, childnodes: Node[] }  (label is a copy of name)
 *
 * - The DataFacade hands out the published tree; it owns the publish filter.
 * - edit scope: fresh tree (cache skipped) including unpublished nodes, asked
 *   for explicitly through setIncludeUnpublished(true).
 * - The feed root named by the configuration (`feedRootNodeId`) is left out
 *   together with its feeds — for every scope. It is shown by the feed
 *   component, not by the navigation. The exclusion happens here and not in the
 *   facade: the sitemap reads the same tree and keeps the feeds.
 * - ?depth=N trims the tree to N levels (default: full depth).
 */
class ContentsEndpoint extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.ContentsEndpoint.execute';

    Logging.debugMessage({
      severity: 'INFO',
      message: 'Executing contents tree query',
      location: LOCATION,
    });

    const isEdit = this.scopes?.has('edit');
    const depth = ContentsEndpoint.parseDepth(this.requestObject?.query?.depth);

    const dataFacade = new DataFacade(this.environment);
    if (isEdit) {
      dataFacade.setSkipCache(true);
      dataFacade.setIncludeUnpublished(true);
    }

    const tree = await dataFacade.getData({
      returnPromise: true,
      request: { table: 'contents', id: null },
    });
    const configuration = await dataFacade.getData({
      returnPromise: true,
      request: { table: 'configuration' },
    });

    Logging.debugMessage({
      severity: 'FINER',
      message: `Contents tree returned (edit: ${!!isEdit}, depth: ${depth})`,
      location: LOCATION,
    });

    const navigationTree = new SubtreeExclusion()
      .setTree(tree)
      .setExcludedId(configuration?.feedRootNodeId)
      .getResult();

    const nodes = ContentsEndpoint.mapToNodes(navigationTree, depth);
    this.responseObject.json({ result: nodes });
  }

  /**
   * Tolerant parsing: missing / non-numeric / < 1 falls back to full depth.
   * A valid value only trims; the tree itself has no upper bound.
   */
  static parseDepth(raw) {
    if (raw === undefined || raw === null || raw === '') {
      return FULL_DEPTH;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
      return FULL_DEPTH;
    }
    return value;
  }

  /**
   * Maps raw node records to Node objects. Allow-list mapping, so
   * published_date and internal columns never reach the response.
   */
  static mapToNodes(records, depth) {
    if (!Array.isArray(records)) {
      return [];
    }
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      label: record.name,
      childnodes:
        depth > 1 ? ContentsEndpoint.mapToNodes(record.nodes, depth - 1) : [],
    }));
  }
}

module.exports = ContentsEndpoint;
