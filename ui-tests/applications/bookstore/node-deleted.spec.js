const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * What the page does after a node was deleted.
 *
 * `node-deleted` names the node (`nodeId`) and everything that went with it
 * (`nodeIds`). The page shows one node: is it among them, its parent takes
 * its place — a root gives way to the start page, as with the home button.
 * Is a child of it among them, the node is fetched again: its combobox of
 * children lists one less.
 *
 * The event is fired here directly from the node view; who deletes does not
 * matter to the page (the delete action has its own spec).
 */

const ROOT = '000n00000000000011';
const CHILD_1 = '000n00000000000001';
const CHILD_2 = '000n00000000000002';

/** How often each node was asked for. */
let nodeQueries;

function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const isShown = (element) => element.getClientRects().length > 0;
    const view = root.querySelector('custom-node-view');
    return {
      feedsShown: isShown(root.querySelector('#feeds')),
      nodesShown: isShown(root.querySelector('#bookshelf')),
      viewId: view.getAttribute('id'),
      contentsId: root.querySelector('custom-node-contents').getAttribute('id'),
      treeLoaded: (view.path ?? []).length > 0 || !!view.siblings?.next,
      path: window.location.pathname,
    };
  });
}

/** Fires node-deleted from inside the page, as the delete action does. */
function reportDeleted(page, detail) {
  return page.evaluate((detail) => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    root.querySelector('custom-node-view').dispatchEvent(
      new CustomEvent('node-deleted', {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }, detail);
}

/** Opens the page on `id` and waits until it stands there, tree and all. */
async function openOn(page, id) {
  nodeQueries = {};
  await mockBookstoreCallouts(page);
  await page.route('**/data/query/node**', (route) => {
    const asked = new URL(route.request().url()).searchParams.get('id');
    nodeQueries[asked] = (nodeQueries[asked] ?? 0) + 1;
    return route.fallback();
  });
  await cacheLitBundle(page);
  await page.goto(`/${id}`);
  await expect.poll(async () => (await readPage(page)).contentsId).toBe(id);
  await expect.poll(async () => (await readPage(page)).treeLoaded).toBe(true);
}

test.describe('Page after deleting a node', () => {
  test.use({ actionTimeout: 5000 });

  test('the node shown gone, its parent takes its place', async ({ page }) => {
    await openOn(page, CHILD_1);

    await reportDeleted(page, { nodeId: CHILD_1, nodeIds: [CHILD_1] });

    await expect
      .poll(async () => {
        const state = await readPage(page);
        return [state.viewId, state.contentsId];
      })
      .toEqual([ROOT, ROOT]);
    expect((await readPage(page)).nodesShown).toBe(true);
  });

  test('a child of the node shown gone, the node is fetched again', async ({
    page,
  }) => {
    await openOn(page, ROOT);
    const before = nodeQueries[ROOT] ?? 0;

    // Without nodeIds the node alone went.
    await reportDeleted(page, { nodeId: CHILD_2 });

    await expect.poll(() => nodeQueries[ROOT] ?? 0).toBe(before + 1);
    expect((await readPage(page)).viewId).toBe(ROOT);
  });

  test('the node shown goes when it is only among nodeIds', async ({
    page,
  }) => {
    await openOn(page, CHILD_1);

    // Gone as part of a subtree: the deleted node itself is not shown.
    await reportDeleted(page, {
      nodeId: 'not-on-the-page',
      nodeIds: ['not-on-the-page', CHILD_1],
    });

    await expect.poll(async () => (await readPage(page)).viewId).toBe(ROOT);
  });

  test('a node shown gone with its root leads back to the start page', async ({
    page,
  }) => {
    await openOn(page, CHILD_1);

    await reportDeleted(page, {
      nodeId: ROOT,
      nodeIds: [ROOT, CHILD_1, CHILD_2],
    });

    await expect.poll(async () => (await readPage(page)).feedsShown).toBe(true);
    const state = await readPage(page);
    expect(state.nodesShown).toBe(false);
    expect(state.viewId).toBeNull();
    expect(state.contentsId).toBeNull();
    expect(state.path).toBe('/');
  });
});
