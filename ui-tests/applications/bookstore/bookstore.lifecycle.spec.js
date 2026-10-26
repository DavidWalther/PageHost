const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * The application element cleans up after itself.
 *
 * It listens on itself for what its components report (`chapter-updated`,
 * `node-deleted`, …). Taken out of the document it has to stop listening, and
 * put back in it has to listen again — exactly once.
 *
 * `node-deleted` is the probe: the application answers it by letting go of
 * the node shown when that node is the deleted one — the node view then
 * stands on another node, or on none. That can be read from outside.
 */

const CHILD = MOCK_NODES.kind1;
const nodeView = (page) => page.locator('custom-node-view');

/** Reports the node shown as deleted; returns the id the view shows then. */
function reportDeleted(page, nodeId) {
  return page.evaluate((nodeId) => {
    const app = window.appUnderTest ?? document.querySelector('app-bookstore');
    app.dispatchEvent(new CustomEvent('node-deleted', { detail: { nodeId } }));
    return app.shadowRoot.querySelector('custom-node-view').getAttribute('id');
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
    await expect(nodeView(page).locator('#node-name')).toHaveText(CHILD.name);
  });

  test('answers a deleted node while it is in the document', async ({
    page,
  }) => {
    expect(await reportDeleted(page, CHILD.id)).not.toBe(CHILD.id);
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

    expect(await reportDeleted(page, CHILD.id)).not.toBe(CHILD.id);
  });

  test('listens only once after it was put back', async ({ page }) => {
    await detach(page);
    await attach(page);

    const reloads = await page.evaluate((nodeId) => {
      const app = window.appUnderTest;
      let count = 0;
      const original = app.loadContentTree.bind(app);
      app.loadContentTree = () => {
        count += 1;
        return original();
      };
      // Every node change loads the content tree again — once.
      app.dispatchEvent(
        new CustomEvent('node-deleted', { detail: { nodeId } })
      );
      return count;
    }, CHILD.id);

    expect(reloads).toBe(1);
  });

  // The session events arrive on `window`, not on the element: those
  // listeners have to come and go with it as well. `logged-out` is the probe
  // — the application answers it by loading the tree again.
  test.describe('on window', () => {
    /** Reports a logout on window; returns how often the tree was loaded. */
    function reportLoggedOut(page) {
      return page.evaluate(() => {
        const app =
          window.appUnderTest ?? document.querySelector('app-bookstore');
        let count = 0;
        const original = app.loadContentTree.bind(app);
        app.loadContentTree = () => {
          count += 1;
          return original();
        };
        window.dispatchEvent(
          new CustomEvent('logged-out', { detail: { reason: 'expired' } })
        );
        app.loadContentTree = original;
        return count;
      });
    }

    test('answers while it is in the document', async ({ page }) => {
      expect(await reportLoggedOut(page)).toBe(1);
    });

    test('stops listening when it is taken out', async ({ page }) => {
      await detach(page);

      expect(await reportLoggedOut(page)).toBe(0);
    });

    test('listens exactly once after it was put back', async ({ page }) => {
      await detach(page);
      await attach(page);

      expect(await reportLoggedOut(page)).toBe(1);
    });
  });
});
