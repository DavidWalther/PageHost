const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * What the one node on the page offers and shows.
 *
 * The `bookstore` holds a single `custom-node`. The **data** say what a node
 * has (children, contents), the attributes the bookstore sets say what this
 * instance may do (`can-create-content`, `can-delete`). Creating a child is
 * not offered on the page: next to "create content" it would be a second,
 * identical "+"; it returns as the "+" tile in the navigation modal (#187).
 *
 * Every assertion runs through the bookstore — the attributes only exist
 * through its wiring.
 */

const SESSION_SCOPES = ['read', 'edit', 'create', 'delete'];

/** Attrappen-JWT mit ferner Ablaufzeit — clientseitig wird er nicht geprüft. */
function fakeJwt() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

async function withSession(page, scopes = SESSION_SCOPES) {
  await page.addInitScript(
    ([token, sessionScopes]) => {
      sessionStorage.setItem(
        'code_exchange_response',
        JSON.stringify({
          authenticationResult: {
            access: { access_token: token, scopes: sessionScopes },
          },
        })
      );
    },
    [fakeJwt(), scopes]
  );
}

const node = (page) => page.locator('app-bookstore custom-node');

/** Waits until the node has loaded — otherwise one measures the empty state. */
async function awaitNode(page, name = 'Mock Chapter 1 for Story 1') {
  await expect(node(page).locator('#node-name')).toHaveText(name);
}

const ENTRY = '/000c00000000000001';

test.describe('Node: actions', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await withSession(page);
    await page.goto(ENTRY);
    await awaitNode(page);
  });

  test('offers create content and delete, but not create child', async ({
    page,
  }) => {
    await expect(node(page).locator('#button-create-content')).toBeVisible();
    await expect(node(page).locator('#button-delete')).toBeVisible();
    await expect(node(page).locator('#node-create-child')).toHaveCount(0);
  });

  test('shows exactly one "+"', async ({ page }) => {
    // Two utility:add buttons side by side — one for a child, one for a
    // content — could not be told apart. That is why creating a child waits
    // for the navigation modal.
    await expect(
      node(page).locator('slds-button-icon[icon="utility:add"]')
    ).toHaveCount(1);
  });

  test('keeps edit and share', async ({ page }) => {
    await expect(node(page).locator('#node-edit')).toHaveCount(1);
    await expect(node(page).locator('#button-share')).toHaveCount(1);
  });
});

test.describe('Node: attribute and scope apply together', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto(ENTRY);
    await awaitNode(page);
  });

  test('without a session the actions are missing despite the attributes', async ({
    page,
  }) => {
    await expect(node(page).locator('#button-create-content')).toHaveCount(0);
    await expect(node(page).locator('#button-delete')).toHaveCount(0);
  });
});

test.describe('Node: rendering', () => {
  // Nodes that have children **and** contents, or a child that has children
  // of its own — allowed in the type-free model, absent from the shared mocks.
  const WURZEL_MIT_INHALT = {
    ...MOCK_NODES.wurzel,
    contents: [
      {
        id: '00cn00000000000090',
        name: 'Inhalt am Wurzelknoten',
        sortnumber: 1,
        published_date: '2022-01-01 00:00:00',
      },
    ],
  };

  const KIND_MIT_KIND = {
    ...MOCK_NODES.kind1,
    nodes: [
      {
        id: '000n00000000000090',
        name: 'Enkel-Knoten',
        description: null,
        sortnumber: 1,
        reversed: null,
        parent_node_id: MOCK_NODES.kind1.id,
        cover_node_id: null,
        published_date: '2022-01-01 00:00:00',
      },
    ],
  };

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const overrides = [WURZEL_MIT_INHALT, KIND_MIT_KIND];
      const match =
        overrides.find((n) => n.id === id || n.legacy_id === id) ??
        Object.values(MOCK_NODES).find(
          (n) => n.id === id || n.legacy_id === id
        );
      return route.fulfill({ json: match || {} });
    });
  });

  test('a node with children and contents shows both', async ({ page }) => {
    await page.goto('/000s00000000000011');
    await awaitNode(page, 'Mock Story 1');

    await expect(node(page).locator('#child-navigation')).toHaveCount(1);
    await expect(node(page).locator('custom-paragraph')).not.toHaveCount(0);
  });

  test('a child with children of its own shows them', async ({ page }) => {
    // Was hidden while the lower of two nodes carried no-child-navigation.
    await page.goto(ENTRY);
    await awaitNode(page);

    await expect(
      node(page).locator('#child-navigation', { hasText: 'Enkel-Knoten' })
    ).toHaveCount(1);
    await expect(node(page).locator('#no-contents')).toHaveCount(0);
  });
});

test.describe('Node: the jump to a content stays intact', () => {
  const INHALTE = [1, 2, 3, 4, 5].map((nummer) => ({
    id: `00cn0000000000009${nummer}`,
    name: `Absatz ${nummer}`,
    sortnumber: nummer,
    published_date: '2022-01-01 00:00:00',
  }));

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const base = Object.values(MOCK_NODES).find(
        (n) => n.id === id || n.legacy_id === id
      );
      if (!base) return route.fulfill({ json: {} });
      return route.fulfill({ json: { ...base, contents: INHALTE } });
    });
    await page.route('**/data/query/content**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const match = INHALTE.find((inhalt) => inhalt.id === id);
      if (!match) return route.fulfill({ json: {} });
      return route.fulfill({
        json: {
          ...match,
          node_id: MOCK_NODES.kind1.id,
          active_type: 'text',
          items: [{ id: `${match.id}-t`, type: 'text', content: match.name }],
        },
      });
    });
    await page.goto(`${ENTRY}?paragraphnumber=3`);
    await awaitNode(page);
  });

  test('the target paragraph shows and the progress runs to its end', async ({
    page,
  }) => {
    // Attribute selector, not #…: the id starts with a digit.
    const target = node(page).locator(
      'custom-paragraph[id="00cn00000000000093"]'
    );
    await expect(target).toBeVisible();
    await expect(target).not.toHaveAttribute('no-display', /.*/);
    await expect(node(page).locator('slds-progress-bar')).toHaveCount(0);
    await expect(node(page).locator('custom-paragraph')).toHaveCount(5);
  });
});
