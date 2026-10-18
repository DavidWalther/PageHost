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
 *
 * The entry without an id, with an unknown id and on a feed is a matter of the
 * start page: `feed-start-page.spec.js`.
 */

/**
 * What the page shows after the entry: the node view above, the contents
 * below — both always on the same node.
 */
async function readEntry(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const view = root.querySelector('custom-node-view');
    const contents = root.querySelector('custom-node-contents');
    return {
      recordId: view.getAttribute('id'),
      contentsId: contents.getAttribute('id'),
      name:
        view.shadowRoot.querySelector('#node-name')?.textContent?.trim() ??
        null,
      contentIds: [
        ...(contents.shadowRoot?.querySelectorAll('custom-paragraph') ?? []),
      ].map((paragraph) => paragraph.id),
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
  test('a retired chapter id opens exactly that node', async ({ page }) => {
    await open(page, '/000c00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 2 for Story 1');

    // After resolving, the app goes on with the NEW id, above and below.
    const entry = await readEntry(page);
    expect(entry.recordId).toBe('000n00000000000002');
    expect(entry.contentsId).toBe('000n00000000000002');
  });

  test('a new node id leads to the same', async ({ page }) => {
    await open(page, '/000n00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 2 for Story 1');
    expect((await readEntry(page)).contentsId).toBe('000n00000000000002');
  });

  test('a retired story id opens the root itself', async ({ page }) => {
    await open(page, '/000s00000000000011');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Story 1');
    expect((await readEntry(page)).recordId).toBe('000n00000000000011');
  });

  test('a retired paragraph id opens the node it hangs on, at the paragraph', async ({
    page,
  }) => {
    // A `000p…` link once fell back to the start page without a word — the
    // prefix table knew the type, the entry did not.
    await open(page, '/000p00000000000001');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 1 for Story 1');
    await expect
      .poll(async () => (await readEntry(page)).contentIds)
      .toEqual(['00cn00000000000001']);
  });

  test('the navigation modal knows the location after a deep link with a retired id', async ({
    page,
  }) => {
    // The deep link uses the retired id, the content tree carries the record
    // id (like the backend). The app keeps its location in the record id, so
    // the modal opens on the child level with the location marked. This was
    // pinned as FEHLVERHALTEN while the app kept the legacy_id instead.
    await open(page, '/000c00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 2 for Story 1');

    await page.locator('#button-navigation_open').click();

    const current = page.locator('custom-navigation-modal button.tile_current');
    await expect(current).toHaveText('Mock Chapter 2 for Story 1');
  });

  test('fetches no node twice', async ({ page }) => {
    // Guard. `resolveEntryPoint` resolves the node and hands the record to
    // the node view, which hands it on to the contents. Without that both
    // would fetch again what has just arrived.
    const queries = recordQueries(page);
    await open(page, '/000n00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).contentsId)
      .toBe('000n00000000000002');
    await page.waitForTimeout(300);

    // The resolved node itself, and nothing else: there is no parent above
    // to fetch any more.
    expect(queries).toEqual(['/data/query/node?id=000n00000000000002']);
  });

  test('fetches nothing twice on the entry through a content', async ({
    page,
  }) => {
    const queries = recordQueries(page);
    await open(page, '/000p00000000000001');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Chapter 1 for Story 1');
    await page.waitForTimeout(300);

    // No entry comes twice.
    expect(new Set(queries).size).toBe(queries.length);
    expect(queries).toContain('/data/query/content?id=000p00000000000001');
    expect(queries).toContain('/data/query/node?id=000n00000000000001');
  });

  test('a child chosen in the node view becomes the node shown', async ({
    page,
  }) => {
    await open(page, '/000s00000000000011');

    await expect
      .poll(async () => (await readEntry(page)).name)
      .toBe('Mock Story 1');

    await page.locator('custom-node-view slds-combobox').evaluate((combobox) =>
      combobox.dispatchEvent(
        new CustomEvent('combobox-select', {
          detail: { value: '000n00000000000002' },
          bubbles: true,
          composed: true,
        })
      )
    );

    await expect
      .poll(async () => (await readEntry(page)).contentsId)
      .toBe('000n00000000000002');
  });
});
