const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * `no-title` on `custom-node`: the name of the node is not shown.
 *
 * A consumer that already names the node elsewhere — a tab, for instance —
 * switches the title off. Only the name goes: the actions stand in the same
 * header and stay reachable.
 *
 * The node is mounted into the shadow root of the application: `index.js`
 * binds the callouts (the `query` event) to the `app-bookstore` element, so a
 * node outside of it would never get an answer.
 */

const NODE = MOCK_NODES.kind1;

async function mountNode(page, attributes = {}) {
  await page.locator('app-bookstore').waitFor({ state: 'attached' });
  await page.evaluate(
    async ([id, attributes]) => {
      await import('/components/custom-node/custom-node.js');
      const node = document.createElement('custom-node');
      node.dataset.role = 'under-test';
      for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, value);
      }
      node.setAttribute('id', id);
      document.querySelector('app-bookstore').shadowRoot.appendChild(node);
    },
    [NODE.id, attributes]
  );
}

const nodeUnderTest = (page) =>
  page.locator('custom-node[data-role="under-test"]');

test.describe('custom-node: no-title', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/');
  });

  test('shows the name of the node by default', async ({ page }) => {
    await mountNode(page);

    await expect(nodeUnderTest(page).locator('#node-name')).toHaveText(
      NODE.name
    );
  });

  test('does not show the name with no-title', async ({ page }) => {
    await mountNode(page, { 'no-title': '' });

    await expect(
      nodeUnderTest(page).locator('custom-paragraph')
    ).not.toHaveCount(0);
    await expect(nodeUnderTest(page).locator('#node-name')).toHaveCount(0);
    await expect(nodeUnderTest(page).locator('slds-card')).not.toContainText(
      NODE.name
    );
  });

  test('keeps the actions and the contents with no-title', async ({ page }) => {
    await mountNode(page, { 'no-title': '' });

    await expect(nodeUnderTest(page).locator('#button-share')).toBeVisible();
    await expect(
      nodeUnderTest(page).locator('custom-paragraph').first()
    ).toBeVisible();
  });

  test('keeps the actions at the right edge of the card with no-title', async ({
    page,
  }) => {
    await mountNode(page, { 'no-title': '' });

    const share = nodeUnderTest(page).locator('#button-share');
    await expect(share).toBeVisible();
    const cardBox = await nodeUnderTest(page)
      .locator('slds-card')
      .boundingBox();
    const shareBox = await share.boundingBox();
    // Right half of the card: the empty title must not let the actions slide
    // to the left.
    expect(shareBox.x).toBeGreaterThan(cardBox.x + cardBox.width / 2);
  });
});
