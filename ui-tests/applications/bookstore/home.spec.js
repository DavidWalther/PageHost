const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Home — the first item of the breadcrumb row.
 *
 * A click loads the start node **inside the app**, without reloading the
 * document: the same page as `GET /` (entry node above, its cover node below).
 * Before that, the node the visitor leaves becomes the last history entry and
 * the address turns into the root address. Already on the start node, home
 * adds no history entry.
 */

/** id of the one node on the page. */
function readNodes(page) {
  return page.evaluate(() => ({
    node: document
      .querySelector('app-bookstore')
      .shadowRoot.querySelector('custom-node')
      .getAttribute('id'),
  }));
}

const homeLink = (page) =>
  page.locator('app-bookstore slds-breadcrumbs li').first().locator('a');

async function open(page, path) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await page.goto(path);
  await expect(page.locator('app-bookstore')).toBeAttached();
}

/** Marks the current document; a reload would lose the mark. */
const markDocument = (page) =>
  page.evaluate(() => {
    window.__sameDocument = true;
  });
const isSameDocument = (page) =>
  page.evaluate(() => window.__sameDocument === true);

test.describe('Home', () => {
  test.use({ actionTimeout: 5000 });

  test('loads the start page inside the app, without a reload', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000002');
    await markDocument(page);

    await homeLink(page).click();

    // Like GET /: the cover node of the entry node.
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000001');
    expect(await isSameDocument(page)).toBe(true);
  });

  test('leaves the current node in the history and shows the root address', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000002');
    const lengthBefore = await page.evaluate(() => history.length);

    await homeLink(page).click();

    await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/');
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore + 1);
    // The entry before is the node that was left — in its record id.
    await page.evaluate(() => history.back());
    await expect
      .poll(() => page.evaluate(() => location.pathname))
      .toBe('/000n00000000000002');
  });

  test('adds no history entry when already on the start node', async ({
    page,
  }) => {
    await open(page, '/');
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000001');
    const lengthBefore = await page.evaluate(() => history.length);
    await markDocument(page);

    await homeLink(page).click();

    // The start page stays: its cover node …
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000001');
    // … but nothing was added to the history, and nothing reloaded.
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore);
    expect(await page.evaluate(() => location.pathname)).toBe('/');
    expect(await isSameDocument(page)).toBe(true);
  });
});

test.describe('Browser back and forward after home', () => {
  test.use({ actionTimeout: 5000 });

  const contentNumber = (page) =>
    page.evaluate(() =>
      document
        .querySelector('app-bookstore')
        .shadowRoot.querySelector('custom-node')
        .getAttribute('contentnumber')
    );

  test('back shows the left node inside the app', async ({ page }) => {
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000002');
    await homeLink(page).click();
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000001');
    await markDocument(page);

    await page.evaluate(() => history.back());

    // Exactly the node that was left — not a cover node, which a doubled
    // "loaded" handler would put there over the explicit choice.
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000002');
    await page.waitForTimeout(300);
    expect(await readNodes(page)).toEqual({ node: '000n00000000000002' });
    expect(await isSameDocument(page)).toBe(true);
    await expect(page.locator('app-bookstore slds-breadcrumbs li')).toHaveText([
      'Startseite',
      'Mock Story 1',
    ]);
  });

  test('forward shows the start page again', async ({ page }) => {
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000002');
    await homeLink(page).click();
    // Home writes the history once it has resolved the start node.
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/');
    await page.evaluate(() => history.back());
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000002');

    await page.evaluate(() => history.forward());

    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000001');
    expect(await page.evaluate(() => location.pathname)).toBe('/');
  });

  test('back does not jump to the paragraph number of the first address', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002?paragraphnumber=3');
    await expect.poll(() => contentNumber(page)).toBe('3');
    await homeLink(page).click();
    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000001');

    await page.evaluate(() => history.back());

    await expect
      .poll(async () => (await readNodes(page)).node)
      .toBe('000n00000000000002');
    expect(await contentNumber(page)).toBeNull();
  });
});
