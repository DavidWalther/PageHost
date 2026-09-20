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
      await import('/slds-components/slds-toggle/slds-toggle.js');
      await import('/slds-components/slds-layout/slds-layout.js');
      await import('/slds-components/slds-layout/slds-layout-item.js');
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

/**
 * Die Fassung wird **ausdrücklich** gewählt.
 *
 * Früher ergab sie sich als Nebenwirkung daraus, welches Feld zuletzt befüllt
 * war: Wer die HTML-Fassung leerte, kippte den Datensatz still auf `text`
 * zurück. Jetzt sagt die Auswahl, welche Fassung gilt — und das eine Textfeld
 * zeigt genau diese.
 */
test.describe('custom-content-edit: Fassung wählen', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  /** Wählt eine Fassung so, wie ein Benutzer es täte. */
  async function chooseVersion(editor, label) {
    await editor.locator('slds-combobox .slds-combobox').click();
    await editor
      .locator('slds-combobox ul.slds-listbox li', {
        hasText: label,
      })
      .click();
  }

  test('die Auswahl schaltet das Textfeld auf die andere Fassung', async ({
    page,
  }) => {
    const editor = await mount(page);
    await open(page);

    await chooseVersion(editor, 'HTML');

    await expect(editor.locator('#content-input')).toHaveValue(
      '<p>Erste Zeile</p>'
    );
  });

  test('der Inhalt der anderen Fassung geht beim Umschalten nicht verloren', async ({
    page,
  }) => {
    const editor = await mount(page);
    await open(page);

    await editor.locator('#content-input').fill('Geänderter Text');
    await chooseVersion(editor, 'HTML');
    await editor.locator('#content-input').fill('<p>Geändertes HTML</p>');
    await chooseVersion(editor, 'Text');

    await expect(editor.locator('#content-input')).toHaveValue(
      'Geänderter Text'
    );
  });

  test('eine Fassung, die es noch nicht gibt, beginnt leer', async ({
    page,
  }) => {
    const editor = await mount(page, {
      record: {
        id: '00cn00000000000001',
        name: 'Nur Text',
        sortnumber: 1,
        active_type: 'text',
        content: 'Vorhandener Text',
      },
    });
    await open(page);

    await chooseVersion(editor, 'HTML');

    await expect(editor.locator('#content-input')).toHaveValue('');
  });
});

/**
 * Speichern.
 *
 * Die Komponente ruft nichts selbst auf: Sie feuert ein `save`-Ereignis, das im
 * Betrieb `public/index.js` an den Endpunkt bindet. Hier antwortet der Test —
 * und kann dadurch sowohl den Payload als auch den Fehlerfall prüfen.
 */
test.describe('custom-content-edit: Speichern', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  /**
   * Fängt `save` ab. `outcome` entscheidet, womit der Callback antwortet.
   * `window.__saved` hält das Ereignis-Detail, `window.__updated` die Meldung
   * `content-updated`.
   */
  async function captureSave(page, outcome = { ok: true }) {
    await page.evaluate((outcome) => {
      window.__saved = null;
      window.__updated = null;
      document.body.addEventListener('save', (event) => {
        window.__saved = {
          object: event.detail.object,
          payload: event.detail.payload,
        };
        if (outcome.ok) {
          event.detail.callback(null, {
            success: true,
            result: event.detail.payload,
          });
        } else {
          event.detail.callback('Fehlgeschlagen', null);
        }
      });
      document.body.addEventListener('content-updated', (event) => {
        window.__updated = event.detail;
      });
    }, outcome);
  }

  const saved = (page) => page.evaluate(() => window.__saved);
  const updated = (page) => page.evaluate(() => window.__updated);

  test('Speichern schickt object "content" mit den Feldern des Modells', async ({
    page,
  }) => {
    const editor = await mount(page);
    await captureSave(page);
    await open(page);

    await editor.locator('#input-text').fill('Neuer Name');
    await editor.locator('#input-text').blur();
    await editor.locator('#content-input').fill('Neuer Text');
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => saved(page)).not.toBeNull();
    const { object, payload } = await saved(page);
    expect(object).toBe('content');
    expect(payload.id).toBe('00cn00000000000001');
    expect(payload.name).toBe('Neuer Name');
    expect(payload.sortnumber).toBe(3);
    expect(payload.content).toBe('Neuer Text');
    expect(payload.active_type).toBe('text');
  });

  test('eine Fassung, die es nicht gibt, kommt nicht als leere Zeile mit', async ({
    page,
  }) => {
    const editor = await mount(page, {
      record: {
        id: '00cn00000000000001',
        name: 'Nur Text',
        sortnumber: 1,
        active_type: 'text',
        content: 'Vorhandener Text',
      },
    });
    await captureSave(page);
    await open(page);

    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => saved(page)).not.toBeNull();
    const { payload } = await saved(page);
    expect(payload).not.toHaveProperty('htmlcontent');
  });

  test('eine leere Fassung wird nicht zur aktiven', async ({ page }) => {
    const editor = await mount(page, {
      record: {
        id: '00cn00000000000001',
        name: 'Nur Text',
        sortnumber: 1,
        active_type: 'text',
        content: 'Vorhandener Text',
      },
    });
    await captureSave(page);
    await open(page);

    await editor.locator('slds-combobox .slds-combobox').click();
    await editor
      .locator('slds-combobox ul.slds-listbox li', { hasText: 'HTML' })
      .click();
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => saved(page)).not.toBeNull();
    const { payload } = await saved(page);
    expect(payload.active_type).toBe('text');
  });

  test('nach erfolgreichem Speichern meldet die Komponente und schließt', async ({
    page,
  }) => {
    const editor = await mount(page);
    await captureSave(page);
    await open(page);

    await editor.locator('#content-input').fill('Gespeicherter Text');
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => updated(page)).not.toBeNull();
    const meldung = await updated(page);
    expect(meldung.contentData.content).toBe('Gespeicherter Text');
    await expect(editor.locator('.slds-modal')).toHaveCount(0);
  });

  test('schlägt das Speichern fehl, bleibt das Modal mit der Eingabe offen', async ({
    page,
  }) => {
    const editor = await mount(page);
    await captureSave(page, { ok: false });
    await open(page);

    await editor.locator('#content-input').fill('Nicht gespeicherter Text');
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => saved(page)).not.toBeNull();
    await expect(editor.locator('.slds-modal')).toHaveCount(1);
    await expect(editor.locator('#content-input')).toHaveValue(
      'Nicht gespeicherter Text'
    );
  });

  test('ohne Namen wird nicht gespeichert', async ({ page }) => {
    const editor = await mount(page);
    await captureSave(page);
    await open(page);

    await editor.locator('#input-text').fill('');
    await editor.locator('#input-text').blur();
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect(editor.locator('.slds-modal')).toHaveCount(1);
    expect(await saved(page)).toBeNull();
  });

  test('Abbrechen speichert nicht und verwirft die Eingabe', async ({
    page,
  }) => {
    const editor = await mount(page);
    await captureSave(page);
    await open(page);

    await editor.locator('#content-input').fill('Verworfener Text');
    await editor.locator('button', { hasText: 'Abbrechen' }).click();

    expect(await saved(page)).toBeNull();
    await open(page);
    await expect(editor.locator('#content-input')).toHaveValue(
      'Erste Zeile\nZweite Zeile'
    );
  });
});

/**
 * Der lokale Entwurf.
 *
 * Er liegt im `localStorage` unter der Id des Inhalts und hat Vorrang: Wer den
 * Editor öffnet, während ein Entwurf liegt, arbeitet an ihm weiter.
 *
 * Die Leiste kennt zwei Wege — anlegen und verwerfen. Ein dritter („übernehmen")
 * wäre derselbe Knopf wie **Speichern**: Der Formularstand *ist* der Entwurf,
 * und ein erfolgreiches Speichern räumt ihn weg.
 */
test.describe('custom-content-edit: Entwurf', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  const draftInStorage = (page) =>
    page.evaluate((id) => {
      const raw = localStorage.getItem(id);
      return raw ? JSON.parse(raw) : null;
    }, RECORD.id);

  /** Zählt die Meldungen `content-draft-changed`. */
  async function watchDraftEvents(page) {
    await page.evaluate(() => {
      window.__draftEvents = [];
      document.body.addEventListener('content-draft-changed', (event) =>
        window.__draftEvents.push(event.detail)
      );
    });
  }

  const draftEvents = (page) => page.evaluate(() => window.__draftEvents);

  const draftCreate = (editor) =>
    editor.locator('button', { hasText: 'Entwurf anlegen' });
  const draftUpdate = (editor) =>
    editor.locator('button', { hasText: 'Entwurf aktualisieren' });
  const draftDrop = (editor) =>
    editor.locator('button', { hasText: 'Entwurf verwerfen' });

  test('ohne Entwurf gibt es nur das Anlegen', async ({ page }) => {
    const editor = await mount(page);
    await open(page);

    await expect(draftCreate(editor)).toHaveCount(1);
    await expect(draftDrop(editor)).toHaveCount(0);
  });

  test('Anlegen schreibt den Entwurf unter die Inhalts-Id und meldet ihn', async ({
    page,
  }) => {
    const editor = await mount(page);
    await watchDraftEvents(page);
    await open(page);

    await editor.locator('#content-input').fill('Entwurfs-Text');
    await draftCreate(editor).click();

    await expect.poll(() => draftInStorage(page)).not.toBeNull();
    const draft = await draftInStorage(page);
    expect(draft.id).toBe(RECORD.id);
    expect(draft.content).toBe('Entwurfs-Text');
    expect(draft.draft).toBe(true);
    expect(await draftEvents(page)).toEqual([{ hasDraft: true }]);

    // Das Modal bleibt offen, die Leiste bietet jetzt beide Wege an.
    await expect(editor.locator('.slds-modal')).toHaveCount(1);
    await expect(draftUpdate(editor)).toHaveCount(1);
    await expect(draftDrop(editor)).toHaveCount(1);
  });

  test('ein liegender Entwurf belegt das Formular beim Öffnen', async ({
    page,
  }) => {
    const editor = await mount(page);
    await open(page);
    await editor.locator('#content-input').fill('Entwurfs-Text');
    await draftCreate(editor).click();
    await editor.locator('button', { hasText: 'Abbrechen' }).click();

    await open(page);

    await expect(editor.locator('#content-input')).toHaveValue('Entwurfs-Text');
    await expect(draftDrop(editor)).toHaveCount(1);
  });

  test('Verwerfen löscht den Entwurf und stellt den Serverstand her', async ({
    page,
  }) => {
    const editor = await mount(page);
    await open(page);
    await editor.locator('#content-input').fill('Entwurfs-Text');
    await draftCreate(editor).click();
    await watchDraftEvents(page);

    await draftDrop(editor).click();

    await expect.poll(() => draftInStorage(page)).toBeNull();
    await expect(editor.locator('#content-input')).toHaveValue(
      'Erste Zeile\nZweite Zeile'
    );
    expect(await draftEvents(page)).toEqual([{ hasDraft: false }]);
  });

  test('erfolgreiches Speichern übernimmt den Entwurf und räumt ihn weg', async ({
    page,
  }) => {
    const editor = await mount(page);
    await page.evaluate(() => {
      window.__saved = null;
      document.body.addEventListener('save', (event) => {
        window.__saved = event.detail.payload;
        event.detail.callback(null, { success: true });
      });
    });
    await open(page);
    await editor.locator('#content-input').fill('Entwurfs-Text');
    await draftCreate(editor).click();
    await watchDraftEvents(page);

    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect
      .poll(() => page.evaluate(() => window.__saved?.content))
      .toBe('Entwurfs-Text');
    await expect.poll(() => draftInStorage(page)).toBeNull();
    expect(await draftEvents(page)).toEqual([{ hasDraft: false }]);
  });
});

/**
 * Die gewählte Fassung muss beim Speichern auch **ankommen**.
 *
 * Der Zeiger im Modell heißt `content_node.active_content_item` und zeigt auf
 * ein `content_item`. Der Editor sagt ihn über `active_type`; der Schreibpfad
 * löst das in die Id auf. Er tut das nur, wenn der Payload die Fassung auch
 * mitbringt — deshalb hängen beide Regeln zusammen.
 *
 * Entscheidend ist der Unterschied zwischen **„es gibt diese Fassung nicht"**
 * und **„diese Fassung ist leer"**. Ein vorhandenes, leeres `content_item` hat
 * eine Id, auf die der Zeiger zeigen kann. `custom-paragraph` unterscheidet
 * beides bereits: Ein Feld für eine Fassung, die es nicht gibt, **fehlt**; eine
 * vorhandene, leere Fassung steht als `null` im Datensatz.
 */
test.describe('custom-content-edit: die gewählte Fassung geht hinaus', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  async function captureSave(page) {
    await page.evaluate(() => {
      window.__saved = null;
      document.body.addEventListener('save', (event) => {
        window.__saved = event.detail.payload;
        event.detail.callback(null, { success: true });
      });
    });
  }

  const saved = (page) => page.evaluate(() => window.__saved);

  async function chooseVersion(editor, label) {
    await editor.locator('slds-combobox .slds-combobox').click();
    await editor
      .locator('slds-combobox ul.slds-listbox li', { hasText: label })
      .click();
  }

  /** Beide Fassungen vorhanden, HTML aber leer. */
  const MIT_LEERER_HTML_FASSUNG = {
    id: '00cn00000000000001',
    name: 'Ein Absatz',
    sortnumber: 1,
    active_type: 'text',
    content: 'Vorhandener Text',
    htmlcontent: null,
  };

  /** Nur Text — eine HTML-Fassung gibt es nicht, das Feld fehlt. */
  const OHNE_HTML_FASSUNG = {
    id: '00cn00000000000001',
    name: 'Ein Absatz',
    sortnumber: 1,
    active_type: 'text',
    content: 'Vorhandener Text',
  };

  test('eine vorhandene, aber leere Fassung wird aktiv', async ({ page }) => {
    const editor = await mount(page, { record: MIT_LEERER_HTML_FASSUNG });
    await captureSave(page);
    await open(page);

    await chooseVersion(editor, 'HTML');
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => saved(page)).not.toBeNull();
    const payload = await saved(page);
    expect(payload.active_type).toBe('html');
    // Ohne das Feld kann der Schreibpfad den Zeiger nicht auflösen: Er nimmt
    // nur Fassungen an, die der Payload auch mitbringt.
    expect(payload).toHaveProperty('htmlcontent');
  });

  test('eine Fassung, die es nicht gibt, wird nicht still übergangen', async ({
    page,
  }) => {
    const editor = await mount(page, { record: OHNE_HTML_FASSUNG });
    await captureSave(page);
    await open(page);

    const toasts = await page.evaluate(() => {
      window.__toasts = [];
      document.body.addEventListener('toast', (event) =>
        window.__toasts.push(event.detail.variant)
      );
      return true;
    });
    expect(toasts).toBe(true);

    await chooseVersion(editor, 'HTML');
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => saved(page)).not.toBeNull();
    const payload = await saved(page);
    // Der Zeiger darf nicht auf etwas zeigen, das es nicht gibt …
    expect(payload.active_type).toBe('text');
    expect(payload).not.toHaveProperty('htmlcontent');
    // … aber das muss gesagt werden, statt still zu geschehen.
    await expect
      .poll(() => page.evaluate(() => window.__toasts))
      .toContain('warning');
  });

  test('wer die neue Fassung befüllt, macht sie damit aktiv', async ({
    page,
  }) => {
    const editor = await mount(page, { record: OHNE_HTML_FASSUNG });
    await captureSave(page);
    await open(page);

    await chooseVersion(editor, 'HTML');
    await editor.locator('#content-input').fill('<p>Neu angelegt</p>');
    await editor.locator('button', { hasText: 'Speichern' }).click();

    await expect.poll(() => saved(page)).not.toBeNull();
    const payload = await saved(page);
    expect(payload.active_type).toBe('html');
    expect(payload.htmlcontent).toBe('<p>Neu angelegt</p>');
  });
});
