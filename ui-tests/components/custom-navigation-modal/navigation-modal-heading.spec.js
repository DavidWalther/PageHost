const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * The heading names the current element.
 *
 * The tiles list the children of one node, and the last tiles of a level act
 * on that node (create below it, delete it, paste below it). The heading says
 * which node that is. The top level has no current element; its heading is
 * "Navigation".
 */

const node = (id, name, childnodes = []) => ({
  id,
  label: name,
  name,
  sortnumber: 1,
  childnodes,
});

const TREE = {
  result: [
    node('book', 'Book', [node('part', 'Part', [node('section', 'Section')])]),
    node('single', 'Single'),
  ],
};

async function open(page, { scopes = null } = {}) {
  if (scopes) {
    await withSession(page, scopes);
  }
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) =>
    route.fulfill({ json: TREE })
  );
  await cacheLitBundle(page);
  // The start page: no location, the modal opens on the top level.
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await page.locator('#button-navigation_open').click();
  await expect(tile(page, 'Book')).toBeVisible();
}

const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile').filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const heading = (page) =>
  page.locator('custom-navigation-modal #modal-navigation #modal-heading');
const back = (page) => page.locator('custom-navigation-modal .back-button');

test.describe('Navigation modal: the heading names the current element', () => {
  test.use({ actionTimeout: 5000 });

  test('the top level is headed "Navigation"', async ({ page }) => {
    await open(page);

    await expect(heading(page)).toHaveText('Navigation');
  });

  test('an opened level is headed by the name of its node', async ({
    page,
  }) => {
    await open(page);

    await tile(page, 'Book').click();

    await expect(tile(page, 'Part')).toBeVisible();
    await expect(heading(page)).toHaveText('Book');
  });

  test('two levels deep it is the name of the deeper node', async ({
    page,
  }) => {
    await open(page);
    await tile(page, 'Book').click();

    await tile(page, 'Part').click();

    await expect(tile(page, 'Section')).toBeVisible();
    await expect(heading(page)).toHaveText('Part');
  });

  test('going back heads the level above again, up to "Navigation"', async ({
    page,
  }) => {
    await open(page);
    await tile(page, 'Book').click();
    await tile(page, 'Part').click();
    await expect(tile(page, 'Section')).toBeVisible();

    await back(page).click();

    await expect(heading(page)).toHaveText('Book');
    await back(page).click();
    await expect(heading(page)).toHaveText('Navigation');
  });

  test('a leaf opened as a level is headed by its name', async ({ page }) => {
    await open(page, { scopes: ['create'] });

    await tile(page, 'Single').click({ modifiers: ['ControlOrMeta'] });

    await expect(tile(page, 'Single')).toHaveCount(0);
    await expect(heading(page)).toHaveText('Single');
  });
});
