const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * `custom-content-edit` — der Editor eines Inhalts in einem Modal.
 *
 * Die Komponente folgt dem Muster von `custom-chapter-edit`: Sie besitzt den
 * auslösenden Icon-Button **und** das Modal und wird von außen über `show()`
 * geöffnet. Anders als dort gibt es **keine Tabs** — das Veröffentlichen ist
 * eine eigene Komponente, und was übrig bleibt, ist ein Formular.
 *
 * Isoliert gemountet: Die Komponente holt keine Daten, sie bekommt den
 * Datensatz als Property gereicht.
 */

const RECORD = {
  id: '00cn00000000000001',
  name: 'Ein Absatz',
  sortnumber: 3,
  published_date: null,
  node_id: '000n00000000000001',
  active_type: 'text',
  content: 'Erste Zeile\nZweite Zeile',
  htmlcontent: '<p>Erste Zeile</p>',
};

async function mount(page, { scopes = ['edit'], record = RECORD } = {}) {
  await page.evaluate(
    async ({ scopes, record }) => {
      if (scopes.length > 0) {
        sessionStorage.setItem(
          'code_exchange_response',
          JSON.stringify({
            authenticationResult: { access: { scopes } },
          })
        );
      } else {
        sessionStorage.removeItem('code_exchange_response');
      }

      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/slds-components/slds-modal/slds-modal.js');
      await import('/slds-components/slds-input/slds-input.js');
      await import('/slds-components/slds-combobox/slds-combobox.js');
      await import('/components/custom-content-edit/custom-content-edit.js');

      document
        .querySelectorAll('custom-content-edit')
        .forEach((el) => el.remove());

      const el = document.createElement('custom-content-edit');
      el.contentData = record;
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { scopes, record }
  );
  return page.locator('custom-content-edit');
}

/** Öffnet das Modal über die öffentliche Schnittstelle. */
async function open(page) {
  await page.evaluate(async () => {
    const el = document.querySelector('custom-content-edit');
    el.show();
    await el.updateComplete;
  });
}

test.describe('custom-content-edit', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('ohne Scope "edit" gibt es keinen Auslöser', async ({ page }) => {
    const editor = await mount(page, { scopes: [] });

    await expect(editor.locator('slds-button-icon')).toHaveCount(0);
  });

  test('mit Scope "edit" erscheint der Bearbeiten-Auslöser', async ({
    page,
  }) => {
    const editor = await mount(page);

    const trigger = editor.locator('slds-button-icon');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('icon', 'utility:edit');
  });

  test('geschlossen rendert das Modal nichts', async ({ page }) => {
    const editor = await mount(page);

    await expect(editor.locator('.slds-modal')).toHaveCount(0);
  });

  test('show() öffnet das Modal in voller Breite und ohne Tabs', async ({
    page,
  }) => {
    const editor = await mount(page);
    await open(page);

    const modal = editor.locator('slds-modal');
    await expect(modal).toHaveAttribute('open', '');
    await expect(modal).toHaveAttribute('size', 'full');
    await expect(editor.locator('.slds-tabs_default')).toHaveCount(0);
  });

  test('die Felder sind aus contentData vorbelegt', async ({ page }) => {
    const editor = await mount(page);
    await open(page);

    await expect(editor.locator('#input-text')).toHaveValue('Ein Absatz');
    await expect(editor.locator('#input-number')).toHaveValue('3');
    await expect(editor.locator('#content-input')).toHaveValue(
      'Erste Zeile\nZweite Zeile'
    );
  });

  test('die Fassung des Datensatzes ist vorausgewählt', async ({ page }) => {
    const editor = await mount(page);
    await open(page);

    await expect(editor.locator('slds-combobox')).toHaveAttribute(
      'value',
      'text'
    );
  });

  test('der Klick auf den Auslöser öffnet das Modal', async ({ page }) => {
    const editor = await mount(page);

    await editor.locator('slds-button-icon').click();

    await expect(editor.locator('slds-modal')).toHaveAttribute('open', '');
  });
});
