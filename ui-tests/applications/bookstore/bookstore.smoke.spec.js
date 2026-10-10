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

    // The start page is visible (Playwright pierces open shadow roots): the
    // feeds, not the two nodes.
    await expect(page.locator('#feeds')).toBeVisible();
    await expect(page.locator('#bookshelf')).toBeHidden();

    // The mocked callouts flow through to the UI: the feed root delivers the
    // feeds as tabs, and the open feed shows its first content.
    await expect(page.locator('custom-feed a[role="tab"]').first()).toHaveText(
      'Mock News'
    );
    await expect(
      page.locator('custom-feed custom-paragraph').first()
    ).toContainText('Text of Mock News entry 1');
  });
});
