const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { withSession } = require('../../support/session');
const { MOCK_NODES } = require('../../support/mock-callouts');

/**
 * The publish button in the action bar of `custom-node`.
 *
 * A node is published through its own button, as in `custom-node-view` — not
 * through a tab of the edit dialog. `custom-node` keeps it for the feeds,
 * whose nodes it shows. Like the trigger itself it needs the scopes `publish`
 * and `edit`; without them there is no element at all.
 */

const NODE = MOCK_NODES.kind1;

/** Mounts a custom-node for NODE, answering its query from the mock. */
async function mount(page, { scopes = null } = {}) {
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
    await import('/slds-components/slds-modal/slds-modal.js');
    await import('/components/custom-node/custom-node.js');

    const el = document.createElement('custom-node');
    el.setAttribute('no-child-navigation', '');
    el.setAttribute('id', node.id);
    document.body.appendChild(el);
    await el.updateComplete;
  }, NODE);
  const host = page.locator('custom-node');
  await expect(host.locator('#node-name')).toHaveText(NODE.name);
  return host;
}

test.describe('Node: the publish button', () => {
  test.use({ actionTimeout: 5000 });

  test('shows with the scopes publish and edit, for the node', async ({
    page,
  }) => {
    // The button does not exist yet.
    test.fail();
    const node = await mount(page, { scopes: ['publish', 'edit'] });

    const publish = node.locator('#node-publish');
    await expect(publish).toHaveCount(1);
    await expect(publish).toHaveAttribute('object-name', 'node');
    await expect(publish).toHaveAttribute('record-id', NODE.id);
  });

  test('is left out without the scope publish', async ({ page }) => {
    const node = await mount(page, { scopes: ['edit'] });

    await expect(node.locator('#node-publish')).toHaveCount(0);
  });

  test('is left out without a session', async ({ page }) => {
    const node = await mount(page);

    await expect(node.locator('#node-publish')).toHaveCount(0);
  });
});
