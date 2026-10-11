const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_CONTENTS,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Deleting a node from the navigation modal.
 *
 * The modal lists the children of the current element. Every opened level —
 * not the top level — ends in a delete tile that acts on that current
 * element; only with the `delete` scope. Behind the tile is the delete action
 * `custom-node-delete`, with its prompts. After deleting, the tree reloads and
 * the modal stays open, one level higher.
 *
 * A leaf is reached with the modified click (Ctrl/Cmd + click, holding),
 * which opens it as its own, empty level — with the `delete` scope as with
 * the `create` scope.
 */

const [STORY_1, STORY_2] = MOCK_CONTENTS.result;
const CHAPTER_1 = STORY_1.childnodes[0];
const CHAPTER_2 = STORY_1.childnodes[1];

const WITHOUT_STORY_1 = { result: [STORY_2] };
const WITHOUT_CHAPTER_1 = {
  result: [{ ...STORY_1, childnodes: [CHAPTER_2] }, STORY_2],
};

let deleteUrls;

/**
 * Opens the modal on the top level. The tree is the mock tree until a delete
 * request went out, `after` from then on.
 */
async function open(page, { scopes = ['delete'], after = MOCK_CONTENTS } = {}) {
  deleteUrls = [];
  if (scopes) {
    await withSession(page, scopes);
  }
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) =>
    route.fulfill({ json: deleteUrls.length === 0 ? MOCK_CONTENTS : after })
  );
  await page.route('**/api/1.0/data/delete**', (route) => {
    deleteUrls.push(route.request().url());
    return route.fulfill({ json: { success: true } });
  });
  await cacheLitBundle(page);
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await page.locator('#button-navigation_open').click();
  await expect(tile(page, STORY_1.name)).toBeVisible();
}

/** Answers the prompts in order (true = OK) and records their messages. */
function answerPrompts(page, answers) {
  const messages = [];
  page.on('dialog', (dialog) => {
    messages.push(dialog.message());
    return answers[messages.length - 1] ? dialog.accept() : dialog.dismiss();
  });
  return messages;
}

const tiles = (page) => page.locator('custom-navigation-modal button.tile');
const tile = (page, text) =>
  tiles(page).filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const deleteTile = (page) =>
  page.locator('custom-navigation-modal button.tile_delete');
const modal = (page) =>
  page.locator('custom-navigation-modal slds-modal[heading="Navigation"]');
const back = (page) => page.locator('custom-navigation-modal .back-button');

test.describe('Navigation modal: delete', () => {
  test.use({ actionTimeout: 5000 });

  test('an opened level ends in a delete tile', async ({ page }) => {
    await open(page);

    await tile(page, STORY_1.name).click();

    await expect(tile(page, CHAPTER_1.name)).toBeVisible();
    await expect(deleteTile(page)).toBeVisible();
    await expect(tiles(page).last()).toHaveClass(/tile_delete/);
  });

  test('deleting a node with children asks twice and deletes it', async ({
    page,
  }) => {
    await open(page, { after: WITHOUT_STORY_1 });
    const messages = answerPrompts(page, [true, true]);
    await tile(page, STORY_1.name).click();

    await deleteTile(page).click();

    await expect.poll(() => deleteUrls.length).toBe(1);
    expect(deleteUrls[0]).toContain(`id=${STORY_1.id}`);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain('2');
    // Still open, one level higher: the top level, without the node.
    await expect(modal(page)).toHaveAttribute('open');
    await expect(tile(page, STORY_2.name)).toBeVisible();
    await expect(tile(page, STORY_1.name)).toHaveCount(0);
    await expect(back(page)).toHaveCount(0);
  });

  test('a leaf opened with Ctrl/Cmd + click can be deleted', async ({
    page,
  }) => {
    // The modified click needs the create scope so far.
    test.fail();

    await open(page, { after: WITHOUT_CHAPTER_1 });
    const messages = answerPrompts(page, [true]);
    await tile(page, STORY_1.name).click();
    await tile(page, CHAPTER_1.name).click({ modifiers: ['ControlOrMeta'] });
    // The leaf's own level: nothing but the delete tile (no create scope).
    await expect(tiles(page)).toHaveCount(1);

    await deleteTile(page).click();

    await expect.poll(() => deleteUrls.length).toBe(1);
    expect(deleteUrls[0]).toContain(`id=${CHAPTER_1.id}`);
    // One prompt; it names the one content of the leaf.
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('1');
    // One level higher: the level of the story, without the leaf.
    await expect(tile(page, CHAPTER_2.name)).toBeVisible();
    await expect(tile(page, CHAPTER_1.name)).toHaveCount(0);
    await expect(back(page)).toBeVisible();
  });

  test('declining sends nothing and the level stays', async ({ page }) => {
    await open(page);
    const messages = answerPrompts(page, [true, false]);
    await tile(page, STORY_1.name).click();

    await deleteTile(page).click();

    await expect.poll(() => messages.length).toBe(2);
    await page.waitForTimeout(300);
    expect(deleteUrls).toEqual([]);
    await expect(tile(page, CHAPTER_1.name)).toBeVisible();
  });
});

test.describe('Navigation modal: no delete tile', () => {
  test.use({ actionTimeout: 5000 });

  test('not on the top level', async ({ page }) => {
    await open(page);

    await expect(tile(page, STORY_2.name)).toBeVisible();
    await expect(deleteTile(page)).toHaveCount(0);
  });

  test('not without the delete scope', async ({ page }) => {
    await open(page, { scopes: ['create', 'edit'] });

    await tile(page, STORY_1.name).click();

    await expect(tile(page, CHAPTER_1.name)).toBeVisible();
    await expect(deleteTile(page)).toHaveCount(0);
  });
});
