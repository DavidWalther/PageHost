const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * `custom-node-contents` — the `content_node`s of one node, one below the
 * other, with adding a content as the action on the list.
 *
 * The page shows a node in two components: `custom-node-view` above for the
 * node itself, this one below for its contents. With the scope `edit` it is
 * always there, even empty: a list to add to. Without it an empty list hides.
 *
 * Mounted on its own; the page answers its queries as the application would.
 */

const NODE = {
  id: 'n-1',
  name: 'Node',
  reversed: null,
  nodes: [],
  contents: [1, 2, 3].map((number) => ({
    id: `c-${number}`,
    name: `Content ${number}`,
    sortnumber: number,
  })),
};

const EMPTY = { ...NODE, id: 'n-empty', contents: [] };

/**
 * Mounts the component and hands it `node` — through `adoptNode`, or with
 * `byId` through its `id`, which makes it ask for the node itself.
 */
async function mount(
  page,
  { node = NODE, scopes = [], attrs = {}, byId = false } = {}
) {
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ node, scopes, attrs, byId }) => {
      if (scopes.length > 0) {
        sessionStorage.setItem(
          'code_exchange_response',
          JSON.stringify({ authenticationResult: { access: { scopes } } })
        );
      }
      window.__queries = [];
      window.__created = [];
      document.body.addEventListener('query', (event) => {
        const { object, id } = event.detail.payload;
        window.__queries.push(object);
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
      document.body.addEventListener('create', (event) =>
        event.detail.callback(null, {
          result: { id: 'c-new', name: 'New', sortnumber: 99 },
        })
      );
      document.body.addEventListener('content-created', (event) =>
        window.__created.push(event.detail.content.id)
      );
      await import('/slds-components/slds-layout/slds-layout.js');
      await import('/slds-components/slds-layout/slds-layout-item.js');
      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/slds-components/slds-spinner/slds-spinner.js');
      await import('/components/custom-paragraph/custom-paragraph.js');
      await import('/components/custom-node-contents/custom-node-contents.js');
      const el = document.createElement('custom-node-contents');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      if (byId) {
        el.setAttribute('id', node.id);
      } else {
        el.adoptNode(node);
      }
      await el.updateComplete;
    },
    { node, scopes, attrs, byId }
  );
  return page.locator('custom-node-contents');
}

test.describe('custom-node-contents', () => {
  test.use({ actionTimeout: 5000 });

  test('shows the contents of an adopted node, in their order', async ({
    page,
  }) => {
    const host = await mount(page);

    await expect(host.locator('custom-paragraph')).toHaveCount(3);
    expect(
      await host
        .locator('custom-paragraph')
        .evaluateAll((all) => all.map((content) => content.id))
    ).toEqual(['c-1', 'c-2', 'c-3']);
    await expect(host).toBeVisible();
  });

  test('asks for the node itself when given only its id', async ({ page }) => {
    const host = await mount(page, { byId: true });

    await expect(host.locator('custom-paragraph')).toHaveCount(3);
    expect(await page.evaluate(() => window.__queries)).toContain('node');
  });

  test('shows the contents without a session too', async ({ page }) => {
    const host = await mount(page);

    await expect(host).toBeVisible();
    await expect(host.locator('#button-create-content')).toHaveCount(0);
  });

  test('hides an empty list without the scope edit', async ({ page }) => {
    const host = await mount(page, { node: EMPTY, scopes: ['create'] });

    await expect(host).toBeHidden();
    await expect(host.locator('custom-paragraph')).toHaveCount(0);
  });

  test('shows an empty list with the scope edit', async ({ page }) => {
    const host = await mount(page, {
      node: EMPTY,
      scopes: ['edit', 'create'],
      attrs: { 'can-create': true },
    });

    await expect(host).toBeVisible();
    await expect(host.locator('#button-create-content')).toBeVisible();
  });

  test('offers adding only with can-create and the scope create', async ({
    page,
  }) => {
    let host = await mount(page, { scopes: ['edit', 'create'] });
    await expect(host.locator('#button-create-content')).toHaveCount(0);

    host = await mount(page, {
      scopes: ['edit'],
      attrs: { 'can-create': true },
    });
    await expect(host.locator('#button-create-content')).toHaveCount(0);
  });

  test('adds a created content at the end and reports it', async ({ page }) => {
    const host = await mount(page, {
      node: EMPTY,
      scopes: ['edit', 'create'],
      attrs: { 'can-create': true },
    });

    await host.locator('#button-create-content').click();

    await expect(host.locator('custom-paragraph')).toHaveCount(1);
    expect(await page.evaluate(() => window.__created)).toEqual(['c-new']);
  });

  test('jumps to a content once everything before it has loaded', async ({
    page,
  }) => {
    const host = await mount(page, { attrs: { contentnumber: '3' } });

    await expect(host.locator('#node-contents')).toBeVisible();
    await expect(host.locator('custom-paragraph[no-display]')).toHaveCount(0);
  });

  // On the page the list stands on its own and needs a card of its own — on
  // the bare page background its text is hard to read in dark mode. Inside
  // custom-node it sits in that card already.
  test.describe('card', () => {
    test('puts the list into a card without header and footer', async ({
      page,
    }) => {
      // The attribute does not exist yet.
      test.fail();
      const host = await mount(page, { attrs: { card: true } });

      const card = host.locator('slds-card');
      await expect(card).toHaveCount(1, { timeout: 1000 });
      await expect(card).toHaveAttribute('no-header', '');
      await expect(card).toHaveAttribute('no-footer', '');
      await expect(card.locator('custom-paragraph')).toHaveCount(3);
    });

    test('without it there is no card', async ({ page }) => {
      const host = await mount(page);

      await expect(host.locator('custom-paragraph')).toHaveCount(3);
      await expect(host.locator('slds-card')).toHaveCount(0);
    });
  });
});
