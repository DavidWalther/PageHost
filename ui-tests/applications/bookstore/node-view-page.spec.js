const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * The page shows one node, in two components that always refer to it:
 * `custom-node-view` above (the node itself) and `custom-node-contents` below
 * (its contents). Every way through the tree ends at exactly one node — the
 * navigation modal, a deep link, the combobox of the children, an arrow to a
 * sibling. There are no breadcrumbs: the way up is the modal's.
 *
 *   shelf
 *   ├─ book-a            (one content)
 *   │  ├─ part-1         (two contents)
 *   │  └─ part-2         (none)
 *   └─ book-b
 *   other
 */

const TREE_NODES = [
  { id: 'shelf', name: 'Shelf', parent_node_id: null },
  { id: 'book-a', name: 'Book A', parent_node_id: 'shelf' },
  { id: 'part-1', name: 'Part 1', parent_node_id: 'book-a' },
  { id: 'part-2', name: 'Part 2', parent_node_id: 'book-a' },
  { id: 'book-b', name: 'Book B', parent_node_id: 'shelf' },
  { id: 'other', name: 'Other', parent_node_id: null },
];

const CONTENTS = {
  'book-a': [{ id: 'c-a1', name: 'Content A1', sortnumber: 1 }],
  'part-1': [
    { id: 'c-p1', name: 'Content P1', sortnumber: 1 },
    { id: 'c-p2', name: 'Content P2', sortnumber: 2 },
  ],
};

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

function nodeRecord(id) {
  const node = TREE_NODES.find((entry) => entry.id === id);
  if (!node) return null;
  return {
    ...node,
    legacy_id: null,
    sortnumber: 1,
    reversed: null,
    published_date: '2022-01-01 00:00:00',
    nodes: childrenOf(id).map((child, index) => ({
      ...child,
      sortnumber: index + 1,
    })),
    contents: CONTENTS[id] ?? [],
  };
}

function contentRecord(id) {
  for (const [nodeId, contents] of Object.entries(CONTENTS)) {
    const content = contents.find((entry) => entry.id === id);
    if (content) {
      return {
        ...content,
        node_id: nodeId,
        published_date: '2022-01-01 00:00:00',
        active_type: 'text',
        items: [{ id: `${id}-t`, type: 'text', content: `Text of ${id}` }],
      };
    }
  }
  return null;
}

/** How often each node was asked for. */
let nodeQueries;

/**
 * Opens the application at `path`. Requests for the tree above are answered
 * here; everything else (metadata, the feeds) by the shared mocks.
 */
async function open(page, path = '/', { scopes = null } = {}) {
  nodeQueries = {};
  if (scopes) {
    await withSession(page, scopes);
  }
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) =>
    route.fulfill({ json: { result: treeBelow(null) } })
  );
  await page.route('**/data/query/node**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    const record = nodeRecord(id);
    if (!record) return route.fallback();
    nodeQueries[id] = (nodeQueries[id] ?? 0) + 1;
    return route.fulfill({ json: record });
  });
  await page.route('**/data/query/content**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    const record = contentRecord(id);
    return record ? route.fulfill({ json: record }) : route.fallback();
  });
  await cacheLitBundle(page);
  await page.goto(path);
  await expect(page.locator('app-bookstore')).toBeAttached();
}

const view = (page) => page.locator('custom-node-view');
const contents = (page) => page.locator('custom-node-contents');

/** What the page shows: both components, the trail, the arrows. */
function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const upper = root.querySelector('custom-node-view');
    const lower = root.querySelector('custom-node-contents');
    const modal = root.querySelector('custom-navigation-modal');
    return {
      viewId: upper?.getAttribute('id') ?? null,
      contentsId: lower?.getAttribute('id') ?? null,
      previous: upper?.siblings?.previous?.id ?? null,
      next: upper?.siblings?.next?.id ?? null,
      feedsVisible: !root
        .querySelector('#feeds')
        .classList.contains('slds-hide'),
      modalOpen: modal.shadowRoot
        .querySelector('#modal-navigation')
        .hasAttribute('open'),
    };
  });
}

/**
 * Counts the calls of `reload()` on both components from now on. Both ask for
 * the same node, so the requests alone cannot tell which of them reloaded.
 */
function countReloads(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    window.__reloads = { view: 0, contents: 0 };
    for (const [key, selector] of [
      ['view', 'custom-node-view'],
      ['contents', 'custom-node-contents'],
    ]) {
      const element = root.querySelector(selector);
      const original = element.reload.bind(element);
      element.reload = () => {
        window.__reloads[key] += 1;
        original();
      };
    }
  });
}

const readReloads = (page) => page.evaluate(() => window.__reloads);

/** Fires an event on the application, as the components inside it do. */
function fireOnHost(page, name, detail) {
  return page
    .locator('app-bookstore')
    .evaluate(
      (host, [name, detail]) =>
        host.dispatchEvent(new CustomEvent(name, { detail })),
      [name, detail]
    );
}

/** Waits until both components stand on `id`. */
async function expectShown(page, id) {
  await expect
    .poll(async () => {
      const state = await readPage(page);
      return [state.viewId, state.contentsId];
    })
    .toEqual([id, id]);
  await expect(view(page).locator('#node-name')).toHaveText(
    TREE_NODES.find((node) => node.id === id).name
  );
}

const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile').filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const back = (page) => page.locator('custom-navigation-modal #button-back');

async function openModal(page) {
  await page.locator('#button-navigation_open').click();
  await expect(tile(page, 'Shelf')).toBeVisible();
}

test.describe('Page: one node, above and below', () => {
  test.use({ actionTimeout: 5000 });

  test.describe('a deep link', () => {
    test('shows the node above and its contents below', async ({ page }) => {
      await open(page, '/part-1');

      await expectShown(page, 'part-1');
      const state = await readPage(page);
      expect([state.previous, state.next]).toEqual([null, 'part-2']);
      await expect(view(page).locator('slds-breadcrumbs')).toHaveCount(0);
      await expect(contents(page).locator('custom-paragraph')).toHaveCount(2);
    });

    test('to a root shows the root itself', async ({ page }) => {
      await open(page, '/shelf');

      await expectShown(page, 'shelf');
      const state = await readPage(page);
      expect([state.previous, state.next]).toEqual([null, 'other']);
    });

    test('to a content shows its node and jumps to it', async ({ page }) => {
      await open(page, '/c-p2');

      await expectShown(page, 'part-1');
      await expect(
        contents(page).locator('custom-paragraph[id="c-p2"]')
      ).toBeInViewport();
    });
  });

  test.describe('the navigation modal', () => {
    test('opening a level shows its node, the modal stays open', async ({
      page,
    }) => {
      await open(page);
      await openModal(page);

      await tile(page, 'Shelf').click();
      await tile(page, 'Book A').click();

      await expectShown(page, 'book-a');
      expect((await readPage(page)).modalOpen).toBe(true);
    });

    test('choosing a tile without children shows it and closes', async ({
      page,
    }) => {
      await open(page);
      await openModal(page);

      await tile(page, 'Shelf').click();
      await tile(page, 'Book B').click();

      await expectShown(page, 'book-b');
      expect((await readPage(page)).modalOpen).toBe(false);
      expect((await readPage(page)).feedsVisible).toBe(false);
    });

    test('back shows the level now open; the top level changes nothing', async ({
      page,
    }) => {
      await open(page);
      await openModal(page);
      await tile(page, 'Shelf').click();
      await tile(page, 'Book A').click();
      await expectShown(page, 'book-a');

      await back(page).click();
      await expectShown(page, 'shelf');

      await back(page).click();
      await expect(tile(page, 'Other')).toBeVisible();
      await expectShown(page, 'shelf');
    });
  });

  test.describe('the ways in the node view', () => {
    test('a child chosen in the combobox becomes the node shown', async ({
      page,
    }) => {
      await open(page, '/book-a');
      await expectShown(page, 'book-a');

      await view(page)
        .locator('slds-combobox')
        .evaluate((el) =>
          el.dispatchEvent(
            new CustomEvent('combobox-select', {
              detail: { value: 'part-2' },
              bubbles: true,
              composed: true,
            })
          )
        );

      await expectShown(page, 'part-2');
    });

    test('the arrows lead to the siblings', async ({ page }) => {
      await open(page, '/part-1');
      await expectShown(page, 'part-1');

      await view(page).locator('#button-next').click();
      await expectShown(page, 'part-2');
      expect((await readPage(page)).previous).toBe('part-1');

      await view(page).locator('#button-previous').click();
      await expectShown(page, 'part-1');
    });

    test('the node is fetched once for both components', async ({ page }) => {
      await open(page, '/book-a');
      await expectShown(page, 'book-a');

      await view(page).locator('#button-next').click();
      await expectShown(page, 'book-b');

      expect(nodeQueries['book-b']).toBe(1);
    });
  });

  test.describe('the contents below', () => {
    test('are hidden without a session while there are none', async ({
      page,
    }) => {
      await open(page, '/part-2');
      await expect
        .poll(async () => (await readPage(page)).viewId)
        .toBe('part-2');

      await expect(contents(page)).toBeHidden();
      await expect(contents(page)).toHaveCSS('display', 'none');
    });

    test('give way at once when another node is chosen', async ({ page }) => {
      // Before, the old list stayed until the next node had arrived, and was
      // then replaced content by content.
      await open(page, '/book-a');
      await expectShown(page, 'book-a');
      await expect(contents(page).locator('custom-paragraph')).toHaveCount(1);

      let release;
      const held = new Promise((resolve) => (release = resolve));
      await page.route('**/data/query/node?id=part-1', async (route) => {
        await held;
        return route.fallback();
      });

      await view(page)
        .locator('slds-combobox')
        .evaluate((el) =>
          el.dispatchEvent(
            new CustomEvent('combobox-select', {
              detail: { value: 'part-1' },
              bubbles: true,
              composed: true,
            })
          )
        );
      await expect
        .poll(async () => (await readPage(page)).viewId)
        .toBe('part-1');

      // The next node is still on its way: nothing of the old one stays.
      await expect(contents(page).locator('custom-paragraph')).toHaveCount(0);

      release();
      await expectShown(page, 'part-1');
      await expect(contents(page).locator('custom-paragraph')).toHaveCount(2);
      await expect(
        contents(page).locator('custom-paragraph[id="c-p1"]')
      ).toBeAttached();
    });

    test('stand in a card of their own', async ({ page }) => {
      await open(page, '/part-1');
      await expectShown(page, 'part-1');

      await expect(
        contents(page).locator('slds-card custom-paragraph')
      ).toHaveCount(2);
    });

    test('are shown with the scope edit, also while there are none', async ({
      page,
    }) => {
      await open(page, '/part-2', { scopes: ['read', 'edit', 'create'] });
      await expectShown(page, 'part-2');

      await expect(contents(page)).toBeVisible();
      await expect(
        contents(page).locator('#button-create-content')
      ).toBeVisible();
    });
  });

  test.describe('after a change to the node shown', () => {
    test('a deleted node gives way to its parent', async ({ page }) => {
      await open(page, '/part-1');
      await expectShown(page, 'part-1');

      await page.locator('app-bookstore').evaluate((host) =>
        host.dispatchEvent(
          new CustomEvent('node-deleted', {
            detail: { nodeId: 'part-1', nodeIds: ['part-1'] },
          })
        )
      );

      await expectShown(page, 'book-a');
    });

    test('a deleted root gives way to the start page', async ({ page }) => {
      await open(page, '/other');
      await expectShown(page, 'other');

      await page.locator('app-bookstore').evaluate((host) =>
        host.dispatchEvent(
          new CustomEvent('node-deleted', {
            detail: { nodeId: 'other', nodeIds: ['other'] },
          })
        )
      );

      await expect
        .poll(async () => (await readPage(page)).feedsVisible)
        .toBe(true);
    });

    // A child created in the navigation modal belongs in the combobox of the
    // node shown: the view fetches the node again.
    test('a child created below it is fetched into the node view', async ({
      page,
    }) => {
      await open(page, '/book-a');
      await expectShown(page, 'book-a');
      const before = nodeQueries['book-a'];

      await page.locator('app-bookstore').evaluate((host) =>
        host.dispatchEvent(
          new CustomEvent('chapter-created', {
            detail: { chapterData: { id: 'part-3', parent_node_id: 'book-a' } },
          })
        )
      );

      await expect.poll(() => nodeQueries['book-a']).toBe(before + 1);
    });

    // The view takes over its own edits; the contents below follow, their
    // order may have turned.
    test('the node shown changed: the contents follow, the view does not', async ({
      page,
    }) => {
      await open(page, '/part-1');
      await expectShown(page, 'part-1');
      await countReloads(page);
      const before = nodeQueries['part-1'];

      await fireOnHost(page, 'chapter-updated', {
        chapterData: { id: 'part-1', name: 'Part 1', parent_node_id: 'book-a' },
      });

      await expect.poll(() => nodeQueries['part-1']).toBe(before + 1);
      // Give a second, unwanted request the time to go out.
      await page.waitForTimeout(500);
      expect(nodeQueries['part-1']).toBe(before + 1);
      expect(await readReloads(page)).toEqual({ view: 0, contents: 1 });
    });

    // Without `parent_node_id` only the tree knows that it is a child.
    test('a child of it renamed is fetched into the node view', async ({
      page,
    }) => {
      await open(page, '/book-a');
      await expectShown(page, 'book-a');
      // The tree has arrived once the arrow to the sibling stands.
      await expect.poll(async () => (await readPage(page)).next).toBe('book-b');
      await countReloads(page);
      const before = nodeQueries['book-a'];

      await fireOnHost(page, 'chapter-updated', {
        chapterData: { id: 'part-2', name: 'Part 2 renamed' },
      });

      await expect.poll(() => nodeQueries['book-a']).toBe(before + 1);
      expect(await readReloads(page)).toEqual({ view: 1, contents: 0 });
    });

    test('a moved node stays shown and is fetched again', async ({ page }) => {
      await open(page, '/part-1');
      await expectShown(page, 'part-1');
      const before = nodeQueries['part-1'];

      await page.locator('app-bookstore').evaluate((host) =>
        host.dispatchEvent(
          new CustomEvent('node-moved', {
            detail: { nodeId: 'part-1', toParentId: 'book-b' },
          })
        )
      );

      await expect.poll(() => nodeQueries['part-1']).toBe(before + 1);
      await expectShown(page, 'part-1');
    });
  });
});
