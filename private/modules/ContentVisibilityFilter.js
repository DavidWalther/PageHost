/**
 * Removes unpublished nodes from a node tree at delivery time.
 *
 * The cache holds the full tree (published and unpublished nodes alike); this
 * filter trims the unpublished ones just before delivery. It is intentionally a
 * standalone, reusable module (between cache and endpoint) because the same
 * visibility logic is needed later for sitemap.xml generation.
 *
 * A node is visible when it has a publish date that is set and not after the
 * given cutoff date. A hidden node is dropped together with its whole subtree.
 * The input tree is never mutated.
 *
 * Usage:
 *   new ContentVisibilityFilter()
 *     .setTree(tree)
 *     .setDate(new Date())
 *     .getResult();
 */
class ContentVisibilityFilter {
  constructor() {
    this.tree = null;
    this.date = null;
    this.childrenKey = 'childnodes';
    this.dateField = 'publishdate';
  }

  setTree(tree) {
    this.tree = tree;
    return this;
  }

  setDate(date) {
    this.date = date;
    return this;
  }

  setChildrenKey(childrenKey) {
    this.childrenKey = childrenKey;
    return this;
  }

  setDateField(dateField) {
    this.dateField = dateField;
    return this;
  }

  getResult() {
    if (this.tree === null || this.tree === undefined) {
      return this.tree;
    }
    if (Array.isArray(this.tree)) {
      return this.filterList(this.tree);
    }
    return this.filterNode(this.tree);
  }

  filterList(list) {
    const result = [];
    list.forEach((node) => {
      const filtered = this.filterNode(node);
      if (filtered !== null) {
        result.push(filtered);
      }
    });
    return result;
  }

  /**
   * @returns a filtered copy of the node, or null if the node is not visible.
   */
  filterNode(node) {
    if (!this.isVisible(node)) {
      return null;
    }
    const copy = { ...node };
    const children = node[this.childrenKey];
    if (Array.isArray(children)) {
      copy[this.childrenKey] = this.filterList(children);
    }
    return copy;
  }

  isVisible(node) {
    if (!node) {
      return false;
    }
    const rawPublishDate = node[this.dateField];
    if (rawPublishDate === undefined || rawPublishDate === null || rawPublishDate === '') {
      return false;
    }
    const publishTime = new Date(rawPublishDate).getTime();
    if (Number.isNaN(publishTime)) {
      return false;
    }
    const cutoffTime =
      this.date instanceof Date
        ? this.date.getTime()
        : new Date(this.date).getTime();
    if (Number.isNaN(cutoffTime)) {
      return false;
    }
    return publishTime <= cutoffTime;
  }
}

module.exports = { ContentVisibilityFilter };
