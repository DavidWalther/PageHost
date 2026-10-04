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

/** id of both nodes on the page. */
function readNodes(page) {
  return page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    const read = (role) =>
      app.shadowRoot
        .querySelector(`custom-node[data-role="${role}"]`)
        .getAttribute('id');
    return { navigation: read('navigation'), content: read('content') };
  });
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
      .poll(async () => (await readNodes(page)).content)
      .toBe('000n00000000000002');
    await markDocument(page);

    await homeLink(page).click();

    // Like GET /: the entry node above, its cover node below.
    await expect
      .poll(async () => (await readNodes(page)).content)
      .toBe('000n00000000000001');
    expect((await readNodes(page)).navigation).toBe('000n00000000000011');
    expect(await isSameDocument(page)).toBe(true);
  });

  test('leaves the current node in the history and shows the root address', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readNodes(page)).content)
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
      .poll(async () => (await readNodes(page)).content)
      .toBe('000n00000000000001');
    // Leave the cover for another child of the start node; the location stays
    // on the start node (UC-C-06 changes only the lower node).
    await page.evaluate(() =>
      document
        .querySelector('app-bookstore')
        .shadowRoot.querySelector('custom-node[data-role="content"]')
        .setAttribute('id', '000n00000000000002')
    );
    const lengthBefore = await page.evaluate(() => history.length);
    await markDocument(page);

    await homeLink(page).click();

    // The start page is applied again: the cover node is back below …
    await expect
      .poll(async () => (await readNodes(page)).content)
      .toBe('000n00000000000001');
    // … but nothing was added to the history, and nothing reloaded.
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore);
    expect(await page.evaluate(() => location.pathname)).toBe('/');
    expect(await isSameDocument(page)).toBe(true);
  });
});
