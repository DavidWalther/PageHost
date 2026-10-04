const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_CONTENTS,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Creating nodes from the navigation modal.
 *
 * With the `create` scope every level ends in a "+" tile (a new sibling on that
 * level; on the top level a new root), and every tile **without** children
 * carries a small "+" of its own (its first child — its level can never be
 * opened, a tile without children selects). Both open the create dialog of
 * `custom-chapter-edit` over the open modal; after creating, the tree reloads
 * and the modal stays on its level.
 */

/** Dummy JWT with a far expiry — the client does not verify it. */
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

async function withSession(page, scopes) {
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

const TREE_AFTER_CREATE = {
  result: [
    MOCK_CONTENTS.result[0],
    MOCK_CONTENTS.result[1],
    {
      id: 'n-new',
      label: 'Neues Kapitel',
      name: 'Neues Kapitel',
      sortnumber: 3,
      childnodes: [],
    },
  ],
};

let created;
let contentsCalls;

async function open(page, { scopes = ['create', 'edit'] } = {}) {
  created = null;
  contentsCalls = 0;
  if (scopes) {
    await withSession(page, scopes);
  }
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) => {
    contentsCalls += 1;
    route.fulfill({
      json: contentsCalls === 1 ? MOCK_CONTENTS : TREE_AFTER_CREATE,
    });
  });
  await page.route('**/api/1.0/data/change/**', (route) => {
    created = route.request().postDataJSON();
    route.fulfill({
      json: {
        success: true,
        result: { id: 'n-new', name: 'Neues Kapitel', ...created.payload },
      },
    });
  });
  await cacheLitBundle(page);
  // A root deep link: the modal opens on the top level.
  await page.goto('/000s00000000000011');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await page.locator('#button-navigation_open').click();
}

const tiles = (page) => page.locator('custom-navigation-modal button.tile');
const tile = (page, text) =>
  tiles(page).filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const plusTile = (page) =>
  page.locator('custom-navigation-modal button.tile_add');
const firstChildButton = (page, text) =>
  page
    .locator('custom-navigation-modal .tile-wrap')
    .filter({
      has: page.locator('button.tile .tile__name', {
        hasText: new RegExp(`^\\s*${text}\\s*$`),
      }),
    })
    .locator('button.tile__add');
const dialog = (page) =>
  page.locator('custom-navigation-modal custom-chapter-edit slds-modal');
const confirm = (page) =>
  page.locator('custom-navigation-modal custom-chapter-edit button', {
    hasText: 'Erstellen',
  });

test.describe('Navigation modal: create', () => {
  test.use({ actionTimeout: 5000 });

  test('without the create scope there is no "+" at all', async ({ page }) => {
    await open(page, { scopes: null });
    await expect(tile(page, 'Mock Story 1')).toBeVisible();

    await expect(plusTile(page)).toHaveCount(0);
    await expect(
      page.locator('custom-navigation-modal button.tile__add')
    ).toHaveCount(0);
  });

  test('every level ends in a "+" tile, also the top level', async ({
    page,
  }) => {
    await open(page);

    await expect(tiles(page).last()).toHaveClass(/tile_add/);
    await tile(page, 'Mock Story 1').click();
    await expect(tile(page, 'Mock Chapter 1 for Story 1')).toBeVisible();
    await expect(tiles(page).last()).toHaveClass(/tile_add/);
  });

  test('only tiles without children carry a small "+"', async ({ page }) => {
    await open(page);
    await tile(page, 'Mock Story 1').click();

    await expect(
      firstChildButton(page, 'Mock Chapter 2 for Story 1')
    ).toHaveCount(1);
    await page.locator('custom-navigation-modal .back-button').click();
    await expect(firstChildButton(page, 'Mock Story 1')).toHaveCount(0);
  });

  test('the "+" tile on the top level creates a root', async ({ page }) => {
    await open(page);

    await plusTile(page).click();
    await expect(dialog(page)).toHaveAttribute('open');
    await confirm(page).click();

    await expect.poll(() => created).not.toBeNull();
    expect(created.object).toBe('node');
    expect(created.payload.parent_node_id).toBeFalsy();
    // Roots carry 1 and 2.
    expect(created.payload.sortnumber).toBe(3);
  });

  test('the "+" tile on a level creates a child of that level', async ({
    page,
  }) => {
    await open(page);
    await tile(page, 'Mock Story 1').click();

    await plusTile(page).click();
    await confirm(page).click();

    await expect.poll(() => created).not.toBeNull();
    expect(created.payload.parent_node_id).toBe('000n00000000000011');
    // Its children carry 1 and 2.
    expect(created.payload.sortnumber).toBe(3);
  });

  test('the small "+" creates a first child of that tile', async ({ page }) => {
    await open(page);
    await tile(page, 'Mock Story 1').click();

    await firstChildButton(page, 'Mock Chapter 2 for Story 1').click();
    await confirm(page).click();

    await expect.poll(() => created).not.toBeNull();
    expect(created.payload.parent_node_id).toBe('000n00000000000002');
    expect(created.payload.sortnumber).toBe(1);
  });

  test('after creating the modal stays on its level and shows the new tile', async ({
    page,
  }) => {
    await open(page);

    await plusTile(page).click();
    await confirm(page).click();

    await expect(tile(page, 'Neues Kapitel')).toBeVisible();
    await expect(tile(page, 'Mock Story 1')).toBeVisible();
    expect(contentsCalls).toBe(2);
  });

  test('Escape in the dialog closes only the dialog', async ({ page }) => {
    await open(page);
    await plusTile(page).click();
    await expect(dialog(page)).toHaveAttribute('open');

    await page.keyboard.press('Escape');

    await expect(dialog(page)).not.toHaveAttribute('open');
    await expect(tile(page, 'Mock Story 1')).toBeVisible();
  });
});
