const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Going back in the navigation modal: the page follows.
 *
 * Going down, the page shows the opened node. Going up it shows the level now
 * open above and, below, the node the visitor comes from — chosen, as if it
 * had been picked in the modal, but the modal stays open. Back onto the top
 * level changes nothing: there is no node to show above.
 *
 *   book
 *   ├─ part
 *   │  └─ section
 *   └─ leaf
 */

const TREE_NODES = [
  { id: 'book', name: 'Book', parent_node_id: null },
  { id: 'part', name: 'Part', parent_node_id: 'book' },
  { id: 'section', name: 'Section', parent_node_id: 'part' },
  { id: 'leaf', name: 'Leaf', parent_node_id: 'book' },
];

const childrenOf = (id) =>
  TREE_NODES.filter((node) => node.parent_node_id === id);

const treeBelow = (id) =>
  childrenOf(id).map((node, index) => ({
    id: node.id,
    label: node.name,
    name: node.name,
    sortnumber: index + 1,
    childnodes: treeBelow(node.id),
  }));

function record(id) {
  const node = TREE_NODES.find((entry) => entry.id === id);
  if (!node) return {};
  return {
    ...node,
    legacy_id: null,
    sortnumber: 1,
    published_date: '2022-01-01 00:00:00',
    nodes: childrenOf(id).map((child, index) => ({
      ...child,
      sortnumber: index + 1,
    })),
    contents: [],
  };
}

async function open(page, { scopes = null } = {}) {
  if (scopes) {
    await withSession(page, scopes);
  }
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) =>
    route.fulfill({ json: { result: treeBelow(null) } })
  );
  await page.route('**/data/query/node**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    return route.fulfill({ json: record(id) });
  });
  await cacheLitBundle(page);
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await page.locator('#button-navigation_open').click();
  await expect(tile(page, 'Book')).toBeVisible();
}

function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const upper = root.querySelector('custom-node[data-role="navigation"]');
    const lower = root.querySelector('custom-node[data-role="content"]');
    const modal = root.querySelector('custom-navigation-modal');
    return {
      upperId: upper.getAttribute('id'),
      selectedChild: upper.getAttribute('selected-child'),
      lowerId: lower.getAttribute('id'),
      modalOpen: modal.shadowRoot
        .querySelector('#modal-navigation')
        .hasAttribute('open'),
    };
  });
}

const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile').filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const back = (page) => page.locator('custom-navigation-modal #button-back');
const lowerName = (page) =>
  page.locator('custom-node[data-role="content"] #node-name');

test.describe('Page: going back in the navigation modal', () => {
  test.use({ actionTimeout: 5000 });

  test('shows the level now open above and the node left below', async ({
    page,
  }) => {
    test.fail();
    await open(page);
    await tile(page, 'Book').click();
    await tile(page, 'Part').click();
    await expect(tile(page, 'Section')).toBeVisible();
    await expect.poll(async () => (await readPage(page)).upperId).toBe('part');

    await back(page).click();

    await expect.poll(async () => (await readPage(page)).upperId).toBe('book');
    const state = await readPage(page);
    expect(state.lowerId).toBe('part');
    expect(state.selectedChild).toBe('part');
    expect(state.modalOpen).toBe(true);
    await expect(lowerName(page)).toHaveText('Part');
    // The modal marks where the page stands: the node left, on the open level.
    await expect(tile(page, 'Part')).toHaveClass(/tile_current/);
    await expect(tile(page, 'Leaf')).not.toHaveClass(/tile_current/);
  });

  test('back onto the top level leaves the page as it is', async ({ page }) => {
    await open(page);
    await tile(page, 'Book').click();
    await expect(tile(page, 'Part')).toBeVisible();
    await expect.poll(async () => (await readPage(page)).upperId).toBe('book');
    const before = await readPage(page);

    await back(page).click();

    await expect(tile(page, 'Book')).toBeVisible();
    expect(await readPage(page)).toEqual(before);
  });

  test('back out of a leaf opened as a level shows the leaf below', async ({
    page,
  }) => {
    test.fail();
    await open(page, { scopes: ['read', 'create'] });
    await tile(page, 'Book').click();
    await tile(page, 'Leaf').click({ modifiers: ['ControlOrMeta'] });
    await expect(tile(page, 'Leaf')).toHaveCount(0);

    await back(page).click();

    await expect.poll(async () => (await readPage(page)).lowerId).toBe('leaf');
    const state = await readPage(page);
    expect(state.upperId).toBe('book');
    expect(state.selectedChild).toBe('leaf');
    expect(state.modalOpen).toBe(true);
  });
});
