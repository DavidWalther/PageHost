const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { withSession } = require('../../support/session');
const { MOCK_NODES } = require('../../support/mock-callouts');

/**
 * The mark-to-move button in the action bar of `custom-node`.
 *
 * Like every writing action it is granted by the consumer (`can-move`) and
 * needs the scope (`edit`) as well. The node hands the action what the mark
 * carries — its id, name and parent — and passes `marked` through, which the
 * consumer sets on the node.
 */

const NODE = MOCK_NODES.kind1;

/** Mounts a custom-node for NODE, answering its query from the mock. */
async function mount(page, { scopes = ['edit'], canMove = true } = {}) {
  if (scopes) {
    await withSession(page, scopes);
  }
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ node, canMove }) => {
      document.body.addEventListener('query', (event) => {
        const { payload, callback } = event.detail;
        callback(null, payload.id === node.id ? node : {});
      });
      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/slds-components/slds-card/slds-card.js');
      await import('/slds-components/slds-layout/slds-layout.js');
      await import('/slds-components/slds-layout/slds-layout-item.js');
      await import('/components/custom-node/custom-node.js');

      const el = document.createElement('custom-node');
      el.setAttribute('no-child-navigation', '');
      if (canMove) {
        el.setAttribute('can-move', '');
      }
      el.setAttribute('id', node.id);
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { node: NODE, canMove }
  );
  const host = page.locator('custom-node');
  await expect(host.locator('#node-name')).toHaveText(NODE.name);
  return host;
}

test.describe('Node: the mark-to-move button', () => {
  test.use({ actionTimeout: 5000 });

  test('shows with can-move and the edit scope', async ({ page }) => {
    const node = await mount(page);

    await expect(node.locator('#node-move #button-move')).toBeVisible();
  });

  test('does not show without can-move', async ({ page }) => {
    const node = await mount(page, { canMove: false });

    await expect(node.locator('#node-move')).toHaveCount(0);
  });

  test('does not show without the edit scope', async ({ page }) => {
    const node = await mount(page, { scopes: ['read', 'create'] });

    await expect(node.locator('#node-move')).toHaveCount(0);
  });

  test('hands the action what the mark carries', async ({ page }) => {
    const node = await mount(page);

    const action = await node.locator('#node-move').evaluate((el) => ({
      nodeId: el.nodeId,
      nodeName: el.nodeName,
      parentId: el.parentId,
    }));

    expect(action).toEqual({
      nodeId: NODE.id,
      nodeName: NODE.name,
      parentId: NODE.parent_node_id,
    });
  });

  test('passes marked through to the action', async ({ page }) => {
    const node = await mount(page);

    await node.evaluate(async (el) => {
      el.marked = true;
      await el.updateComplete;
    });

    expect(await node.locator('#node-move').evaluate((el) => el.marked)).toBe(
      true
    );
  });
});
