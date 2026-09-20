const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  triggerDelete,
  CONTENT_ID,
} = require('../../support/paragraph-editor');

/**
 * Löschen eines Absatzes.
 *
 * Der Weg geht über `delete-paragraph.api.js` direkt an den Endpunkt (nicht über
 * ein Ereignis wie Lesen und Speichern) und trägt die neuen Objektnamen:
 * `object=content` mit der neuen Id. Vorgeschaltet ist eine Rückfrage — sie ist
 * Teil der Zusage, nicht Beiwerk.
 */

/** Fängt den Lösch-Callout ab und gibt die aufgerufene URL zurück. */
async function captureDelete(page) {
  const called = { url: null };
  await page.route('**/api/1.0/data/delete**', (route) => {
    called.url = route.request().url();
    return route.fulfill({ json: { success: true } });
  });
  return called;
}

test.describe('custom-paragraph: Löschen', () => {
  test.beforeEach(async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });
  });

  test('bestätigtes Löschen ruft den Endpunkt und nimmt den Absatz weg', async ({
    page,
  }) => {
    const absatz = paragraph(page);
    const called = await captureDelete(page);
    page.on('dialog', (dialog) => dialog.accept());

    await triggerDelete(absatz);

    await expect.poll(() => called.url).toContain('object=content');
    expect(called.url).toContain(`id=${CONTENT_ID}`);
    await expect(absatz).toHaveCount(0);
  });

  test('abgelehnte Rückfrage löscht nichts', async ({ page }) => {
    const absatz = paragraph(page);
    const called = await captureDelete(page);
    page.on('dialog', (dialog) => dialog.dismiss());

    await triggerDelete(absatz);

    expect(called.url).toBeNull();
    await expect(absatz).toHaveCount(1);
  });
});
