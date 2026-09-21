const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  respondWithContent,
  textContentRecord,
  openEditor,
  editor,
  CONTENT_ID,
} = require('../../support/paragraph-editor');

/**
 * Der lokale Entwurf.
 *
 * Ein Entwurf liegt im `localStorage` unter der **Id des Inhalts** und hat
 * Vorrang vor dem Serverstand: Der Absatz zeigt ihn an und markiert sich.
 * Drei Wege führen wieder heraus — übernehmen (speichern), verwerfen, oder ihn
 * einfach liegen lassen.
 *
 * Festgehalten wird der Schlüssel, der Inhalt und die Wirkung der drei Wege.
 * Dass die Markierung heute ein roter Rahmen über eine CSS-Klasse ist, bleibt
 * absichtlich außen vor — geprüft wird, **dass** der Absatz einen Entwurf
 * ausweist.
 */

/** Den Entwurf aus dem Browser lesen. `null`, wenn keiner da ist. */
function draftInStorage(page) {
  return page.evaluate((id) => {
    const raw = localStorage.getItem(id);
    return raw ? JSON.parse(raw) : null;
  }, CONTENT_ID);
}

/** Legt über den Editor einen Entwurf mit dem übergebenen Text an. */
async function createDraft(page, absatz, text) {
  await openEditor(absatz);
  const felder = editor(absatz);
  await felder.text.fill(text);
  await felder.draftEnable.click();
  await expect.poll(() => draftInStorage(page)).not.toBeNull();
  return felder;
}

async function captureSave(page) {
  const sent = { payload: null };
  await page.route('**/api/1.0/data/change/**', (route) => {
    sent.payload = JSON.parse(route.request().postData());
    return route.fulfill({
      json: { success: true, result: { id: CONTENT_ID } },
    });
  });
  return sent;
}

test.describe('custom-paragraph: Entwurf', () => {
  test.beforeEach(async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit'] });
    await respondWithContent(page, textContentRecord());
    await page.reload();
  });

  test('Anlegen legt den Entwurf unter der Inhalts-Id ab', async ({ page }) => {
    const absatz = paragraph(page);

    const felder = await createDraft(page, absatz, 'Entwurfs-Text');

    const draft = await draftInStorage(page);
    expect(draft.id).toBe(CONTENT_ID);
    expect(draft.content).toBe('Entwurfs-Text');
    expect(draft.draft).toBe(true);

    // Der Editor bleibt offen und bietet jetzt die Entwurfs-Wege an.
    await expect(felder.draftApply).toBeVisible();
    await expect(felder.draftDrop).toBeVisible();
  });

  test('der Entwurf hat Vorrang vor dem Serverstand und wird ausgewiesen', async ({
    page,
  }) => {
    const absatz = paragraph(page);

    const felder = await createDraft(page, absatz, 'Entwurfs-Text');
    await felder.save.click();

    const inhalt = absatz.locator('#content');
    await expect(inhalt).toContainText('Entwurfs-Text');
    await expect(inhalt).not.toContainText('Erste Zeile');
    await expect(inhalt).toHaveClass(/hasDraft/);
  });

  test('ein liegengebliebener Entwurf öffnet den Editor im Entwurfs-Modus', async ({
    page,
  }) => {
    const absatz = paragraph(page);

    const felder = await createDraft(page, absatz, 'Entwurfs-Text');
    await felder.save.click();
    await page.reload();

    const wieder = paragraph(page);
    await openEditor(wieder);
    // Dass der Editor vom Entwurf weiß, zeigt das Verwerfen: Es steht nur da,
    // wenn einer liegt. (Vor dem Umbau war es der Knopf „Apply", den es jetzt
    // nicht mehr gibt — das Speichern übernimmt den Entwurf.)
    await expect(editor(wieder).draftDrop).toBeVisible();
    await expect(editor(wieder).text).toHaveValue('Entwurfs-Text');
  });

  test('Übernehmen speichert den Entwurf und räumt ihn weg', async ({
    page,
  }) => {
    const absatz = paragraph(page);
    const sent = await captureSave(page);

    const felder = await createDraft(page, absatz, 'Zu übernehmen');
    await felder.draftApply.click();

    await expect
      .poll(() => sent.payload?.payload.content)
      .toBe('Zu übernehmen');
    await expect.poll(() => draftInStorage(page)).toBeNull();
    await expect(absatz.locator('#content')).not.toHaveClass(/hasDraft/);
  });

  test('Verwerfen löscht den Entwurf und stellt den Serverstand her', async ({
    page,
  }) => {
    const absatz = paragraph(page);

    const felder = await createDraft(page, absatz, 'Zu verwerfen');
    await felder.draftDrop.click();

    await expect.poll(() => draftInStorage(page)).toBeNull();
    const inhalt = absatz.locator('#content');
    await expect(inhalt).toContainText('Erste Zeile');
    await expect(inhalt).not.toContainText('Zu verwerfen');
    await expect(inhalt).not.toHaveClass(/hasDraft/);
  });
});
