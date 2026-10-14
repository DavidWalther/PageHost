const { test, expect } = require('@playwright/test');
const { MOCK_NODES } = require('../../support/mock-callouts');
const { mountNode } = require('../../support/node-mount');

/**
 * The order of the children after one of them changed.
 *
 * `applyChildUpdate` takes a changed child into the selection and sorts the
 * children again. A child without a `sortnumber` stands at the end — as in
 * the tree the backend delivers. A moved node has no `sortnumber`; it must
 * not jump to the front the moment it is renamed.
 */

const ROOT = MOCK_NODES.wurzel;
const [FIRST, SECOND] = ROOT.nodes;

/** Ids of the children the node lists, in order. */
const childIds = (node) =>
  node.evaluate((host) => host.childNodeList.map((child) => child.id));

const applyChildUpdate = (node, childData) =>
  node.evaluate((host, data) => host.applyChildUpdate(data), childData);

test.describe('Node: order of the children after a change', () => {
  test.use({ actionTimeout: 5000 });

  let node;
  test.beforeEach(async ({ page }) => {
    node = await mountNode(page, {
      node: { ...ROOT, contents: [] },
      attrs: { 'no-contents': true },
    });
    await expect.poll(() => childIds(node)).toEqual([FIRST.id, SECOND.id]);
  });

  test('a child without a sortnumber stands at the end', async () => {
    await applyChildUpdate(node, { id: FIRST.id, sortnumber: null });

    expect(await childIds(node)).toEqual([SECOND.id, FIRST.id]);
  });

  test('a child with a sortnumber keeps its place by number', async () => {
    await applyChildUpdate(node, { id: FIRST.id, sortnumber: 3 });

    expect(await childIds(node)).toEqual([SECOND.id, FIRST.id]);
  });
});
