const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Marking a node to move it.
 *
 * The node view offers the mark (with the `edit` scope); the page keeps it. There is one mark at a time — a new one replaces the old — and it
 * lives only as long as the page: a reload drops it.
 */

const CHILD_1 = '000n00000000000001';
const CHILD_2 = '000n00000000000002';

/** The node view and the state of its move button. */
function readNodeView(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const node = root.querySelector('custom-node-view');
    const action = node.shadowRoot.querySelector('#node-move');
    return {
      id: node.getAttribute('id'),
      marked: action?.marked ?? null,
      buttonIcon:
        action?.shadowRoot?.querySelector('#button-move')?.icon ?? null,
    };
  });
}

const moveButton = (page) => page.locator('custom-node-view #button-move');

/**
 * Goes to the other child with the arrow of the node view: CHILD_2 is the
 * next sibling of CHILD_1, CHILD_1 the previous one of CHILD_2. A locator,
 * so the click waits until the tree has brought the arrows.
 */
const goToSibling = (page, id) =>
  page
    .locator(
      id === CHILD_2
        ? 'custom-node-view #button-next'
        : 'custom-node-view #button-previous'
    )
    .click();

test.describe('Page: marking a node to move it', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await withSession(page, ['read', 'edit']);
    await page.goto(`/${CHILD_1}`);
    await expect.poll(async () => (await readNodeView(page)).id).toBe(CHILD_1);
    await expect(moveButton(page)).toBeVisible();
  });

  test('the node view offers the mark', async ({ page }) => {
    const view = await readNodeView(page);

    expect(view.marked).toBe(false);
    expect(view.buttonIcon).toBe('utility:cut');
  });

  test('a click marks the node shown', async ({ page }) => {
    await moveButton(page).click();

    await expect.poll(async () => (await readNodeView(page)).marked).toBe(true);
    expect((await readNodeView(page)).buttonIcon).toBe('utility:clear');
  });

  test('a second click takes the mark away', async ({ page }) => {
    await moveButton(page).click();
    await expect.poll(async () => (await readNodeView(page)).marked).toBe(true);

    await moveButton(page).click();

    await expect
      .poll(async () => (await readNodeView(page)).marked)
      .toBe(false);
  });

  test('another node is not marked by the mark of the first', async ({
    page,
  }) => {
    await moveButton(page).click();
    await expect.poll(async () => (await readNodeView(page)).marked).toBe(true);

    await goToSibling(page, CHILD_2);

    await expect.poll(async () => (await readNodeView(page)).id).toBe(CHILD_2);
    expect((await readNodeView(page)).marked).toBe(false);
  });

  test('marking another node replaces the mark', async ({ page }) => {
    await moveButton(page).click();
    await expect.poll(async () => (await readNodeView(page)).marked).toBe(true);
    await goToSibling(page, CHILD_2);
    await expect.poll(async () => (await readNodeView(page)).id).toBe(CHILD_2);

    await moveButton(page).click();
    await expect.poll(async () => (await readNodeView(page)).marked).toBe(true);
    await goToSibling(page, CHILD_1);

    await expect.poll(async () => (await readNodeView(page)).id).toBe(CHILD_1);
    expect((await readNodeView(page)).marked).toBe(false);
  });

  test('a reload drops the mark', async ({ page }) => {
    await moveButton(page).click();
    await expect.poll(async () => (await readNodeView(page)).marked).toBe(true);

    await page.reload();

    await expect.poll(async () => (await readNodeView(page)).id).toBe(CHILD_1);
    await expect(moveButton(page)).toBeVisible();
    expect((await readNodeView(page)).marked).toBe(false);
  });
});
