const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Going back in the navigation modal: the page follows.
 *
 * Going down, the page shows the opened node; going up it shows the level now
 * open — the node the modal's heading names, above the node itself, below its
 * contents. The modal stays open. Back onto the top level changes nothing:
 * there is no node to show.
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
    const view = root.querySelector('custom-node-view');
    const contents = root.querySelector('custom-node-contents');
    const modal = root.querySelector('custom-navigation-modal');
    return {
      viewId: view.getAttribute('id'),
      contentsId: contents.getAttribute('id'),
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
const viewName = (page) => page.locator('custom-node-view #node-name');

/** Waits until both components stand on `id`. */
const expectShown = (page, id) =>
  expect
    .poll(async () => {
      const state = await readPage(page);
      return [state.viewId, state.contentsId];
    })
    .toEqual([id, id]);

test.describe('Page: going back in the navigation modal', () => {
  test.use({ actionTimeout: 5000 });

  test('shows the level now open, the modal stays open', async ({ page }) => {
    await open(page);
    await tile(page, 'Book').click();
    await tile(page, 'Part').click();
    await expect(tile(page, 'Section')).toBeVisible();
    await expectShown(page, 'part');

    await back(page).click();

    await expectShown(page, 'book');
    await expect(viewName(page)).toHaveText('Book');
    expect((await readPage(page)).modalOpen).toBe(true);
    // The page stands on the open level itself, not on one of its tiles.
    await expect(tile(page, 'Part')).not.toHaveClass(/tile_current/);
  });

  test('back onto the top level leaves the page as it is', async ({ page }) => {
    await open(page);
    await tile(page, 'Book').click();
    await expect(tile(page, 'Part')).toBeVisible();
    await expectShown(page, 'book');
    const before = await readPage(page);

    await back(page).click();

    await expect(tile(page, 'Book')).toBeVisible();
    expect(await readPage(page)).toEqual(before);
  });

  // A leaf opened as a level (the modified click) does not move the page —
  // the modal reports nothing for it. Back from there shows its parent,
  // which the page already shows.
  test('back out of a leaf opened as a level shows its parent', async ({
    page,
  }) => {
    await open(page, { scopes: ['read', 'create'] });
    await tile(page, 'Book').click();
    await tile(page, 'Leaf').click({ modifiers: ['ControlOrMeta'] });
    await expect(tile(page, 'Leaf')).toHaveCount(0);
    await expectShown(page, 'book');

    await back(page).click();

    await expectShown(page, 'book');
    expect((await readPage(page)).modalOpen).toBe(true);
  });
});
