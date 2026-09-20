const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  triggerDelete,
} = require('../../support/paragraph-editor');

/**
 * Der Knoten räumt auf, wenn ein Inhalt gelöscht wird.
 *
 * Vorher nahm sich der Absatz nur selbst aus dem Dokument. Der umgebende
 * `div.content-container` blieb als leere Hülle stehen — samt seiner Abstände —
 * und die Inhaltsliste des Knotens kannte den Inhalt weiter. Beim eigenen
 * Löschen macht der Knoten es längst anders (`node-deleted`).
 *
 * Maßgeblich ist die **Liste**, nicht das DOM: Der Knoten nimmt den Inhalt aus
 * seinen Daten, und das Rendering folgt. Ein Container, den man von Hand aus dem
 * DOM schneidet, käme beim nächsten Rendern zurück.
 */

/** Der untere Knoten — der mit den Inhalten. */
function contentNode(page) {
  return page.locator('custom-node[data-role="content"]');
}

test.describe('custom-node: gelöschter Inhalt', () => {
  test('der leere Container verschwindet mit dem Absatz', async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });

    const knoten = contentNode(page);
    await expect(knoten.locator('.content-container')).toHaveCount(1);

    await page.route('**/api/1.0/data/delete**', (route) =>
      route.fulfill({ json: { success: true } })
    );
    page.on('dialog', (dialog) => dialog.accept());

    await triggerDelete(paragraph(page));

    await expect(knoten.locator('custom-paragraph')).toHaveCount(0);
    await expect(knoten.locator('.content-container')).toHaveCount(0);
  });

  test('ohne Inhalte sagt der Knoten es auch', async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });

    await page.route('**/api/1.0/data/delete**', (route) =>
      route.fulfill({ json: { success: true } })
    );
    page.on('dialog', (dialog) => dialog.accept());

    await triggerDelete(paragraph(page));

    // Der Mock-Knoten hat keine Kinder — bleibt kein Inhalt, ist der Hinweis
    // die einzig richtige Aussage.
    await expect(knotenHinweis(page)).toBeVisible();
  });
});

function knotenHinweis(page) {
  return contentNode(page).locator('#no-contents');
}
