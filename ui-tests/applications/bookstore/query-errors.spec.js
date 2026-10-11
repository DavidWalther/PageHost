const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * A failed `contents` or `metadata` query still answers.
 *
 * `public/index.js` turns `query` events into requests and calls the callback
 * of the asker with the result — or with the error. A request that fails must
 * reach the callback as an error too; otherwise the asker waits for ever.
 */

const contentNode = (page) =>
  page.locator('app-bookstore custom-node[data-role="content"]');

test.describe('Failed queries', () => {
  test.use({ actionTimeout: 5000 });
  // A failed contents or metadata request never reaches the callback so far.
  test.fail();

  test('without the tree the delete action says so and sends nothing', async ({
    page,
  }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await withSession(page, ['read', 'delete']);
    await page.goto('/000c00000000000001');
    await expect(contentNode(page).locator('#button-delete')).toBeVisible();
    // From now on the tree cannot be loaded.
    await page.route('**/api/1.0/contents/**', (route) => route.abort());
    const prompts = [];
    page.on('dialog', (dialog) => {
      prompts.push(dialog.message());
      return dialog.dismiss();
    });

    await contentNode(page).locator('#button-delete').click();

    await expect(
      page.locator('slds-toast', {
        hasText: 'Der Knoten konnte nicht geladen werden',
      })
    ).toBeVisible();
    expect(prompts).toEqual([]);
  });

  test('without metadata the page still opens the node of the address', async ({
    page,
  }) => {
    await mockBookstoreCallouts(page);
    await page.route('**/metadata', (route) => route.abort());
    await cacheLitBundle(page);

    await page.goto('/000c00000000000001');

    await expect(contentNode(page).locator('#node-name')).toHaveText(
      'Mock Chapter 1 for Story 1'
    );
  });
});
