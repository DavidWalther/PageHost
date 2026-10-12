const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { MOCK_NODES } = require('../../support/mock-callouts');

/**
 * `reload()` — the node fetches itself again, under the same id.
 *
 * Setting the same id again does nothing: the node already holds that record.
 * After a move the record is stale — another parent, other children — and
 * the edit dialog would write the old parent back. `reload()` asks again.
 */

const NODE = MOCK_NODES.kind1;

async function mount(page) {
  await gotoComponentPage(page);
  await page.evaluate(async (node) => {
    window.__answer = node;
    window.__queries = 0;
    document.body.addEventListener('query', (event) => {
      window.__queries += 1;
      event.detail.callback(null, window.__answer);
    });
    await import('/slds-components/slds-card/slds-card.js');
    await import('/slds-components/slds-layout/slds-layout.js');
    await import('/slds-components/slds-layout/slds-layout-item.js');
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

const queries = (page) => page.evaluate(() => window.__queries);

test.describe('Node: reload()', () => {
  test.use({ actionTimeout: 5000 });

  test('fetches the node again and shows the new record', async ({ page }) => {
    const node = await mount(page);
    await page.evaluate((node) => {
      window.__answer = { ...node, name: 'Moved', parent_node_id: 'n-new' };
    }, NODE);

    await node.evaluate((el) => el.reload());

    await expect(node.locator('#node-name')).toHaveText('Moved');
    expect(await queries(page)).toBe(2);
  });

  test('does nothing without an id', async ({ page }) => {
    const node = await mount(page);
    await node.evaluate(async (el) => {
      el.removeAttribute('id');
      await el.updateComplete;
    });

    await node.evaluate((el) => el.reload());

    expect(await queries(page)).toBe(1);
  });
});
