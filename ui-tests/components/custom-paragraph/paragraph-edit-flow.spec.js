const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  respondWithContent,
  textContentRecord,
  openEditor,
  editor,
} = require('../../support/paragraph-editor');

/**
 * Bearbeiten und Speichern eines Absatzes.
 *
 * Festgehalten wird, **was hinausgeht** und **was danach angezeigt wird** — nicht,
 * wie der Editor aussieht. Der Payload geht über die neuen Objektnamen
 * (`object: 'content'`) und die neue Id; die Feldnamen sind die des Datenmodells
 * (`sortnumber`), nicht die des früheren Formulars.
 */

/** Fängt den Speichern-Callout ab und gibt den gesendeten Rumpf zurück. */
async function captureSave(page, result = { success: true }) {
  const sent = { payload: null };
  await page.route('**/api/1.0/data/change/**', (route) => {
    sent.payload = JSON.parse(route.request().postData());
    return route.fulfill({ json: result });
  });
  return sent;
}

test.describe('custom-paragraph: Bearbeiten', () => {
  test.beforeEach(async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit'] });
    await respondWithContent(page, textContentRecord());
    await page.reload();
  });

  test('Speichern schickt object "content" mit den geänderten Feldern', async ({
    page,
  }) => {
    const absatz = paragraph(page);
    const sent = await captureSave(page, {
      success: true,
      result: { id: '00cn00000000000001' },
    });

    await openEditor(absatz);
    const felder = editor(absatz);
    await felder.name.fill('Neuer Name');
    await felder.text.fill('Neuer Inhalt');
    await felder.save.click();

    await expect.poll(() => sent.payload?.object).toBe('content');
    expect(sent.payload.payload.id).toBe('00cn00000000000001');
    expect(sent.payload.payload.name).toBe('Neuer Name');
    expect(sent.payload.payload.content).toBe('Neuer Inhalt');
    // Feldname aus dem Datenmodell, nicht aus dem Formular.
    expect(sent.payload.payload.sortnumber).toBe(1);
  });

  test('wer den Text anfasst, macht die Text-Fassung zur aktiven', async ({
    page,
  }) => {
    const absatz = paragraph(page);
    const sent = await captureSave(page, {
      success: true,
      result: { id: '00cn00000000000001' },
    });

    await openEditor(absatz);
    const felder = editor(absatz);
    await felder.text.fill('Nur Text');
    await felder.save.click();

    await expect.poll(() => sent.payload?.payload.active_type).toBe('text');
  });

  test('nach dem Speichern zeigt der Absatz den neuen Stand', async ({
    page,
  }) => {
    const absatz = paragraph(page);
    await captureSave(page, {
      success: true,
      result: { id: '00cn00000000000001' },
    });

    await openEditor(absatz);
    const felder = editor(absatz);
    await felder.text.fill('Gespeicherter Inhalt');
    await felder.save.click();

    await expect(absatz.locator('#content')).toContainText(
      'Gespeicherter Inhalt'
    );
  });

  test('Abbrechen verwirft die Eingabe und stellt den Serverstand her', async ({
    page,
  }) => {
    const absatz = paragraph(page);

    await openEditor(absatz);
    const felder = editor(absatz);
    await felder.text.fill('Verworfener Inhalt');
    await felder.cancel.click();

    await expect(absatz.locator('#content')).toContainText('Erste Zeile');
    await expect(absatz.locator('#content')).not.toContainText(
      'Verworfener Inhalt'
    );

    // Und der verworfene Stand ist auch beim erneuten Öffnen weg.
    await openEditor(absatz);
    await expect(editor(absatz).text).toHaveValue('Erste Zeile\nZweite Zeile');
  });
});
