/**
 * Decides whether a node may be moved below a new parent.
 *
 * Pure functions, no database — the same split as `NodeVisibility` and
 * `NodeWriteMapping`: the rule is testable without Postgres, the repository
 * reads the chains and applies it.
 *
 * A move is rejected when
 * - the new parent is the node itself or one of its descendants. Such a node
 *   hangs off no root any more; the tree is built from the roots down, never
 *   reaches it, and the whole subtree silently drops out.
 * - the node is the feed root or lies below it. The feeds are the start page,
 *   read as the children of the feed root (`feedRootNodeId`).
 * - the new parent is the feed root or lies below it.
 *
 * Chains list a node and its ancestors, the node first. The target chain of a
 * move to the top level is empty.
 */
class NodeMoveRejected extends Error {
  constructor(message) {
    super(message);
    this.name = 'NodeMoveRejected';
  }
}

class NodeMoveRule {
  /**
   * Throws `NodeMoveRejected` when the move is not allowed.
   *
   * @param {object} move
   * @param {string} move.nodeId the node to move
   * @param {string[]} move.sourceChain the node and its ancestors
   * @param {string[]} move.targetChain the new parent and its ancestors
   * @param {string|null} [move.feedRootId] the configured feed root
   */
  static check({ nodeId, sourceChain = [], targetChain = [], feedRootId }) {
    if (targetChain.includes(nodeId)) {
      throw new NodeMoveRejected('A node cannot be moved below itself');
    }
    if (feedRootId && sourceChain.includes(feedRootId)) {
      throw new NodeMoveRejected('The feeds cannot be moved');
    }
    if (feedRootId && targetChain.includes(feedRootId)) {
      throw new NodeMoveRejected('A node cannot be moved into the feeds');
    }
  }
}

module.exports = { NodeMoveRule, NodeMoveRejected };
