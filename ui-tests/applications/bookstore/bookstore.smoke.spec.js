const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Smoke-Test der Bookstore-App.
 *
 * Prüft, dass die App ohne echtes Backend lädt und rendert: Die SSR-Shell wird
 * ausgeliefert, `<app-bookstore>` wird erzeugt, und die per `page.route()`
 * gemockten Datencallouts fließen bis in die gerenderte UI durch.
 *
 * Läuft anonym (frischer Context ohne Session) — Auth ist damit implizit
 * umgangen, der Identity Provider wird nie kontaktiert.
 */
test.describe('Bookstore smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
  });

  test('App lädt und rendert die Grundstruktur', async ({ page }) => {
    await page.goto('/');

    // SSR-Shell hat die Haupt-App-Komponente erzeugt.
    await expect(page.locator('app-bookstore')).toBeAttached();

    // Grundlayout ist sichtbar (Playwright durchdringt offene Shadow Roots).
    await expect(page.locator('#bookshelf')).toBeVisible();

    // The mocked node callout reached the UI: the one custom-node renders the
    // name of the start page — the cover node of the entry node.
    await expect(page.locator('#node-name').first()).toHaveText(
      'Mock Chapter 1 for Story 1'
    );
  });
});
