const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Smoke test of the node on the page.
 *
 * The page shows **one** `custom-node`. It lists its children as a selection
 * and shows its contents; a click on a child shows that child. If this breaks,
 * either the selection or the contents would be missing.
 */

/** What the one node shows. */
async function readNode(page) {
  return page.evaluate(() => {
    const element = document
      .querySelector('app-bookstore')
      .shadowRoot.querySelector('custom-node');
    const root = element.shadowRoot;
    return {
      recordId: element.getAttribute('id'),
      name: root.querySelector('#node-name')?.textContent?.trim() ?? null,
      childButtons: [...root.querySelectorAll('#child-navigation button')].map(
        (button) => button.textContent.trim()
      ),
      hasNavigation: !!root.querySelector('#child-navigation'),
      contentIds: [...root.querySelectorAll('custom-paragraph')].map(
        (element) => element.id
      ),
    };
  });
}

async function open(page, path) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await page.goto(path);
  await expect(page.locator('app-bookstore')).toBeAttached();
}

test.describe('custom-node', () => {
  test('a node with children lists them for selection', async ({ page }) => {
    await open(page, '/000s00000000000011');
    await expect
      .poll(async () => (await readNode(page)).name)
      .toBe('Mock Story 1');

    const node = await readNode(page);
    expect(node.childButtons).toEqual([
      'Mock Chapter 1 for Story 1',
      'Mock Chapter 2 for Story 1',
    ]);
    expect(node.contentIds).toEqual([]);
  });

  test('the start page shows the cover node with its contents', async ({
    page,
  }) => {
    await open(page, '/');
    await expect
      .poll(async () => (await readNode(page)).contentIds.length)
      .toBeGreaterThan(0);

    const node = await readNode(page);
    expect(node.recordId).toBe('000n00000000000001');
    expect(node.contentIds).toEqual(['00cn00000000000001']);
    expect(node.hasNavigation).toBe(false);
  });

  test('a content shows in its active representation', async ({ page }) => {
    // The content endpoint delivers every representation and points at the
    // active one (here html). Ignoring the pointer would show the plain text.
    await open(page, '/');
    const paragraph = page.locator(
      'app-bookstore custom-node custom-paragraph'
    );

    await expect(paragraph.locator('#content p')).toHaveCount(1);
    await expect(paragraph.locator('#content')).toContainText(
      'Lorem ipsum dolor sit amet'
    );
  });

  test('a click on a child shows that child', async ({ page }) => {
    await open(page, '/000s00000000000011');
    await expect
      .poll(async () => (await readNode(page)).childButtons.length)
      .toBe(2);

    await page
      .locator(
        'app-bookstore custom-node button[data-node-id="000n00000000000002"]'
      )
      .click();

    await expect
      .poll(async () => (await readNode(page)).recordId)
      .toBe('000n00000000000002');
    const node = await readNode(page);
    expect(node.name).toBe('Mock Chapter 2 for Story 1');
    // Chapter 2 has no contents in the mock — the hint takes their place.
    expect(node.contentIds).toEqual([]);
  });
});
