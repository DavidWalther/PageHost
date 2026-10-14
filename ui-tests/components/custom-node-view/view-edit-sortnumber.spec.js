const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * The sort number the node view hands to its edit dialog.
 *
 * A moved node has no sortnumber and stands at the end of its siblings. The
 * dialog gets exactly that — no `1` filled in on the way, which saving would
 * write and so move the node to the front.
 */

const NODE = MOCK_NODES.kind1;

async function openNode(page, sortnumber) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await withSession(page, ['edit']);
  await page.route('**/data/query/node**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    const match = Object.values(MOCK_NODES).find(
      (node) => node.id === id || node.legacy_id === id
    );
    const answer =
      match && match.id === NODE.id ? { ...match, sortnumber } : match;
    return route.fulfill({ json: answer || {} });
  });
  await page.goto(`/${NODE.id}`);
  await expect(page.locator('app-bookstore')).toBeAttached();
  await expect(page.locator('custom-node-view #node-edit')).toBeAttached();
}

/** The sort number the edit dialog of the node view holds. */
const dialogSortNumber = (page) =>
  page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    return app.shadowRoot
      .querySelector('custom-node-view')
      .shadowRoot.querySelector('#node-edit').sortNumber;
  });

test.describe('Node: sort number for the edit dialog', () => {
  test.use({ actionTimeout: 5000 });

  test('a node without a sortnumber hands over none', async ({ page }) => {
    await openNode(page, null);

    expect(await dialogSortNumber(page)).toBeNull();
  });

  test('a node with a sortnumber hands it over', async ({ page }) => {
    await openNode(page, 4);

    expect(await dialogSortNumber(page)).toBe(4);
  });
});
