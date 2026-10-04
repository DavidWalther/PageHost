const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Einstieg über einen Deep-Link — **ohne** Präfix-Typisierung.
 *
 * Früher entschied das Id-Präfix (`000s`/`000c`/`000p`), welcher Einstieg
 * gewählt wird. Das trug nur, solange es genau drei Typen gab, und eine nach
 * der Umstellung angelegte Id hätte gar kein Präfix mehr getragen. Jetzt fragt
 * die App das Backend, **was** hinter der Id steckt.
 *
 * Geprüft wird deshalb beides nebeneinander: alte Ids müssen weiter
 * funktionieren (das Backend löst sie über `legacy_id` auf), neue müssen
 * genauso funktionieren, ohne dass irgendwo ein Präfix gelesen wird.
 */

/** State of the one node after the entry. */
async function readEntry(page) {
  return page.evaluate(() => {
    const element = document
      .querySelector('app-bookstore')
      .shadowRoot.querySelector('custom-node');
    return {
      recordId: element.getAttribute('id'),
      contentNumber: element.getAttribute('contentnumber'),
      name:
        element.shadowRoot.querySelector('#node-name')?.textContent?.trim() ??
        null,
    };
  });
}

async function open(page, path) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await page.goto(path);
  await expect(page.locator('app-bookstore')).toBeAttached();
}

/** Zeichnet jede Datenabfrage auf. Muss vor `open` gerufen werden. */
function recordQueries(page) {
  const urls = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/data/query/')) {
      urls.push(`${url.pathname}?id=${url.searchParams.get('id')}`);
    }
  });
  return urls;
}

test.describe('Deep-Link ohne Präfix-Typisierung', () => {
  test('without a parameter the start page shows the cover of the entry node', async ({
    page,
  }) => {
    await open(page, '/');

    await expect
      .poll(async () => (await readEntry(page)).recordId)
      .toBe('000n00000000000001');
    expect((await readEntry(page)).name).toBe('Mock Chapter 1 for Story 1');
  });

  test('a retired chapter id shows exactly that node, in its record id', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 2 for Story 1');
    // After resolving, the app works with the NEW id.
    expect((await readEntry(page)).recordId).toBe('000n00000000000002');
  });

  test('a new node id leads to the same result', async ({ page }) => {
    await open(page, '/000n00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 2 for Story 1');
  });

  test('a retired story id shows the root itself, not its cover', async ({
    page,
  }) => {
    await open(page, '/000s00000000000011');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Story 1');
    expect((await readEntry(page)).recordId).toBe('000n00000000000011');
  });

  test('a retired paragraph id shows the node it hangs on and jumps to it', async ({
    page,
  }) => {
    await open(page, '/000p00000000000001');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 1 for Story 1');
    const { recordId, contentNumber } = await readEntry(page);
    expect(recordId).toBe('000n00000000000001');
    expect(contentNumber).toBe('1');
  });

  test('the navigation modal knows the location after a deep link with a retired id', async ({
    page,
  }) => {
    // The deep link uses the retired id, the content tree carries the record
    // id (like the backend). The app keeps its location in the record id, so
    // the modal opens on the child level with the location marked.
    await open(page, '/000c00000000000002');
    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 2 for Story 1');

    await page.locator('#button-navigation_open').click();

    const current = page.locator(
      'custom-navigation-modal button.tile_current .tile__name'
    );
    await expect(current).toHaveText('Mock Chapter 2 for Story 1');
  });

  test('an unknown id falls back to the start page', async ({ page }) => {
    await open(page, '/000x99999999999999');

    await expect
      .poll(async () => (await readEntry(page)).recordId)
      .toBe('000n00000000000001');
  });

  test('fetches no node twice', async ({ page }) => {
    // Regression guard: resolveEntryPoint hands the resolved record to the
    // node; without that the node would fetch again what has just arrived.
    // With one node the parent is not fetched at all any more.
    const queries = recordQueries(page);
    await open(page, '/000n00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 2 for Story 1');
    await page.waitForTimeout(300);

    expect(queries).toEqual(['/data/query/node?id=000n00000000000002']);
  });

  test('fetches nothing twice on an entry through a content', async ({
    page,
  }) => {
    const queries = recordQueries(page);
    await open(page, '/000p00000000000001');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 1 for Story 1');
    await page.waitForTimeout(300);

    expect(new Set(queries).size).toBe(queries.length);
    expect(queries).toContain('/data/query/content?id=000p00000000000001');
    expect(queries).toContain('/data/query/node?id=000n00000000000001');
  });

  test('choosing a child in the node shows that child', async ({ page }) => {
    await open(page, '/000s00000000000011');
    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Story 1');

    await page
      .locator(
        'app-bookstore custom-node button[data-node-id="000n00000000000002"]'
      )
      .click();

    await expect
      .poll(async () => (await readEntry(page)).recordId)
      .toBe('000n00000000000002');
  });
});
