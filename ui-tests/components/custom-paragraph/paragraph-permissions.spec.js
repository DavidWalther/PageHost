const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  editTrigger,
  deleteTrigger,
} = require('../../support/paragraph-editor');

/**
 * Welche Aktionen ein Absatz überhaupt anbietet.
 *
 * Geprüft wird das **Vorhandensein** der Schaltfläche, nicht ihre Sichtbarkeit:
 * Heute steht sie auf `display: none` und erscheint erst beim Überfahren, nach
 * dem Umbau ist sie ein permanentes Icon. Beides Mal gilt dieselbe Aussage —
 * ohne den passenden Scope wird sie gar nicht erst gerendert.
 *
 * Das **Veröffentlichen** kommt hier bewusst nicht vor: Es steckt heute im
 * Editor und zieht mit dem Umbau in eine eigene Komponente um. Sein
 * Scope-Verhalten wird dort festgeschrieben, statt hier eine Zusage über einen
 * Tab zu machen, den es danach nicht mehr gibt.
 */

test.describe('custom-paragraph: Aktionen nach Scopes', () => {
  test('ohne Sitzung gibt es weder Bearbeiten noch Löschen', async ({
    page,
  }) => {
    await openBookstore(page);

    const absatz = paragraph(page);
    await expect(absatz.locator('#content')).toBeVisible();
    await expect(editTrigger(absatz)).toHaveCount(0);
    await expect(deleteTrigger(absatz)).toHaveCount(0);
  });

  test('mit "edit" erscheint nur das Bearbeiten', async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit'] });

    const absatz = paragraph(page);
    await expect(editTrigger(absatz)).toHaveCount(1);
    await expect(deleteTrigger(absatz)).toHaveCount(0);
  });

  test('mit "delete" kommt das Löschen dazu', async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });

    const absatz = paragraph(page);
    await expect(editTrigger(absatz)).toHaveCount(1);
    await expect(deleteTrigger(absatz)).toHaveCount(1);
  });

  test('"delete" allein reicht nicht für das Bearbeiten', async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'delete'] });

    const absatz = paragraph(page);
    await expect(editTrigger(absatz)).toHaveCount(0);
    await expect(deleteTrigger(absatz)).toHaveCount(1);
  });
});
