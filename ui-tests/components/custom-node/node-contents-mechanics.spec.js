const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * How a node shows its contents: in chunks, in its order, with a jump to one
 * of them, and with a content added at the end.
 *
 * Guards for moving this mechanism into a component of its own: they hold for
 * `custom-node` as it is, and must hold unchanged afterwards. The node is
 * mounted on its own; the page answers its queries as the application would.
 */

const CONTENT_COUNT = 10;
const CHUNK_SIZE = 2;

const NODE = {
  id: 'n-1',
  name: 'Node with contents',
  parent_node_id: null,
  reversed: null,
  nodes: [],
  contents: Array.from({ length: CONTENT_COUNT }, (_, index) => ({
    id: `c-${index + 1}`,
    name: `Content ${index + 1}`,
    sortnumber: index + 1,
  })),
};

/**
 * Mounts the node. `scopes` go into the session before it renders; the page
 * answers `query` for the node and its contents and `create` for a content.
 */
async function mount(page, { node = NODE, attrs = {}, scopes = [] } = {}) {
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ node, attrs, scopes }) => {
      if (scopes.length > 0) {
        sessionStorage.setItem(
          'code_exchange_response',
          JSON.stringify({ authenticationResult: { access: { scopes } } })
        );
      }
      window.__toasts = [];
      document.body.addEventListener('toast', (event) =>
        window.__toasts.push(event.detail.message)
      );
      document.body.addEventListener('query', (event) => {
        const { object, id } = event.detail.payload;
        if (object === 'node') {
          event.detail.callback(null, node);
          return;
        }
        const entry = node.contents.find((content) => content.id === id);
        event.detail.callback(null, {
          ...entry,
          node_id: node.id,
          active_type: 'text',
          items: [{ type: 'text', content: `Text of ${id}` }],
        });
      });
      document.body.addEventListener('create', (event) => {
        event.detail.callback(null, {
          result: { id: 'c-new', name: 'New', sortnumber: 99 },
        });
      });
      await import('/slds-components/slds-card/slds-card.js');
      await import('/slds-components/slds-layout/slds-layout.js');
      await import('/slds-components/slds-layout/slds-layout-item.js');
      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/slds-components/slds-spinner/slds-spinner.js');
      await import('/components/custom-paragraph/custom-paragraph.js');
      await import('/components/custom-node/custom-node.js');
      const el = document.createElement('custom-node');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      el.setAttribute('id', node.id);
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { node, attrs, scopes }
  );
  return page.locator('custom-node');
}

/** Which contents wait to be loaded, in the order shown. */
const waiting = (host) =>
  host
    .locator('custom-paragraph')
    .evaluateAll((all) =>
      all.map((content) => content.hasAttribute('no-load'))
    );

const sortNumbers = (host) =>
  host
    .locator('custom-paragraph')
    .evaluateAll((all) =>
      all.map((content) => Number(content.dataset.sortNumber))
    );

test.describe('Node: how the contents are shown', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    // Low enough that the last chunk is out of reach until scrolled to.
    await page.setViewportSize({ width: 800, height: 400 });
  });

  test('loads the first chunk at once and the last one only when scrolled to', async ({
    page,
  }) => {
    const host = await mount(page, {
      attrs: { 'loading-chunk-size': String(CHUNK_SIZE) },
    });
    await expect(host.locator('custom-paragraph')).toHaveCount(CONTENT_COUNT);

    await expect
      .poll(async () => (await waiting(host)).slice(0, 2))
      .toEqual([false, false]);
    expect((await waiting(host)).slice(-2)).toEqual([true, true]);

    // Scrolling down keeps pulling in the next chunk until none is left.
    await expect
      .poll(
        async () => {
          await page.mouse.wheel(0, 2000);
          return (await waiting(host)).some(Boolean);
        },
        { timeout: 10000 }
      )
      .toBe(false);
  });

  test('shows the contents in their order, reversed when the node says so', async ({
    page,
  }) => {
    let host = await mount(page);
    await expect(host.locator('custom-paragraph')).toHaveCount(CONTENT_COUNT);
    expect(await sortNumbers(host)).toEqual(
      NODE.contents.map((content) => content.sortnumber)
    );

    host = await mount(page, { node: { ...NODE, reversed: true } });
    await expect(host.locator('custom-paragraph')).toHaveCount(CONTENT_COUNT);
    expect(await sortNumbers(host)).toEqual(
      NODE.contents.map((content) => content.sortnumber).reverse()
    );
  });

  test('jumps to a content once everything before it has loaded', async ({
    page,
  }) => {
    const host = await mount(page, {
      attrs: { 'loading-chunk-size': String(CHUNK_SIZE), contentnumber: '7' },
    });

    await expect(host.locator('slds-card')).toBeVisible();
    await expect(host.locator('custom-paragraph[no-display]')).toHaveCount(0);
    await expect(
      host.locator('custom-paragraph[data-sort-number="7"]')
    ).toBeInViewport();
  });

  test('adds a created content at the end and says so', async ({ page }) => {
    const host = await mount(page, {
      attrs: { 'can-create-content': true },
      scopes: ['create'],
    });
    await expect(host.locator('custom-paragraph')).toHaveCount(CONTENT_COUNT);

    await host.locator('#button-create-content').click();

    await expect(host.locator('custom-paragraph')).toHaveCount(
      CONTENT_COUNT + 1
    );
    expect(await sortNumbers(host)).toEqual([
      ...NODE.contents.map((content) => content.sortnumber),
      99,
    ]);
    await expect
      .poll(() => page.evaluate(() => window.__toasts))
      .toContain('Inhalt erstellt');
  });
});
