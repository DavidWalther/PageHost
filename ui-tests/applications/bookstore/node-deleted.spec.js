const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_ROOT_PATH,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * What the page does after a node was deleted.
 *
 * `node-deleted` names the node (`nodeId`) and everything that went with it
 * (`nodeIds`). The page lets go of every one of them it shows: a node that
 * went from the selection above, the node below, or — when the node above
 * went — both, back to the start page as with the home button.
 *
 * The event is fired here directly from the lower node; who deletes does not
 * matter to the page (the delete action has its own spec).
 */

const ROOT = '000n00000000000011';
const CHILD_1 = '000n00000000000001';
const CHILD_2 = '000n00000000000002';

function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const isShown = (element) => element.getClientRects().length > 0;
    const nodeOf = (role) =>
      root.querySelector(`custom-node[data-role="${role}"]`);
    return {
      feedsShown: isShown(root.querySelector('#feeds')),
      nodesShown: isShown(root.querySelector('#bookshelf')),
      navigationId: nodeOf('navigation').getAttribute('id'),
      contentId: nodeOf('content').getAttribute('id'),
      selection: [
        ...nodeOf('navigation').shadowRoot.querySelectorAll(
          '#child-navigation button'
        ),
      ].map((button) => button.dataset.nodeId),
      path: window.location.pathname,
    };
  });
}

/** Fires node-deleted from inside the page, as the delete action does. */
function reportDeleted(page, detail) {
  return page.evaluate((detail) => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    root.querySelector('custom-node[data-role="content"]').dispatchEvent(
      new CustomEvent('node-deleted', {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }, detail);
}

test.describe('Page after deleting a node', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto(MOCK_ROOT_PATH);
    await expect
      .poll(async () => (await readPage(page)).contentId)
      .toBe(CHILD_1);
    await expect
      .poll(async () => (await readPage(page)).selection)
      .toEqual([CHILD_1, CHILD_2]);
  });

  test('a deleted child leaves the selection, the node below is emptied', async ({
    page,
  }) => {
    await reportDeleted(page, { nodeId: CHILD_1, nodeIds: [CHILD_1] });

    await expect
      .poll(async () => (await readPage(page)).selection)
      .toEqual([CHILD_2]);
    const state = await readPage(page);
    expect(state.contentId).toBeNull();
    expect(state.navigationId).toBe(ROOT);
    expect(state.nodesShown).toBe(true);
  });

  test('without nodeIds the node alone is let go of', async ({ page }) => {
    await reportDeleted(page, { nodeId: CHILD_2 });

    await expect
      .poll(async () => (await readPage(page)).selection)
      .toEqual([CHILD_1]);
    expect((await readPage(page)).contentId).toBe(CHILD_1);
  });

  test('the node below goes when it is only among nodeIds', async ({
    page,
  }) => {
    // The page reads only nodeId so far.
    test.fail();

    // Gone as part of a subtree: the deleted node itself is not shown.
    await reportDeleted(page, {
      nodeId: 'not-on-the-page',
      nodeIds: ['not-on-the-page', CHILD_1],
    });

    await expect.poll(async () => (await readPage(page)).contentId).toBeNull();
    expect((await readPage(page)).selection).toEqual([CHILD_2]);
  });

  test('a deleted node above leads back to the start page', async ({
    page,
  }) => {
    // The page keeps showing the deleted node above so far.
    test.fail();

    await reportDeleted(page, {
      nodeId: ROOT,
      nodeIds: [ROOT, CHILD_1, CHILD_2],
    });

    await expect.poll(async () => (await readPage(page)).feedsShown).toBe(true);
    const state = await readPage(page);
    expect(state.nodesShown).toBe(false);
    expect(state.navigationId).toBeNull();
    expect(state.contentId).toBeNull();
    expect(state.path).toBe('/');
  });
});
