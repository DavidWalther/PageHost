const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_ROOT_PATH,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Marking a node to move it.
 *
 * The lower node offers the mark (`can-move`, with the `edit` scope); the page
 * keeps it. There is one mark at a time — a new one replaces the old — and it
 * lives only as long as the page: a reload drops it.
 */

const CHILD_1 = '000n00000000000001';
const CHILD_2 = '000n00000000000002';

/** The lower node and the state of its move button. */
function readLowerNode(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const node = root.querySelector('custom-node[data-role="content"]');
    const action = node.shadowRoot.querySelector('#node-move');
    return {
      id: node.getAttribute('id'),
      canMove: node.hasAttribute('can-move'),
      marked: action?.marked ?? null,
      buttonIcon:
        action?.shadowRoot?.querySelector('#button-move')?.icon ?? null,
    };
  });
}

const moveButton = (page) =>
  page.locator('custom-node[data-role="content"] #button-move');

/** Selects a child in the upper node, which opens it below. */
const selectChild = (page, id) =>
  page
    .locator(
      `custom-node[data-role="navigation"] #child-navigation button[data-node-id="${id}"]`
    )
    .click();

test.describe('Page: marking a node to move it', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await withSession(page, ['read', 'edit']);
    await page.goto(MOCK_ROOT_PATH);
    await expect.poll(async () => (await readLowerNode(page)).id).toBe(CHILD_1);
    await expect(moveButton(page)).toBeVisible();
  });

  test('the lower node offers the mark', async ({ page }) => {
    const lower = await readLowerNode(page);

    expect(lower.canMove).toBe(true);
    expect(lower.marked).toBe(false);
    expect(lower.buttonIcon).toBe('utility:cut');
  });

  test('a click marks the lower node', async ({ page }) => {
    await moveButton(page).click();

    await expect
      .poll(async () => (await readLowerNode(page)).marked)
      .toBe(true);
    expect((await readLowerNode(page)).buttonIcon).toBe('utility:clear');
  });

  test('a second click takes the mark away', async ({ page }) => {
    await moveButton(page).click();
    await expect
      .poll(async () => (await readLowerNode(page)).marked)
      .toBe(true);

    await moveButton(page).click();

    await expect
      .poll(async () => (await readLowerNode(page)).marked)
      .toBe(false);
  });

  test('another node is not marked by the mark of the first', async ({
    page,
  }) => {
    await moveButton(page).click();
    await expect
      .poll(async () => (await readLowerNode(page)).marked)
      .toBe(true);

    await selectChild(page, CHILD_2);

    await expect.poll(async () => (await readLowerNode(page)).id).toBe(CHILD_2);
    expect((await readLowerNode(page)).marked).toBe(false);
  });

  test('marking another node replaces the mark', async ({ page }) => {
    await moveButton(page).click();
    await expect
      .poll(async () => (await readLowerNode(page)).marked)
      .toBe(true);
    await selectChild(page, CHILD_2);
    await expect.poll(async () => (await readLowerNode(page)).id).toBe(CHILD_2);

    await moveButton(page).click();
    await expect
      .poll(async () => (await readLowerNode(page)).marked)
      .toBe(true);
    await selectChild(page, CHILD_1);

    await expect.poll(async () => (await readLowerNode(page)).id).toBe(CHILD_1);
    expect((await readLowerNode(page)).marked).toBe(false);
  });

  test('a reload drops the mark', async ({ page }) => {
    await moveButton(page).click();
    await expect
      .poll(async () => (await readLowerNode(page)).marked)
      .toBe(true);

    await page.reload();

    await expect.poll(async () => (await readLowerNode(page)).id).toBe(CHILD_1);
    await expect(moveButton(page)).toBeVisible();
    expect((await readLowerNode(page)).marked).toBe(false);
  });
});
