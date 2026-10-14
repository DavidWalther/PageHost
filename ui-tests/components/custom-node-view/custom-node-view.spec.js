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

// The arrows are measured: the page needs the SLDS styles, which the
// components take over into their shadow roots when they connect.
const STYLESHEET = '/assets/styles/salesforce-lightning-design-system.min.css';

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
    async ({ node, path, siblings, stylesheet }) => {
      if (!document.querySelector(`link[href="${stylesheet}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheet;
        await new Promise((resolve) => {
          link.onload = resolve;
          document.head.appendChild(link);
        });
      }
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
    { node, path, siblings, stylesheet: STYLESHEET }
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

  test.describe('the arrows to the siblings', () => {
    const previous = (host) => host.locator('#button-previous');
    const next = (host) => host.locator('#button-next');

    test('lead to the previous and the next sibling', async ({ page }) => {
      const host = await mount(page);

      await previous(host).click();
      await next(host).click();

      expect(await navigated(page)).toEqual(['n-part-1', 'n-part-3']);
    });

    test('carry the name of the sibling as tooltip and accessible name', async ({
      page,
    }) => {
      const host = await mount(page);

      await expect(previous(host)).toHaveAttribute(
        'icon',
        'utility:chevronleft'
      );
      await expect(next(host)).toHaveAttribute('icon', 'utility:chevronright');
      await expect(previous(host).locator('button')).toHaveAttribute(
        'title',
        'Part 1'
      );
      await expect(
        host.getByRole('button', { name: 'Part 3', exact: true })
      ).toBeVisible();
    });

    test('stand at the height of the name', async ({ page }) => {
      const host = await mount(page);

      const name = await host.locator('#node-name').boundingBox();
      for (const arrow of [previous(host), next(host)]) {
        const box = await arrow.boundingBox();
        const middle = box.y + box.height / 2;
        expect(middle).toBeGreaterThan(name.y);
        expect(middle).toBeLessThan(name.y + name.height);
      }
    });

    test('leave out a missing sibling without moving the name', async ({
      page,
    }) => {
      let host = await mount(page);
      const withBoth = await host.locator('#node-name').boundingBox();

      host = await mount(page, {
        siblings: { previous: null, next: SIBLINGS.next },
      });
      await expect(previous(host)).toHaveCount(0);
      await expect(next(host)).toBeVisible();
      const withoutPrevious = await host.locator('#node-name').boundingBox();

      host = await mount(page, { siblings: { previous: null, next: null } });
      await expect(next(host)).toHaveCount(0);
      const withNeither = await host.locator('#node-name').boundingBox();

      expect(withoutPrevious.x).toBe(withBoth.x);
      expect(withNeither.x).toBe(withBoth.x);
    });
  });

  test.describe('the breadcrumbs', () => {
    const crumbs = (host) => host.locator('slds-breadcrumbs');

    test('show the way up, without the node itself', async ({ page }) => {
      const host = await mount(page);

      await expect(crumbs(host).locator('li')).toHaveText(['Shelf', 'Book']);
      // The name of the node stands below; no crumb is the current page.
      await expect(crumbs(host).locator('li[aria-current]')).toHaveCount(0);
      await expect(crumbs(host).locator('li a')).toHaveCount(2);
    });

    test('lead up to the node clicked', async ({ page }) => {
      const host = await mount(page);

      await crumbs(host).locator('a', { hasText: 'Book' }).click();

      expect(await navigated(page)).toEqual(['n-book']);
    });

    test('are left out for a root', async ({ page }) => {
      const host = await mount(page, { path: [] });

      await expect(crumbs(host)).toHaveCount(0);
    });
  });

  test.describe('the children', () => {
    const combobox = (host) => host.locator('slds-combobox');

    test('are offered in a combobox', async ({ page }) => {
      const host = await mount(page);

      const labels = await combobox(host).evaluate((el) =>
        JSON.parse(el.getAttribute('options')).map((option) => option.label)
      );
      expect(labels).toEqual(['Section 1', 'Section 2']);
    });

    test('are offered in a combobox for a single child too', async ({
      page,
    }) => {
      const host = await mount(page, {
        node: { ...NODE, nodes: [NODE.nodes[0]] },
      });

      await expect(combobox(host)).toHaveCount(1);
    });

    test('lead down to the child chosen', async ({ page }) => {
      const host = await mount(page);

      await combobox(host).evaluate((el) =>
        el.dispatchEvent(
          new CustomEvent('combobox-select', {
            detail: { value: 'n-section-2' },
            bubbles: true,
            composed: true,
          })
        )
      );

      expect(await navigated(page)).toEqual(['n-section-2']);
    });

    test('offer nothing without children', async ({ page }) => {
      const host = await mount(page, { node: { ...NODE, nodes: [] } });

      await expect(combobox(host)).toHaveCount(0);
    });
  });
});
