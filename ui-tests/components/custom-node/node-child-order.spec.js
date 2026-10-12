const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_ROOT_PATH,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

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

test.describe('Node: order of the children after a change', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto(MOCK_ROOT_PATH);
    await expect(page.locator('app-bookstore')).toBeAttached();
    await expect.poll(() => childIds(page)).toEqual([FIRST.id, SECOND.id]);
  });

  /** Ids of the children the upper node lists, in order. */
  const childIds = (page) =>
    page.evaluate(() => {
      const app = document.querySelector('app-bookstore');
      const node = app.shadowRoot.querySelector(
        'custom-node[data-role="navigation"]'
      );
      return (node?.childNodeList ?? []).map((child) => child.id);
    });

  const applyChildUpdate = (page, childData) =>
    page.evaluate((data) => {
      const app = document.querySelector('app-bookstore');
      app.shadowRoot
        .querySelector('custom-node[data-role="navigation"]')
        .applyChildUpdate(data);
    }, childData);

  test('a child without a sortnumber stands at the end', async ({ page }) => {
    test.fail(); // null sorts as 0 and goes to the front
    await applyChildUpdate(page, { id: FIRST.id, sortnumber: null });

    expect(await childIds(page)).toEqual([SECOND.id, FIRST.id]);
  });

  test('a child with a sortnumber keeps its place by number', async ({
    page,
  }) => {
    await applyChildUpdate(page, { id: FIRST.id, sortnumber: 3 });

    expect(await childIds(page)).toEqual([SECOND.id, FIRST.id]);
  });
});
