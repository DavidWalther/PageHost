const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { withSession } = require('../../support/session');
const { MOCK_NODES } = require('../../support/mock-callouts');

/**
 * The mark-to-move button in the action bar of `custom-node`.
 *
 * Like every writing action it is granted by the consumer (`can-move`) and
 * needs the scope (`edit`) as well. The node hands the action what the mark
 * carries — its id, name and parent. The consumer owns the mark and hands
 * every node the id of the marked one (`markedId`); the node tells its action
 * whether that is itself.
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

  /** Hands the node a marked id and reads what its action makes of it. */
  async function actionMarkedFor(node, markedId) {
    await node.evaluate(async (el, id) => {
      el.markedId = id;
      await el.updateComplete;
    }, markedId);
    return node.locator('#node-move').evaluate((el) => el.marked);
  }

  test('tells the action it is marked when the mark is this node', async ({
    page,
  }) => {
    const node = await mount(page);

    expect(await actionMarkedFor(node, NODE.id)).toBe(true);
  });

  test('tells the action it is not marked when another node is', async ({
    page,
  }) => {
    const node = await mount(page);

    expect(await actionMarkedFor(node, 'n-other')).toBe(false);
  });

  test('tells the action it is not marked without a mark', async ({ page }) => {
    const node = await mount(page);

    expect(await actionMarkedFor(node, null)).toBe(false);
  });
});

/**
 * A root always stands in the upper node, where nothing else is marked. With
 * `can-move-root` a node offers the mark only while it has no parent; a node
 * with a parent is marked where it is shown as the chosen one.
 */
test.describe('Node: the mark-to-move button for a root', () => {
  test.use({ actionTimeout: 5000 });

  const ROOT = MOCK_NODES.wurzel;

  /** Mounts a custom-node for `node` with can-move-root. */
  async function mountWithRootGrant(page, node, { scopes = ['edit'] } = {}) {
    if (scopes) {
      await withSession(page, scopes);
    }
    await gotoComponentPage(page);
    await page.evaluate(async (node) => {
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
      el.setAttribute('no-contents', '');
      el.setAttribute('can-move-root', '');
      el.setAttribute('id', node.id);
      document.body.appendChild(el);
      await el.updateComplete;
    }, node);
    const host = page.locator('custom-node');
    await expect(host.locator('#node-name')).toHaveText(node.name);
    return host;
  }

  test('a root offers the mark', async ({ page }) => {
    const node = await mountWithRootGrant(page, ROOT);

    await expect(node.locator('#node-move #button-move')).toBeVisible();
    const action = await node.locator('#node-move').evaluate((el) => ({
      nodeId: el.nodeId,
      parentId: el.parentId,
    }));
    expect(action).toEqual({ nodeId: ROOT.id, parentId: '' });
  });

  test('a node with a parent does not', async ({ page }) => {
    const node = await mountWithRootGrant(page, NODE);

    await expect(node.locator('#node-move')).toHaveCount(0);
  });

  test('a root does not without the edit scope', async ({ page }) => {
    const node = await mountWithRootGrant(page, ROOT, {
      scopes: ['read', 'create'],
    });

    await expect(node.locator('#node-move')).toHaveCount(0);
  });
});
