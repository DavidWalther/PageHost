const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * The application element cleans up after itself.
 *
 * It listens on itself for what its nodes report (`navigation`,
 * `chapter-updated`, `node-deleted`, …). Taken out of the document it has to
 * stop listening, and put back in it has to listen again — exactly once.
 *
 * `node-deleted` is the probe: the application answers it by emptying the
 * lower node when that node is the deleted one, which can be read from outside.
 */

const CHILD = MOCK_NODES.kind1;
const contentNode = (page) => page.locator('custom-node[data-role="content"]');

/** Reports the lower node as deleted and returns the id it shows afterwards. */
function reportDeleted(page, nodeId) {
  return page.evaluate((nodeId) => {
    const app = window.appUnderTest ?? document.querySelector('app-bookstore');
    app.dispatchEvent(new CustomEvent('node-deleted', { detail: { nodeId } }));
    return app.shadowRoot
      .querySelector('custom-node[data-role="content"]')
      .getAttribute('id');
  }, nodeId);
}

const detach = (page) =>
  page.evaluate(() => {
    window.appUnderTest = document.querySelector('app-bookstore');
    window.appParent = window.appUnderTest.parentNode;
    window.appUnderTest.remove();
  });

const attach = (page) =>
  page.evaluate(async () => {
    window.appParent.appendChild(window.appUnderTest);
    await window.appUnderTest.updateComplete;
  });

test.describe('bookstore: lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto(`/${CHILD.id}`);
    await expect(contentNode(page).locator('#node-name')).toHaveText(
      CHILD.name
    );
  });

  test('answers a deleted node while it is in the document', async ({
    page,
  }) => {
    expect(await reportDeleted(page, CHILD.id)).toBeNull();
  });

  test('stops listening when it is taken out of the document', async ({
    page,
  }) => {
    await detach(page);

    expect(await reportDeleted(page, CHILD.id)).toBe(CHILD.id);
  });

  test('listens again when it is put back', async ({ page }) => {
    await detach(page);
    await attach(page);

    expect(await reportDeleted(page, CHILD.id)).toBeNull();
  });

  test('listens only once after it was put back', async ({ page }) => {
    await detach(page);
    await attach(page);

    const reloads = await page.evaluate((nodeId) => {
      const app = window.appUnderTest;
      const modal = app.shadowRoot.querySelector('custom-navigation-modal');
      let count = 0;
      const original = modal.reload.bind(modal);
      modal.reload = () => {
        count += 1;
        return original();
      };
      // Every node change asks the navigation to load its tree again — once.
      app.dispatchEvent(
        new CustomEvent('node-deleted', { detail: { nodeId } })
      );
      return count;
    }, CHILD.id);

    expect(reloads).toBe(1);
  });
});
