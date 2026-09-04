const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * `service-worker-cache-clear` — der Listener der übergeordneten Ebene.
 *
 * Die Anwendung feuert nur ein Event; ausgeführt wird die Löschung in
 * `public/index.js`, wo auch der Service Worker registriert wird. Dieser Spec
 * prüft genau diesen Listener: Er feuert das Event selbst am `app-bookstore`
 * und braucht dafür keinen Button.
 *
 * Der Service Worker läuft hier **echt** (Playwright blockt ihn nicht), deshalb
 * wird vor dem Löschen `navigator.serviceWorker.ready` abgewartet — sonst
 * könnte ein noch laufendes `install` den Cache nach der Löschung neu füllen.
 */

const dispatchClear = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        document.querySelector('app-bookstore').dispatchEvent(
          new CustomEvent('service-worker-cache-clear', {
            detail: {
              callback: (error, data) =>
                resolve({ error: error ? String(error) : null, data }),
            },
            bubbles: true,
          })
        );
      })
  );

test.describe('service-worker-cache-clear', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
  });

  test('löscht alle Caches der Origin', async ({ page }) => {
    await page.evaluate(async () => {
      const cache = await caches.open('epc-probe');
      await cache.put('/probe', new Response('x'));
    });
    expect(await page.evaluate(() => caches.keys())).toContain('epc-probe');

    const { error } = await dispatchClear(page);

    expect(error).toBeNull();
    expect(await page.evaluate(() => caches.keys())).toEqual([]);
  });

  test('deregistriert den Service Worker', async ({ page }) => {
    expect(
      await page.evaluate(() =>
        navigator.serviceWorker.getRegistrations().then((r) => r.length)
      )
    ).toBeGreaterThan(0);

    await dispatchClear(page);

    expect(
      await page.evaluate(() =>
        navigator.serviceWorker.getRegistrations().then((r) => r.length)
      )
    ).toBe(0);
  });

  test('meldet den Erfolg über den Callback zurück, ohne die Seite neu zu laden', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__reloaded = false;
      window.addEventListener('beforeunload', () => {
        window.__reloaded = true;
      });
    });

    const { error } = await dispatchClear(page);

    expect(error).toBeNull();
    // Der Reload ist Sache der Anwendung (Entscheidung 4b), nicht des Listeners.
    expect(await page.evaluate(() => window.__reloaded)).toBe(false);
  });

  test('Klick in der Danger Zone löscht und lädt neu', async ({ page }) => {
    await page.evaluate(async () => {
      const cache = await caches.open('epc-probe');
      await cache.put('/probe', new Response('x'));
    });

    await page.locator('#button-settings_open').click();
    const dangerRow = page.locator('[slot="danger"]', {
      hasText: 'App-Cache löschen',
    });
    await expect(dangerRow).toBeVisible();

    const reloaded = page.waitForEvent('load');
    await dangerRow.getByRole('button', { name: 'Cache löschen' }).click();
    await reloaded;

    // Nach dem Neuladen darf der Precache wieder entstehen — der Probe-Cache
    // ist der Beleg, dass gelöscht wurde, und kommt nie zurück.
    expect(await page.evaluate(() => caches.keys())).not.toContain('epc-probe');
  });
});
