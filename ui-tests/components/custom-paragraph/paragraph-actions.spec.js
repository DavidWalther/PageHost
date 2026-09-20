const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  editTrigger,
  deleteTrigger,
  publishTrigger,
  openEditor,
  editor,
} = require('../../support/paragraph-editor');

/**
 * Die neue Aktionsleiste am Absatz.
 *
 * Die Zusage ist **permanent sichtbar** — nicht „vorhanden": Vorher standen die
 * Schaltflächen auf `display: none` und erschienen erst bei `:hover`. Auf einem
 * Touchgerät gab es sie damit gar nicht.
 *
 * Dazu die Wege hinein und wieder heraus: Ein Modal, das den Fokus nicht
 * zurückgibt oder den Seiten-Scroll gesperrt lässt, macht die Seite unbenutzbar,
 * ohne dass ein Test darüber stolpert.
 */

const ALL_SCOPES = ['read', 'edit', 'create', 'delete', 'publish'];

/** Das tatsächlich fokussierte Element, quer durch die Shadow Roots. */
function activeElementPath(page) {
  return page.evaluate(() => {
    const path = [];
    let active = document.activeElement;
    while (active) {
      path.push(active.tagName.toLowerCase());
      const next = active.shadowRoot?.activeElement;
      if (!next) break;
      active = next;
    }
    return path;
  });
}

const bodyOverflow = (page) =>
  page.evaluate(() => document.body.style.overflow);

test.describe('custom-paragraph: Aktionsleiste', () => {
  test('alle drei Auslöser stehen dauerhaft, ohne Überfahren', async ({
    page,
  }) => {
    await openBookstore(page, { scopes: ALL_SCOPES });

    const absatz = paragraph(page);
    await expect(editTrigger(absatz)).toBeVisible();
    await expect(publishTrigger(absatz)).toBeVisible();
    await expect(deleteTrigger(absatz)).toBeVisible();
  });

  test('ohne Scope "publish" fehlt nur das Veröffentlichen', async ({
    page,
  }) => {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });

    const absatz = paragraph(page);
    await expect(editTrigger(absatz)).toBeVisible();
    await expect(deleteTrigger(absatz)).toBeVisible();
    await expect(publishTrigger(absatz)).toHaveCount(0);
  });

  test('der Editor öffnet ein Modal und gibt Fokus und Scroll wieder frei', async ({
    page,
  }) => {
    await openBookstore(page, { scopes: ALL_SCOPES });
    const absatz = paragraph(page);

    await openEditor(absatz);
    await expect(
      absatz.locator('custom-content-edit .slds-modal')
    ).toBeVisible();
    expect(await bodyOverflow(page)).toBe('hidden');

    await editor(absatz).cancel.click();

    await expect(absatz.locator('custom-content-edit .slds-modal')).toHaveCount(
      0
    );
    expect(await bodyOverflow(page)).toBe('');
  });

  /**
   * FEHLVERHALTEN — hält den Ist-Zustand fest, nicht das Soll.
   *
   * `slds-modal` merkt sich beim Öffnen `document.activeElement`. Liegt der
   * Auslöser in einem Shadow Root — und das tut er bei **jedem** echten
   * Consumer — meldet das nur den äußersten Host (`app-bookstore`). Der ist
   * ohne `tabindex` nicht fokussierbar, also landet der Fokus beim Schließen
   * auf `body`: Wer mit der Tastatur arbeitet, steht danach am Seitenanfang.
   *
   * Der eigene Spec von `slds-modal` sieht das nicht, weil er den Auslöser ins
   * Light DOM der Testseite hängt; dort ist `document.activeElement` der Button
   * selbst. Bestandsverhalten, das `custom-chapter-edit` genauso trifft — der
   * Fix gehört in `slds-modal` und dreht dann auch diesen Test um.
   */
  test('FEHLVERHALTEN: der Fokus kehrt nicht zum Auslöser zurück', async ({
    page,
  }) => {
    await openBookstore(page, { scopes: ALL_SCOPES });
    const absatz = paragraph(page);

    await openEditor(absatz);
    // Der Fokus wandert erst, wenn das Modal gerendert ist — abwarten, statt
    // im selben Atemzug zu messen. Ohne das Warten fiel der Test unter Last um.
    await expect(
      absatz.locator('custom-content-edit .slds-modal')
    ).toBeVisible();
    await expect
      .poll(() => activeElementPath(page))
      .toContain('custom-content-edit');

    await editor(absatz).cancel.click();
    await absatz
      .locator('custom-content-edit .slds-modal')
      .waitFor({ state: 'detached' });

    await expect.poll(() => activeElementPath(page)).toEqual(['body']);
  });

  test('die Escape-Taste schließt das Modal', async ({ page }) => {
    await openBookstore(page, { scopes: ALL_SCOPES });
    const absatz = paragraph(page);

    await openEditor(absatz);
    await expect(
      absatz.locator('custom-content-edit .slds-modal')
    ).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(absatz.locator('custom-content-edit .slds-modal')).toHaveCount(
      0
    );
    expect(await bodyOverflow(page)).toBe('');
  });

  test('das Veröffentlichen öffnet sein eigenes Modal', async ({ page }) => {
    await openBookstore(page, { scopes: ALL_SCOPES });
    const absatz = paragraph(page);

    await publishTrigger(absatz).click();

    const modal = absatz.locator('custom-content-publish .slds-modal');
    await expect(modal).toBeVisible();
    await expect(
      absatz.locator('custom-content-publish custom-publishing')
    ).toBeVisible();
    // Und es ist wirklich ein zweites Modal, nicht der Editor.
    await expect(absatz.locator('custom-content-edit .slds-modal')).toHaveCount(
      0
    );
  });

  test('auf schmalem Viewport bleiben alle drei Auslöser erreichbar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await openBookstore(page, { scopes: ALL_SCOPES });

    const absatz = paragraph(page);
    await expect(editTrigger(absatz)).toBeVisible();
    await expect(publishTrigger(absatz)).toBeVisible();
    await expect(deleteTrigger(absatz)).toBeVisible();

    // Das Modal füllt dort den Schirm (`size="full"` unter 30em) und die
    // Schaltflächen im Fuß bleiben erreichbar.
    await openEditor(absatz);
    await expect(editor(absatz).save).toBeVisible();
    await expect(editor(absatz).cancel).toBeVisible();
  });
});
