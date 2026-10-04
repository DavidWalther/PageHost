const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * How often the app asks for the content tree.
 *
 * The tree is one source for every part of the page that needs it (navigation
 * modal, breadcrumbs). It is fetched once on start and once more after each
 * change to a node — never once per consumer.
 */

let contentsCalls;

async function open(page) {
  contentsCalls = 0;
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', async (route) => {
    contentsCalls += 1;
    await route.fallback();
  });
  await cacheLitBundle(page);
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
}

test.describe('Content tree requests', () => {
  test('fetches the tree exactly once on start', async ({ page }) => {
    await open(page);

    await expect.poll(() => contentsCalls).toBe(1);
    // Give a second consumer the chance to ask as well.
    await page.waitForTimeout(500);
    expect(contentsCalls).toBe(1);
  });

  test('fetches it exactly once more after a node changed', async ({
    page,
  }) => {
    await open(page);
    await expect.poll(() => contentsCalls).toBe(1);

    await page.evaluate(() =>
      document
        .querySelector('app-bookstore')
        .shadowRoot.querySelector('custom-node')
        .dispatchEvent(
          new CustomEvent('chapter-updated', {
            detail: { chapterData: { id: '000n00000000000002' } },
            bubbles: true,
            composed: true,
          })
        )
    );

    await expect.poll(() => contentsCalls).toBe(2);
    await page.waitForTimeout(500);
    expect(contentsCalls).toBe(2);
  });
});
