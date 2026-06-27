const { Logging } = require('../../../../modules/logging');
const { EndpointLogic } = require('../../../EndpointLogic');
const { DataFacade } = require('../../../../database2/DataFacade');
const ContentVisibilityFilter = require('../../../../modules/ContentVisibilityFilter');

// Currently available levels: stories -> chapters. Raised when deeper levels
// (parent/grandparent stories) get a data model.
const MAX_DEPTH = 2;

/**
 * GET /api/1.0/contents/* — delivers the navigation as a tree of Nodes.
 *
 * Node = { id, label, name, childnodes: Node[] }  (label is a copy of name)
 *
 * - The DataFacade returns the full tree (published + unpublished).
 * - edit scope: fresh tree (cache skipped), no publish filtering.
 * - otherwise: cached tree, unpublished nodes removed at delivery time via the
 *   shared ContentVisibilityFilter.
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

    let dataFacade = new DataFacade(this.environment);
    if (isEdit) {
      dataFacade.setSkipCache(true);
    }

    let parameterObject = {
      returnPromise: true,
      request: { table: 'contents', id: null },
    };

    return dataFacade.getData(parameterObject).then((rawTree) => {
      Logging.debugMessage({
        severity: 'FINER',
        message: `Contents tree returned (edit: ${!!isEdit}, depth: ${depth})`,
        location: LOCATION,
      });

      const visibleTree = isEdit
        ? rawTree
        : new ContentVisibilityFilter()
            .setTree(rawTree)
            .setChildrenKey('chapters')
            .setDate(new Date())
            .getResult();

      const nodes = ContentsEndpoint.mapToNodes(visibleTree, depth);
      this.responseObject.json({ result: nodes });
    });
  }

  /**
   * Tolerant parsing: missing / non-numeric / < 1 falls back to full depth.
   */
  static parseDepth(raw) {
    if (raw === undefined || raw === null || raw === '') {
      return MAX_DEPTH;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
      return MAX_DEPTH;
    }
    return Math.min(value, MAX_DEPTH);
  }

  /**
   * Maps raw records (story/chapter) to Node objects. Allow-list mapping, so
   * publishdate / application* fields never reach the response.
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
        depth > 1
          ? ContentsEndpoint.mapToNodes(record.chapters, depth - 1)
          : [],
    }));
  }
}

module.exports = { ContentsEndpoint };
