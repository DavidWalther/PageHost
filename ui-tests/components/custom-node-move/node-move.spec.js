const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * `custom-node-move` — the one action that moves a node.
 *
 * Moving takes two steps in two places. The button marks the node it stands
 * at: it reports `node-mark-change`, and the consumer keeps the mark and hands
 * it back as `marked` — the action holds no state of its own. Where the new
 * parent is chosen, a host without the button (`no-trigger`) calls
 * `requestMove(node, targetId)`, which writes the new parent and reports
 * `node-moved`.
 *
 * Titles and toasts are operator surface; they are selectors here, not
 * assertions about wording.
 */

const NODE = { id: 'n-node', name: 'Chapter 3', parentId: 'n-old' };

/** Signs in (unless `scopes` is empty), opens a blank page, mounts the action. */
async function mount(
  page,
  { scopes = ['read', 'edit'], noTrigger = false, marked = false } = {}
) {
  if (scopes.length > 0) {
    await withSession(page, scopes);
  }
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ noTrigger, marked, node }) => {
      window.__toasts = [];
      window.__marks = [];
      window.__moved = [];
      document.body.addEventListener('toast', (event) => {
        window.__toasts.push(event.detail.message);
      });
      document.body.addEventListener('node-mark-change', (event) => {
        window.__marks.push(event.detail);
      });
      document.body.addEventListener('node-moved', (event) => {
        window.__moved.push(event.detail);
      });

      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/components/custom-node-move/custom-node-move.js');

      const el = document.createElement('custom-node-move');
      el.setAttribute('node-id', node.id);
      el.setAttribute('node-name', node.name);
      el.setAttribute('parent-id', node.parentId);
      if (noTrigger) {
        el.setAttribute('no-trigger', '');
      }
      el.marked = marked;
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { noTrigger, marked, node: NODE }
  );
  return page.locator('custom-node-move');
}

/** Records every write; answers it as the server would. */
async function routeChange(page, { status = 200, error = null } = {}) {
  const sent = [];
  await page.route('**/api/1.0/data/change/**', (route) => {
    sent.push(route.request().postDataJSON());
    return status === 200
      ? route.fulfill({
          json: { success: true, result: { id: NODE.id } },
        })
      : route.fulfill({ status, json: { success: false, error } });
  });
  return sent;
}

const marks = (page) => page.evaluate(() => window.__marks);
const moved = (page) => page.evaluate(() => window.__moved);
const toasts = (page) => page.evaluate(() => window.__toasts);

/** Calls requestMove on the action and returns what it resolved to. */
const requestMove = (page, node, targetId) =>
  page.evaluate(
    ({ node, targetId }) =>
      document.querySelector('custom-node-move').requestMove(node, targetId),
    { node, targetId }
  );

/** The icon the button shows, resolved through the button's property. */
const buttonIcon = (action) =>
  action.locator('#button-move').evaluate((button) => button.icon);

test.describe('custom-node-move', () => {
  test.use({ actionTimeout: 5000 });

  test.describe('trigger', () => {
    test('shows its button with the edit scope', async ({ page }) => {
      const action = await mount(page);

      await expect(action.locator('#button-move')).toBeVisible();
    });

    test('shows no button without the edit scope', async ({ page }) => {
      const action = await mount(page, { scopes: ['read', 'create'] });

      await expect(action.locator('#button-move')).toHaveCount(0);
    });

    test('shows no button with no-trigger', async ({ page }) => {
      const action = await mount(page, { noTrigger: true });

      await expect(action.locator('#button-move')).toHaveCount(0);
    });

    test('canMove() follows the edit scope', async ({ page }) => {
      await mount(page, { scopes: ['read', 'create'], noTrigger: true });

      const allowed = await page.evaluate(() =>
        document.querySelector('custom-node-move').canMove()
      );

      expect(allowed).toBe(false);
    });
  });

  test.describe('marking', () => {
    test('an unmarked node offers to mark it', async ({ page }) => {
      const action = await mount(page);

      expect(await buttonIcon(action)).toBe('utility:cut');
      await expect(action.locator('#button-move')).toHaveAttribute(
        'title',
        'Zum Verschieben markieren'
      );
    });

    test('a click reports the node to mark', async ({ page }) => {
      const action = await mount(page);

      await action.locator('#button-move').click();

      expect(await marks(page)).toEqual([{ marked: true, node: NODE }]);
    });

    test('a marked node offers to unmark it', async ({ page }) => {
      const action = await mount(page, { marked: true });

      expect(await buttonIcon(action)).toBe('utility:clear');
      await expect(action.locator('#button-move')).toHaveAttribute(
        'title',
        'Markierung aufheben'
      );
    });

    test('a click on a marked node reports to unmark it', async ({ page }) => {
      const action = await mount(page, { marked: true });

      await action.locator('#button-move').click();

      expect(await marks(page)).toEqual([{ marked: false, node: NODE }]);
    });

    // The consumer owns the mark: the button shows what it is handed.
    test('a click alone does not change what the button shows', async ({
      page,
    }) => {
      const action = await mount(page);

      await action.locator('#button-move').click();

      expect(await buttonIcon(action)).toBe('utility:cut');
    });
  });

  test.describe('moving', () => {
    test('writes the new parent and an empty sort number', async ({ page }) => {
      await mount(page, { noTrigger: true });
      const sent = await routeChange(page);

      expect(await requestMove(page, NODE, 'n-target')).toBe(true);

      expect(sent).toEqual([
        {
          object: 'node',
          payload: {
            id: NODE.id,
            parent_node_id: 'n-target',
            sortnumber: null,
          },
        },
      ]);
    });

    test('moves to the top level with no target', async ({ page }) => {
      await mount(page, { noTrigger: true });
      const sent = await routeChange(page);

      await requestMove(page, NODE, null);

      expect(sent[0].payload.parent_node_id).toBeNull();
    });

    test('reports node-moved and says so', async ({ page }) => {
      await mount(page, { noTrigger: true });
      await routeChange(page);

      await requestMove(page, NODE, 'n-target');

      expect(await moved(page)).toEqual([
        { nodeId: NODE.id, fromParentId: 'n-old', toParentId: 'n-target' },
      ]);
      expect(await toasts(page)).toContain('Knoten verschoben');
    });

    test('a rejected move shows the reason and reports nothing', async ({
      page,
    }) => {
      await mount(page, { noTrigger: true });
      await routeChange(page, {
        status: 400,
        error: 'A node cannot be moved below itself',
      });

      expect(await requestMove(page, NODE, 'n-target')).toBe(false);

      expect(await toasts(page)).toContain(
        'A node cannot be moved below itself'
      );
      expect(await moved(page)).toEqual([]);
    });

    test('sends nothing without the edit scope', async ({ page }) => {
      await mount(page, { scopes: ['read'], noTrigger: true });
      const sent = await routeChange(page);

      expect(await requestMove(page, NODE, 'n-target')).toBe(false);

      expect(sent).toEqual([]);
    });
  });
});
