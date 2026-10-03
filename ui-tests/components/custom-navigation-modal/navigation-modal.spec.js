const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * UI-Tests für das Navigations-Modal (`custom-navigation-modal`).
 *
 * Das Modal lädt beim App-Start den Inhaltsbaum (`contents`-Callout, gemockt)
 * und zeigt beim Öffnen alle Stories als Kacheln. Ein Klick auf eine Story
 * blendet deren Kapitel ein; „< zurück" führt zur Story-Ebene zurück. Ein
 * Kapitel-Klick feuert das `chapter-select`-Event mit story- und chapter-id.
 *
 * Läuft anonym (kein Auth nötig) — alle Datencallouts sind per `page.route()`
 * gemockt, es ist kein echtes Postgres/Redis im Spiel.
 */
test.describe('Navigation modal', () => {
  const tiles = (page) => page.locator('custom-navigation-modal button.tile');
  const tileByText = (page, text) =>
    page.locator('custom-navigation-modal button.tile', { hasText: text });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();
  });

  async function openModal(page) {
    // Öffnen-Button liegt in der Kopfzeile der Bookstore-App.
    await page.locator('#button-navigation_open').click();
  }

  test('öffnet und listet alle Stories', async ({ page }) => {
    await openModal(page);

    // slds-modal rendert seinen Inhalt erst im offenen Zustand — vorher gibt es
    // keine sichtbaren Kacheln. Die Assertion wartet, bis der (gemockte) Baum da ist.
    await expect(tiles(page).first()).toBeVisible();
    await expect(tiles(page)).toHaveCount(2);
    await expect(tileByText(page, 'Mock Story 1')).toBeVisible();
    await expect(tileByText(page, 'Mock Story 2')).toBeVisible();
  });

  test('Drilldown in die Kapitel und zurück zur Story-Ebene', async ({
    page,
  }) => {
    await openModal(page);
    await tileByText(page, 'Mock Story 1').click();

    // Kapitel-Ebene von Story 1: beide Kapitel sichtbar, Story 2 nicht mehr.
    await expect(tileByText(page, 'Mock Chapter 1 for Story 1')).toBeVisible();
    await expect(tileByText(page, 'Mock Chapter 2 for Story 1')).toBeVisible();
    await expect(tiles(page)).toHaveCount(2);
    await expect(tileByText(page, 'Mock Story 2')).toHaveCount(0);

    // „< zurück" führt wieder auf die Story-Ebene mit beiden Stories.
    await page.locator('custom-navigation-modal .back-button').click();
    await expect(tileByText(page, 'Mock Story 1')).toBeVisible();
    await expect(tileByText(page, 'Mock Story 2')).toBeVisible();
  });

  test('Kapitel-Klick feuert chapter-select mit story- und chapter-id', async ({
    page,
  }) => {
    await openModal(page);
    await tileByText(page, 'Mock Story 1').click();

    // Listener registrieren, bevor geklickt wird; das Event ist composed und
    // bubbelt aus dem Shadow-DOM bis zum document.
    await page.evaluate(() => {
      window.__chapterSelect = null;
      document.addEventListener(
        'chapter-select',
        (event) => {
          window.__chapterSelect = event.detail;
        },
        { once: true }
      );
    });

    await tileByText(page, 'Mock Chapter 2 for Story 1').click();

    await expect
      .poll(() => page.evaluate(() => window.__chapterSelect))
      .toEqual({
        storyId: '000n00000000000011',
        chapterId: '000n00000000000002',
      });
  });

  test('opens on the top level and marks the entry node', async ({ page }) => {
    await openModal(page);

    await expect(tileByText(page, 'Mock Story 1')).toHaveClass(/tile_current/);
    await expect(tileByText(page, 'Mock Story 2')).not.toHaveClass(
      /tile_current/
    );
  });

  test('reopens on the level of a chosen child and marks the path', async ({
    page,
  }) => {
    await openModal(page);
    await tileByText(page, 'Mock Story 1').click();
    await tileByText(page, 'Mock Chapter 2 for Story 1').click();
    await expect(tiles(page).first()).toBeHidden();

    await openModal(page);

    // Opens straight on the child level, the chosen child is marked …
    await expect(tileByText(page, 'Mock Chapter 2 for Story 1')).toHaveClass(
      /tile_current/
    );
    await expect(
      tileByText(page, 'Mock Chapter 1 for Story 1')
    ).not.toHaveClass(/tile_current/);

    // … and one level up its parent is marked as well.
    await page.locator('custom-navigation-modal .back-button').click();
    await expect(tileByText(page, 'Mock Story 1')).toHaveClass(/tile_current/);
  });

  test('closing with Escape changes nothing behind the modal', async ({
    page,
  }) => {
    const readNodes = () =>
      page.evaluate(() => {
        const app = document.querySelector('app-bookstore');
        return ['navigation', 'content'].map((role) => {
          const node = app.shadowRoot.querySelector(
            `custom-node[data-role="${role}"]`
          );
          return [node.getAttribute('id'), node.getAttribute('selected-child')];
        });
      });
    await openModal(page);
    await expect(tiles(page).first()).toBeVisible();
    const before = await readNodes();

    await page.keyboard.press('Escape');

    await expect(tiles(page).first()).toBeHidden();
    expect(await readNodes()).toEqual(before);
  });
});
