const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Opening a tile as a level with a modified click.
 *
 * A plain click on a tile without children selects it and the modal closes, so
 * the level of a leaf could never be opened — and its first child never be
 * created or the leaf be deleted. With the `create` or the `delete` scope a
 * **modified click** opens any tile as a level and never selects: Ctrl + click
 * (Windows, Linux), Cmd + click (macOS), or holding the tile for half a second
 * (any pointer, touch included). A leaf then shows its empty level, where the
 * "+" tile creates its first child and the delete tile deletes it (each with
 * its scope); the page behind does not follow. On a tile with children the
 * gesture does what a plain click does.
 */

const TREE = {
  result: [
    {
      id: 'book',
      label: 'Book',
      name: 'Book',
      sortnumber: 1,
      childnodes: [
        {
          id: 'chapter-a',
          label: 'Chapter A',
          name: 'Chapter A',
          sortnumber: 1,
          childnodes: [],
        },
      ],
    },
    {
      id: 'single',
      label: 'Single',
      name: 'Single',
      sortnumber: 2,
      childnodes: [],
    },
  ],
};

const TREE_AFTER_CREATE = {
  result: [
    TREE.result[0],
    {
      ...TREE.result[1],
      childnodes: [
        {
          id: 'n-new',
          label: 'Neues Kapitel',
          name: 'Neues Kapitel',
          sortnumber: 1,
          childnodes: [],
        },
      ],
    },
  ],
};

let created;

async function open(page, { scopes = ['create', 'edit'] } = {}) {
  created = null;
  let contentsCalls = 0;
  if (scopes) {
    await withSession(page, scopes);
  }
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) => {
    contentsCalls += 1;
    route.fulfill({ json: contentsCalls === 1 ? TREE : TREE_AFTER_CREATE });
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
  // Records what the modal reports, to tell a selection from an opened level.
  await page.addInitScript(() => {
    window.__reported = [];
    for (const name of ['navigation-node-select', 'navigation-level-open']) {
      document.addEventListener(name, (event) =>
        window.__reported.push({ name, id: event.detail.id })
      );
    }
  });
  // The start page: no location, the modal opens on the top level.
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await page.locator('#button-navigation_open').click();
  await expect(tile(page, 'Book')).toBeVisible();
}

const reported = (page) => page.evaluate(() => window.__reported);
const tiles = (page) => page.locator('custom-navigation-modal button.tile');
const tile = (page, text) =>
  tiles(page).filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const plusTile = (page) =>
  page.locator('custom-navigation-modal button.tile_add');
const modal = (page) =>
  page.locator('custom-navigation-modal slds-modal[heading="Navigation"]');
const back = (page) => page.locator('custom-navigation-modal .back-button');
const hint = (page) =>
  page.locator('custom-navigation-modal').getByText('Keine Inhalte vorhanden.');
const confirm = (page) =>
  page.locator('custom-navigation-modal custom-chapter-edit button', {
    hasText: 'Erstellen',
  });

/** Holds the mouse on a tile for `ms`, then lets go. */
async function hold(page, locator, ms) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** The leaf's own level is open: back, the hint, and "+" as the only tile. */
async function expectLeafLevel(page) {
  await expect(modal(page)).toHaveAttribute('open');
  await expect(back(page)).toBeVisible();
  await expect(hint(page)).toBeVisible();
  await expect(tiles(page)).toHaveCount(1);
  await expect(tiles(page).first()).toHaveClass(/tile_add/);
}

test.describe('Navigation modal: open a level with a modified click', () => {
  test.use({ actionTimeout: 5000 });

  test('Ctrl/Cmd + click on a leaf opens its empty level and selects nothing', async ({
    page,
  }) => {
    await open(page);

    await tile(page, 'Single').click({ modifiers: ['ControlOrMeta'] });

    await expectLeafLevel(page);
    expect(await reported(page)).toEqual([]);
  });

  test('"+" on the leaf level creates the first child of the leaf', async ({
    page,
  }) => {
    await open(page);
    await tile(page, 'Single').click({ modifiers: ['ControlOrMeta'] });

    await plusTile(page).click();
    await confirm(page).click();

    await expect.poll(() => created).not.toBeNull();
    expect(created.payload.parent_node_id).toBe('single');
    expect(created.payload.sortnumber).toBe(1);
    await expect(tile(page, 'Neues Kapitel')).toBeVisible();
  });

  test('back leads from the leaf level to the level it was opened from', async ({
    page,
  }) => {
    await open(page);
    await tile(page, 'Single').click({ modifiers: ['ControlOrMeta'] });
    await expectLeafLevel(page);

    await back(page).click();

    await expect(tile(page, 'Single')).toBeVisible();
    await expect(tile(page, 'Book')).toBeVisible();
  });

  test('Ctrl/Cmd + click on a tile with children works like a plain click', async ({
    page,
  }) => {
    await open(page);

    await tile(page, 'Book').click({ modifiers: ['ControlOrMeta'] });

    await expect(tile(page, 'Chapter A')).toBeVisible();
    expect(await reported(page)).toEqual([
      { name: 'navigation-level-open', id: 'book' },
    ]);
  });

  test('holding a leaf for half a second opens its level, letting go selects nothing', async ({
    page,
  }) => {
    await open(page);

    await hold(page, tile(page, 'Single'), 700);

    await expectLeafLevel(page);
    expect(await reported(page)).toEqual([]);
  });

  test('a short press on a leaf still selects it', async ({ page }) => {
    await open(page);

    await hold(page, tile(page, 'Single'), 100);

    await expect(modal(page)).not.toHaveAttribute('open');
    expect(await reported(page)).toEqual([
      { name: 'navigation-node-select', id: 'single' },
    ]);
  });

  test('Ctrl/Cmd + Enter on a focused leaf opens its level', async ({
    page,
  }) => {
    await open(page);

    await tile(page, 'Single').focus();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expectLeafLevel(page);
    expect(await reported(page)).toEqual([]);
  });
});

test.describe('Navigation modal: modified click without the scope', () => {
  test.use({ actionTimeout: 5000 });

  test('Ctrl/Cmd + click on a leaf selects it like a plain click', async ({
    page,
  }) => {
    await open(page, { scopes: null });

    await tile(page, 'Single').click({ modifiers: ['ControlOrMeta'] });

    await expect(modal(page)).not.toHaveAttribute('open');
    expect(await reported(page)).toEqual([
      { name: 'navigation-node-select', id: 'single' },
    ]);
  });

  test('holding a leaf without the scope selects it', async ({ page }) => {
    await open(page, { scopes: null });

    await hold(page, tile(page, 'Single'), 700);

    await expect(modal(page)).not.toHaveAttribute('open');
    expect(await reported(page)).toEqual([
      { name: 'navigation-node-select', id: 'single' },
    ]);
  });
});

test.describe('Navigation modal: hold on a touch screen', () => {
  test.use({ actionTimeout: 5000, hasTouch: true });

  test('holding a leaf by touch opens its level', async ({ page }) => {
    await open(page);
    const box = await tile(page, 'Single').boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expectLeafLevel(page);
    expect(await reported(page)).toEqual([]);
  });
});

test.describe('Navigation modal: modified click with the delete scope only', () => {
  test.use({ actionTimeout: 5000 });

  /** The leaf's own level, offering only to delete it. */
  async function expectDeleteOnlyLevel(page) {
    await expect(modal(page)).toHaveAttribute('open');
    await expect(back(page)).toBeVisible();
    await expect(hint(page)).toBeVisible();
    await expect(tiles(page)).toHaveCount(1);
    await expect(tiles(page).first()).toHaveClass(/tile_delete/);
  }

  test('Ctrl/Cmd + click on a leaf opens its level to delete it', async ({
    page,
  }) => {
    await open(page, { scopes: ['delete'] });

    await tile(page, 'Single').click({ modifiers: ['ControlOrMeta'] });

    await expectDeleteOnlyLevel(page);
    expect(await reported(page)).toEqual([]);
  });

  test('holding a leaf opens its level to delete it', async ({ page }) => {
    await open(page, { scopes: ['delete'] });

    await hold(page, tile(page, 'Single'), 700);

    await expectDeleteOnlyLevel(page);
    expect(await reported(page)).toEqual([]);
  });
});
