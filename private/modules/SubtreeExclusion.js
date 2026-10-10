/**
 * Takes one node, together with its whole subtree, out of a node tree.
 *
 * Used at delivery time for a node that is real and stays reachable, but must
 * not appear in one particular view of the tree — the feed root in the
 * navigation. The tree itself (cache, sitemap, node queries) keeps the node;
 * that is why this is a step of its own and not part of the query or of the
 * publish filter.
 *
 * Without an id, or with an id that matches no node, the tree comes back as it
 * was. The input tree is never mutated.
 *
 * Usage:
 *   new SubtreeExclusion()
 *     .setTree(tree)
 *     .setExcludedId(nodeId)
 *     .getResult();
 */
class SubtreeExclusion {
  constructor() {
    this.tree = null;
    this.excludedId = null;
    this.childrenKey = 'nodes';
  }

  setTree(tree) {
    this.tree = tree;
    return this;
  }

  setExcludedId(excludedId) {
    this.excludedId = excludedId;
    return this;
  }

  setChildrenKey(childrenKey) {
    this.childrenKey = childrenKey;
    return this;
  }

  getResult() {
    if (!Array.isArray(this.tree) || !this.excludedId) {
      return this.tree;
    }
    return this.filterList(this.tree);
  }

  filterList(list) {
    return list
      .filter((node) => node?.id !== this.excludedId)
      .map((node) => this.filterNode(node));
  }

  filterNode(node) {
    const children = node?.[this.childrenKey];
    if (!Array.isArray(children)) {
      return node;
    }
    return { ...node, [this.childrenKey]: this.filterList(children) };
  }
}

module.exports = { SubtreeExclusion };
