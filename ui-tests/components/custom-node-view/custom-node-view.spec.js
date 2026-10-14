const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * `custom-node-view` — the node itself, above its contents.
 *
 * It shows the name of the node, the way up (breadcrumbs), the way sideways
 * (arrows to the previous and next sibling), the way down (a combobox of the
 * children) and the actions on the node. It knows no tree: the host hands in
 * the path and the siblings. Every way to another node is one event,
 * `node-view-navigate` with the id.
 *
 * Mounted on its own; the page answers the query for the node.
 */

const NODE = {
  id: 'n-part',
  name: 'Part 2',
  parent_node_id: 'n-book',
  sortnumber: 2,
  reversed: null,
  published_date: '2022-01-01 00:00:00',
  nodes: [
    { id: 'n-section-1', name: 'Section 1' },
    { id: 'n-section-2', name: 'Section 2' },
  ],
  contents: [],
};

const PATH = [
  { id: 'n-shelf', name: 'Shelf' },
  { id: 'n-book', name: 'Book' },
];

const SIBLINGS = {
  previous: { id: 'n-part-1', name: 'Part 1' },
  next: { id: 'n-part-3', name: 'Part 3' },
};

/**
 * Mounts the view for `node`, with `path` and `siblings` handed in as the
 * host would. Every `node-view-navigate` is recorded in `window.__navigated`.
 */
async function mount(
  page,
  { node = NODE, path = PATH, siblings = SIBLINGS, scopes = null } = {}
) {
  if (scopes) {
    await withSession(page, scopes);
  }
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ node, path, siblings }) => {
      window.__queries = 0;
      window.__navigated = [];
      document.body.addEventListener('query', (event) => {
        window.__queries += 1;
        event.detail.callback(null, node);
      });
      document.body.addEventListener('node-view-navigate', (event) =>
        window.__navigated.push(event.detail.id)
      );
      for (const module of [
        '/slds-components/slds-card/slds-card.js',
        '/slds-components/slds-layout/slds-layout.js',
        '/slds-components/slds-layout/slds-layout-item.js',
        '/slds-components/slds-button-icon/slds-button-icon.js',
        '/slds-components/slds-breadcrumbs/slds-breadcrumbs.js',
        '/slds-components/slds-combobox/slds-combobox.js',
        '/slds-components/slds-modal/slds-modal.js',
        '/slds-components/slds-toggle/slds-toggle.js',
        '/slds-components/slds-spinner/slds-spinner.js',
        '/components/custom-node-view/custom-node-view.js',
      ]) {
        await import(module);
      }
      const el = document.createElement('custom-node-view');
      el.path = path;
      el.siblings = siblings;
      el.setAttribute('id', node.id);
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { node, path, siblings }
  );
  const host = page.locator('custom-node-view');
  await expect(host.locator('#node-name')).toHaveText(node.name);
  return host;
}

const navigated = (page) => page.evaluate(() => window.__navigated);

test.describe('custom-node-view', () => {
  test.use({ actionTimeout: 5000 });

  test.describe('the node', () => {
    test('shows the name of the node it fetched', async ({ page }) => {
      const host = await mount(page);

      await expect(host.locator('#node-name')).toHaveText('Part 2');
      expect(await page.evaluate(() => window.__queries)).toBe(1);
    });

    test('reports the loaded record', async ({ page }) => {
      await mount(page);

      const loaded = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const el = document.querySelector('custom-node-view');
            el.addEventListener('loaded', (event) =>
              resolve(event.detail.nodeData.id)
            );
            el.reload();
          })
      );
      expect(loaded).toBe('n-part');
    });

    test('takes a record already loaded without asking for it', async ({
      page,
    }) => {
      const host = await mount(page);

      await host.evaluate((el) =>
        el.adoptNode({ id: 'n-other', name: 'Other', nodes: [], contents: [] })
      );

      await expect(host.locator('#node-name')).toHaveText('Other');
      await expect(host).toHaveAttribute('id', 'n-other');
      expect(await page.evaluate(() => window.__queries)).toBe(1);
    });
  });
});
