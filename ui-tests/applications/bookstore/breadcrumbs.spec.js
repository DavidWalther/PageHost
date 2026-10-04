const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_CONTENTS,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * The breadcrumb row below the header.
 *
 * It lists the **ancestors** of the node the page stands on — never that node
 * itself, which the node card below already names. Its job is to go up: a
 * click shows the ancestor itself (above), with nothing below and without the
 * ancestor's cover node.
 */

const crumbs = (page) => page.locator('app-bookstore slds-breadcrumbs li');
const crumbLink = (page, text) =>
  page.locator('app-bookstore slds-breadcrumbs a', { hasText: text });
const openModal = (page) => page.locator('#button-navigation_open').click();
const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile', {
    hasText: new RegExp(`^\\s*${text}\\s*$`),
  });

/** id and selected-child of both nodes on the page. */
function readNodes(page) {
  return page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    const read = (role) => {
      const node = app.shadowRoot.querySelector(
        `custom-node[data-role="${role}"]`
      );
      return {
        id: node.getAttribute('id'),
        selectedChild: node.getAttribute('selected-child'),
      };
    };
    return { navigation: read('navigation'), content: read('content') };
  });
}

async function open(page, path) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await page.goto(path);
  await expect(page.locator('app-bookstore')).toBeAttached();
}

test.describe('Breadcrumbs', () => {
  test.use({ actionTimeout: 5000 });

  test('shows only the home item on a root node', async ({ page }) => {
    await open(page, '/');
    await expect
      .poll(async () => (await readNodes(page)).navigation.id)
      .toBe('000s00000000000011');
    // The tree has arrived (the modal knows the entry) — still no row.
    await openModal(page);
    await expect(tile(page, 'Mock Story 1')).toHaveClass(/tile_current/);

    await expect(crumbs(page)).toHaveText(['Startseite']);
  });

  test('the home item links the start page and shows the home icon', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');

    const home = page.locator('app-bookstore slds-breadcrumbs li').first();
    await expect(home.locator('a')).toHaveAttribute('href', '/');
    const iconHref = await home
      .locator('svg use')
      .evaluate((use) => use.href.baseVal);
    expect(iconHref).toBe('/assets/icons/utility-sprite/svg/symbols.svg#home');
  });

  test('lists the ancestors of the shown node, not the node itself', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');

    await expect(crumbs(page)).toHaveText(['Startseite', 'Mock Story 1']);
    await expect(crumbLink(page, 'Mock Story 1')).toHaveAttribute(
      'href',
      '/000n00000000000011'
    );
  });

  test('marks no item as the current page', async ({ page }) => {
    await open(page, '/000c00000000000002');
    await expect(crumbs(page)).toHaveText(['Startseite', 'Mock Story 1']);

    // The last item is the parent, not the page — a screen reader must not
    // announce it as the current one.
    await expect(
      page.locator('app-bookstore slds-breadcrumbs li[aria-current]')
    ).toHaveCount(0);
  });

  test('clicking the parent empties the lower node and keeps no cover', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');
    await expect(crumbs(page)).toHaveText(['Startseite', 'Mock Story 1']);

    await crumbLink(page, 'Mock Story 1').click();

    // Mock Story 1 has a cover node (000n…01). Going up shows the story
    // itself: it stays above, nothing below — not its cover.
    await expect
      .poll(async () => (await readNodes(page)).content.id)
      .toBeNull();
    const nodes = await readNodes(page);
    expect(nodes.navigation.id).toBe('000n00000000000011');
    expect(nodes.navigation.selectedChild).toBeNull();
    await expect(crumbs(page)).toHaveText(['Startseite']);
  });

  test('follows a reload of the tree after a node changed', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');
    await expect(crumbs(page)).toHaveText(['Startseite', 'Mock Story 1']);
    const renamed = {
      result: [
        { ...MOCK_CONTENTS.result[0], name: 'Mock Story 1 (renamed)' },
        ...MOCK_CONTENTS.result.slice(1),
      ],
    };
    await page.route('**/api/1.0/contents/**', (route) =>
      route.fulfill({ json: renamed })
    );

    await page.evaluate(() =>
      document
        .querySelector('app-bookstore')
        .shadowRoot.querySelector('custom-node[data-role="navigation"]')
        .dispatchEvent(
          new CustomEvent('chapter-updated', {
            detail: { chapterData: { id: '000n00000000000011' } },
            bubbles: true,
            composed: true,
          })
        )
    );

    await expect(crumbs(page)).toHaveText([
      'Startseite',
      'Mock Story 1 (renamed)',
    ]);
  });
});

test.describe('Breadcrumbs in a deep tree', () => {
  test.use({ actionTimeout: 5000 });

  const DEEP_TREE = {
    result: [
      {
        id: 'd-root',
        label: 'Deep Root',
        name: 'Deep Root',
        childnodes: [
          {
            id: 'd-2',
            label: 'Deep Level 2',
            name: 'Deep Level 2',
            childnodes: [
              {
                id: 'd-3',
                label: 'Deep Level 3',
                name: 'Deep Level 3',
                childnodes: [
                  {
                    id: 'd-4',
                    label: 'Deep Level 4',
                    name: 'Deep Level 4',
                    childnodes: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  /** Node records for the deep tree; the root has a cover node. */
  const record = (id, name, parent, extra = {}) => ({
    id,
    legacy_id: null,
    name,
    description: null,
    sortnumber: 1,
    reversed: null,
    parent_node_id: parent,
    cover_node_id: null,
    published_date: '2022-01-01 00:00:00',
    nodes: [],
    contents: [],
    ...extra,
  });
  const DEEP_NODES = {
    'd-root': record('d-root', 'Deep Root', null, {
      cover_node_id: 'd-2',
      nodes: [record('d-2', 'Deep Level 2', 'd-root')],
    }),
    'd-2': record('d-2', 'Deep Level 2', 'd-root', {
      cover_node_id: 'd-3',
      nodes: [record('d-3', 'Deep Level 3', 'd-2')],
    }),
    'd-3': record('d-3', 'Deep Level 3', 'd-2', {
      nodes: [record('d-4', 'Deep Level 4', 'd-3')],
    }),
    'd-4': record('d-4', 'Deep Level 4', 'd-3'),
  };

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await page.route('**/api/1.0/contents/**', (route) =>
      route.fulfill({ json: DEEP_TREE })
    );
    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      return DEEP_NODES[id]
        ? route.fulfill({ json: DEEP_NODES[id] })
        : route.fallback();
    });
    await cacheLitBundle(page);
    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();

    // Choose the node on level 4 in the modal.
    await openModal(page);
    await tile(page, 'Deep Root').click();
    await tile(page, 'Deep Level 2').click();
    await tile(page, 'Deep Level 3').click();
    await tile(page, 'Deep Level 4').click();
  });

  test('collapses a long path to home › … › grandparent › parent', async ({
    page,
  }) => {
    await expect(crumbs(page)).toHaveText([
      'Startseite',
      '…',
      'Deep Level 2',
      'Deep Level 3',
    ]);
  });

  test('clicking a distant ancestor shows it without its cover node', async ({
    page,
  }) => {
    await expect(crumbs(page)).toHaveText([
      'Startseite',
      '…',
      'Deep Level 2',
      'Deep Level 3',
    ]);

    await crumbLink(page, 'Deep Level 2').click();

    await expect
      .poll(async () => (await readNodes(page)).navigation.id)
      .toBe('d-2');
    // Wait for the node to load: without the guard its cover d-3 would land
    // below now.
    await page.waitForTimeout(500);
    expect((await readNodes(page)).content.id).toBeNull();
    await expect(crumbs(page)).toHaveText(['Startseite', 'Deep Root']);
  });

  test('clicking the parent keeps it above and lists its ancestors', async ({
    page,
  }) => {
    await crumbLink(page, 'Deep Level 3').click();

    await expect
      .poll(async () => (await readNodes(page)).content.id)
      .toBeNull();
    expect((await readNodes(page)).navigation.id).toBe('d-3');
    await expect(crumbs(page)).toHaveText([
      'Startseite',
      'Deep Root',
      'Deep Level 2',
    ]);
  });
});
