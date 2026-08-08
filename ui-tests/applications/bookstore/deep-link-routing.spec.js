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

/** Zustand beider Knoten nach dem Einstieg. */
async function readEntry(page) {
  return page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    const read = (role) => {
      const element = app.shadowRoot.querySelector(
        `custom-node[data-role="${role}"]`
      );
      return {
        recordId: element.getAttribute('id'),
        selectedChild: element.getAttribute('selected-child'),
        contentNumber: element.getAttribute('contentnumber'),
        name:
          element.shadowRoot.querySelector('#node-name')?.textContent?.trim() ??
          null,
      };
    };
    return { navigation: read('navigation'), content: read('content') };
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
  test('ohne Parameter startet der voreingestellte Knoten', async ({
    page,
  }) => {
    await open(page, '/');

    await expect
      .poll(async () => (await readEntry(page)).navigation.name)
      .toBe('Mock Story 1');

    const { navigation, content } = await readEntry(page);
    expect(navigation.recordId).toBe('000s00000000000011');
    // Der Titel-Knoten (cover_node_id) füllt den Inhalt.
    expect(content.recordId).toBe('000n00000000000001');
  });

  test('alte Kapitel-Id öffnet den Knoten samt seiner Auswahl', async ({
    page,
  }) => {
    await open(page, '/000c00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).content.name)
      .toBe('Mock Chapter 2 for Story 1');

    const { navigation, content } = await readEntry(page);
    // Der Elternknoten kommt aus der Antwort, nicht aus dem Präfix.
    expect(navigation.recordId).toBe('000n00000000000011');
    expect(navigation.selectedChild).toBe('000n00000000000002');
    // Nach der Aufloesung arbeitet die App mit der NEUEN Id weiter.
    expect(content.recordId).toBe('000n00000000000002');
  });

  test('neue Knoten-Id führt zum selben Ergebnis', async ({ page }) => {
    await open(page, '/000n00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).content.name)
      .toBe('Mock Chapter 2 for Story 1');

    const { navigation } = await readEntry(page);
    expect(navigation.selectedChild).toBe('000n00000000000002');
  });

  test('alte Story-Id öffnet den Wurzelknoten als Auswahl', async ({
    page,
  }) => {
    await open(page, '/000s00000000000011');

    await expect
      .poll(async () => (await readEntry(page)).navigation.name)
      .toBe('Mock Story 1');

    const { navigation } = await readEntry(page);
    expect(navigation.recordId).toBe('000n00000000000011');
  });

  test('alte Absatz-Id öffnet den Knoten, an dem der Absatz hängt', async ({
    page,
  }) => {
    // Neu: früher fiel ein `000p…`-Link stillschweigend auf die Startseite
    // zurück — die Präfix-Tabelle kannte den Typ, der Einstieg aber nicht.
    await open(page, '/000p00000000000001');

    await expect
      .poll(async () => (await readEntry(page)).content.name)
      .toBe('Mock Chapter 1 for Story 1');

    const { navigation, content } = await readEntry(page);
    expect(navigation.recordId).toBe('000n00000000000011');
    // Und es wird zu genau diesem Absatz gesprungen.
    expect(content.contentNumber).toBe('1');
  });

  test('das Navigations-Modal kennt die Stelle nach einem Deep-Link', async ({
    page,
  }) => {
    // Der Inhaltsbaum spricht weiter die ALTEN Ids. Würde die App ihre Stelle
    // in der neuen Id merken, träfe sie dort nie — das Modal öffnete auf der
    // obersten Ebene und markierte nichts.
    await open(page, '/000c00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).content.name)
      .toBe('Mock Chapter 2 for Story 1');

    await page.locator('#button-navigation_open').click();

    // Es öffnet direkt auf der Kind-Ebene der Story, mit markierter Stelle.
    const current = page.locator('custom-navigation-modal button.tile_current');
    await expect(current).toHaveText('Mock Chapter 2 for Story 1');
  });

  test('eine unbekannte Id fällt auf den Einstieg zurück', async ({ page }) => {
    await open(page, '/000x99999999999999');

    await expect
      .poll(async () => (await readEntry(page)).navigation.name)
      .toBe('Mock Story 1');
  });

  test('holt keinen Knoten zweimal', async ({ page }) => {
    // Regressionswächter. `resolveEntryPoint` löst den Knoten auf und gibt
    // den Datensatz an `custom-node` weiter; ohne diese Übergabe holte der
    // Knoten genau das noch einmal, was gerade angekommen war.
    const queries = recordQueries(page);
    await open(page, '/000n00000000000002');

    await expect
      .poll(async () => (await readEntry(page)).content.name)
      .toBe('Mock Chapter 2 for Story 1');
    await page.waitForTimeout(300);

    expect(queries).toEqual([
      // der aufgelöste Knoten selbst …
      '/data/query/node?id=000n00000000000002',
      // … und sein Elternknoten, den nur die Id benennt
      '/data/query/node?id=000n00000000000011',
    ]);
  });

  test('holt beim Einstieg über einen Inhalt nichts doppelt', async ({
    page,
  }) => {
    const queries = recordQueries(page);
    await open(page, '/000p00000000000001');

    await expect
      .poll(async () => (await readEntry(page)).content.name)
      .toBe('Mock Chapter 1 for Story 1');
    await page.waitForTimeout(300);

    // Kein Eintrag kommt zweimal vor.
    expect(new Set(queries).size).toBe(queries.length);
    expect(queries).toContain('/data/query/content?id=000p00000000000001');
    expect(queries).toContain('/data/query/node?id=000n00000000000001');
  });

  test('Navigation im Knoten schaltet den Inhalt um', async ({ page }) => {
    await open(page, '/000s00000000000011');

    await expect
      .poll(async () => (await readEntry(page)).navigation.name)
      .toBe('Mock Story 1');

    await page.evaluate(() => {
      const app = document.querySelector('app-bookstore');
      app.shadowRoot
        .querySelector('custom-node[data-role="navigation"]')
        .shadowRoot.querySelector('button[data-node-id="000n00000000000002"]')
        .click();
    });

    await expect
      .poll(async () => (await readEntry(page)).content.recordId)
      .toBe('000n00000000000002');
  });
});
