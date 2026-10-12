const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_CONTENTS,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Moving a node from the navigation modal.
 *
 * The host hands the modal the mark (`marked`: `{ id, name, parentId }`). The
 * modal says what is marked, with a way to drop the mark, and ends every level
 * in a paste tile that moves the marked node below the current element — on
 * the top level to the top level. Not on the level the node already hangs
 * on, and only with the `edit` scope. Behind the tile is the move action
 * `custom-node-move`.
 *
 * Here the mark is set on the modal directly; how the page keeps it has its
 * own spec.
 */

const [STORY_1, STORY_2] = MOCK_CONTENTS.result;
const [CHAPTER_1, CHAPTER_2] = STORY_1.childnodes;

const MARK = { id: CHAPTER_1.id, name: CHAPTER_1.name, parentId: STORY_1.id };

let sent;

/** Opens the modal on the top level, with the mark (or without one). */
async function open(page, { scopes = ['edit'], marked = MARK } = {}) {
  sent = [];
  if (scopes) {
    await withSession(page, scopes);
  }
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/data/change/**', (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, result: { id: MARK.id } } });
  });
  await cacheLitBundle(page);
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await page.evaluate(async (marked) => {
    window.__cleared = [];
    window.__moved = [];
    document.addEventListener('node-mark-clear', (event) =>
      window.__cleared.push(event.detail)
    );
    document.addEventListener('node-moved', (event) =>
      window.__moved.push(event.detail)
    );
    const modal = document
      .querySelector('app-bookstore')
      .shadowRoot.querySelector('custom-navigation-modal');
    modal.marked = marked;
    modal.hiddenIds = marked ? [marked.id] : [];
    await modal.updateComplete;
    modal.show();
  }, marked);
  await expect(tile(page, STORY_1.name)).toBeVisible();
}

const tiles = (page) => page.locator('custom-navigation-modal button.tile');
const tile = (page, text) =>
  tiles(page).filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const hint = (page) => page.locator('custom-navigation-modal #marked-hint');
const pasteTile = (page) =>
  page.locator('custom-navigation-modal button.tile_paste');

test.describe('Navigation modal: what is marked', () => {
  test.use({ actionTimeout: 5000 });

  test('names the marked node', async ({ page }) => {
    await open(page);

    await expect(hint(page)).toBeVisible();
    await expect(hint(page)).toContainText(`„${MARK.name}“ markiert`);
  });

  test('says nothing without a mark', async ({ page }) => {
    await open(page, { marked: null });

    await expect(hint(page)).toHaveCount(0);
  });

  test('its ✕ asks to drop the mark', async ({ page }) => {
    await open(page);

    await hint(page)
      .getByRole('button', { name: 'Markierung aufheben' })
      .click();

    expect(await page.evaluate(() => window.__cleared)).toEqual([
      { nodeId: MARK.id },
    ]);
  });
});
