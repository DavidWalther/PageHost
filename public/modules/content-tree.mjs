/**
 * Lookups on the content tree as `/api/1.0/contents` delivers it:
 * nodes `{ id, name, label, childnodes }`, nested in any depth.
 *
 * Pure functions, no DOM. Shared by the navigation modal (which level to open
 * on, which tiles to mark), the breadcrumbs (the path to show) and the delete
 * action (what goes along with a node).
 */

/**
 * The path from a root down to the node with the given id, both included.
 *
 * @param {Array<object>} tree root nodes
 * @param {string} id
 * @returns {Array<object>} `[root, …, node]`, or `[]` when the id is not in the tree
 */
export function findPath(tree, id) {
  for (const node of tree || []) {
    if (node.id === id) {
      return [node];
    }
    const below = findPath(node.childnodes, id);
    if (below.length > 0) {
      return [node, ...below];
    }
  }
  return [];
}

/**
 * The node with the given id, on whatever level it is.
 *
 * @param {Array<object>} tree root nodes
 * @param {string} id
 * @returns {object|null}
 */
export function findNode(tree, id) {
  const path = findPath(tree, id);
  return path.length > 0 ? path[path.length - 1] : null;
}

/**
 * The ids of every node below the one with the given id, in any depth; the
 * node itself is not among them. What a delete takes along with the node.
 *
 * @param {Array<object>} tree root nodes
 * @param {string} id
 * @returns {Array<string>} `[]` for a leaf and for an id not in the tree
 */
export function descendantIds(tree, id) {
  const collect = (nodes) =>
    (nodes || []).flatMap((node) => [node.id, ...collect(node.childnodes)]);
  return collect(findNode(tree, id)?.childnodes);
}
