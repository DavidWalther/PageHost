const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_CONTENTS,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * The page shows **one** node.
 *
 * What it shows depends on how the visitor got there; the location is always
 * the id of that node. The cover node of a node is shown only on the start
 * page and after drilling into a node in the navigation modal — every other
 * way shows exactly the node that was chosen.
 */

const FAIL = 'the page still shows two nodes (#209)';

/** What the one node shows. */
function readNode(page) {
  return page.evaluate(() => {
    const nodes = document
      .querySelector('app-bookstore')
      .shadowRoot.querySelectorAll('custom-node');
    const node = nodes[nodes.length - 1];
    const root = node.shadowRoot;
    return {
      count: nodes.length,
      id: node.getAttribute('id'),
      name: root.querySelector('#node-name')?.textContent.trim() ?? null,
      childButtons: [
        ...root.querySelectorAll('#child-navigation button[data-node-id]'),
      ].map((button) => button.textContent.trim()),
      hasCombobox: !!root.querySelector('#child-navigation slds-combobox'),
      contents: root.querySelectorAll('custom-paragraph').length,
      childrenBeforeContents: (() => {
        const children = root.querySelector('#child-navigation');
        const contents = root.querySelector('#node-content');
        if (!children || !contents) {
          return null;
        }
        return !!(
          children.compareDocumentPosition(contents) &
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      })(),
    };
  });
}

const crumbs = (page) => page.locator('app-bookstore slds-breadcrumbs li');
const openModal = (page) => page.locator('#button-navigation_open').click();
const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile').filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const modal = (page) => page.locator('custom-navigation-modal slds-modal');

async function open(page, path, extraRoutes) {
  await mockBookstoreCallouts(page);
  if (extraRoutes) {
    await extraRoutes(page);
  }
  await cacheLitBundle(page);
  await page.goto(path);
  await expect(page.locator('app-bookstore')).toBeAttached();
}

/** Extra node records, answered before the shared mock. */
function routeNodes(records) {
  return (page) =>
    page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      return records[id]
        ? route.fulfill({ json: records[id] })
        : route.fallback();
    });
}

const child = (id, name, parent, extra = {}) => ({
  ...MOCK_NODES.kind2,
  id,
  legacy_id: null,
  name,
  parent_node_id: parent,
  nodes: [],
  contents: [],
  ...extra,
});

test.describe('One node on the page', () => {
  test.use({ actionTimeout: 5000 });

  test('the page holds exactly one node', async ({ page }) => {
    test.fail(true, FAIL);
    await open(page, '/000c00000000000002');
    await expect.poll(async () => (await readNode(page)).name).toBeTruthy();

    expect((await readNode(page)).count).toBe(1);
  });

  test('the start page shows the cover node of the entry node', async ({
    page,
  }) => {
    test.fail(true, FAIL);
    await open(page, '/');

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000001');
    expect((await readNode(page)).count).toBe(1);
    // The location is the cover node, so the path is its parent.
    await expect(crumbs(page)).toHaveText(['Startseite', 'Mock Story 1']);
  });

  test('a deep link to a root shows the root itself, with its children', async ({
    page,
  }) => {
    test.fail(true, FAIL);
    await open(page, '/000s00000000000011');

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000011');
    const node = await readNode(page);
    expect(node.count).toBe(1);
    expect(node.childButtons).toEqual([
      'Mock Chapter 1 for Story 1',
      'Mock Chapter 2 for Story 1',
    ]);
  });

  test('a deep link to a child shows that child', async ({ page }) => {
    test.fail(true, FAIL);
    await open(page, '/000c00000000000002');

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000002');
    expect((await readNode(page)).count).toBe(1);
  });

  test('choosing a child in the node shows the child', async ({ page }) => {
    test.fail(true, FAIL);
    await open(page, '/000s00000000000011');
    await expect
      .poll(async () => (await readNode(page)).childButtons.length)
      .toBe(2);

    await page
      .locator('app-bookstore custom-node button[data-node-id]', {
        hasText: 'Mock Chapter 2 for Story 1',
      })
      .click();

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000002');
    await expect(crumbs(page)).toHaveText(['Startseite', 'Mock Story 1']);
  });

  test('more than two children show as a combobox', async ({ page }) => {
    test.fail(true, FAIL);
    await open(
      page,
      '/n-three',
      routeNodes({
        'n-three': child('n-three', 'Three Children', null, {
          nodes: [
            child('n-a', 'A', 'n-three'),
            child('n-b', 'B', 'n-three'),
            child('n-c', 'C', 'n-three'),
          ],
        }),
      })
    );

    await expect
      .poll(async () => (await readNode(page)).hasCombobox)
      .toBe(true);
    expect((await readNode(page)).count).toBe(1);
  });

  test('a node with children and contents lists the children first', async ({
    page,
  }) => {
    test.fail(true, FAIL);
    await open(
      page,
      '/n-both',
      routeNodes({
        'n-both': child('n-both', 'Both', null, {
          nodes: [child('n-a', 'A', 'n-both')],
          contents: [MOCK_NODES.kind1.contents[0]],
        }),
      })
    );

    await expect
      .poll(async () => (await readNode(page)).childrenBeforeContents)
      .toBe(true);
    expect((await readNode(page)).count).toBe(1);
  });

  test('drilling into a node in the modal shows its cover node', async ({
    page,
  }) => {
    test.fail(true, FAIL);
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000002');
    await openModal(page);
    await page.locator('custom-navigation-modal .back-button').click();

    await tile(page, 'Mock Story 1').click();

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000001');
    expect((await readNode(page)).count).toBe(1);
    await expect(modal(page)).toHaveAttribute('open');
  });

  test('choosing a tile without children shows that node and closes', async ({
    page,
  }) => {
    test.fail(true, FAIL);
    await open(page, '/000s00000000000011');
    await openModal(page);
    await tile(page, 'Mock Story 1').click();

    await tile(page, 'Mock Chapter 2 for Story 1').click();

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000002');
    expect((await readNode(page)).count).toBe(1);
    await expect(modal(page)).not.toHaveAttribute('open');
  });

  test('a root without children chosen in the modal shows its contents', async ({
    page,
  }) => {
    test.fail(true, FAIL);
    const tree = {
      result: [
        ...MOCK_CONTENTS.result,
        {
          id: 'r-leaf',
          label: 'Lonely Root',
          name: 'Lonely Root',
          childnodes: [],
        },
      ],
    };
    await open(page, '/', async (p) => {
      await p.route('**/api/1.0/contents/**', (route) =>
        route.fulfill({ json: tree })
      );
      await routeNodes({
        'r-leaf': child('r-leaf', 'Lonely Root', null, {
          contents: [MOCK_NODES.kind1.contents[0]],
        }),
      })(p);
    });
    await openModal(page);

    await tile(page, 'Lonely Root').click();

    await expect.poll(async () => (await readNode(page)).id).toBe('r-leaf');
    await expect.poll(async () => (await readNode(page)).contents).toBe(1);
  });

  test('a breadcrumb shows the ancestor itself, not its cover node', async ({
    page,
  }) => {
    test.fail(true, FAIL);
    await open(page, '/000c00000000000002');
    await expect(crumbs(page)).toHaveText(['Startseite', 'Mock Story 1']);

    await page
      .locator('app-bookstore slds-breadcrumbs a', { hasText: 'Mock Story 1' })
      .click();

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000011');
    await page.waitForTimeout(300);
    expect((await readNode(page)).id).toBe('000n00000000000011');
  });

  test('deleting the shown node shows its parent', async ({ page }) => {
    test.fail(true, FAIL);
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000002');

    // The node reports its own deletion, the way its delete action does.
    await page.evaluate(() => {
      const nodes = document
        .querySelector('app-bookstore')
        .shadowRoot.querySelectorAll('custom-node');
      nodes[nodes.length - 1].dispatchEvent(
        new CustomEvent('node-deleted', {
          detail: { nodeId: '000n00000000000002' },
          bubbles: true,
          composed: true,
        })
      );
    });

    await expect
      .poll(async () => (await readNode(page)).id)
      .toBe('000n00000000000011');
  });
});
