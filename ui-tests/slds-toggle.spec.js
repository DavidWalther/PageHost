const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('./support/component-page');

/**
 * Attribut-, Event- und Struktur-Tests für die Lit-Komponente `slds-toggle`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, ein Consumer oder echtes Backend ist nicht nötig. Geprüft wird
 * das gerenderte Shadow-DOM gegen den SLDS-Blueprint `slds-checkbox_toggle` sowie
 * der Event-Contract (`toggle` mit `detail: { checked, name }`), auf den
 * `custom-publishing`, `custom-chapter-edit` und `bookstore` sich stützen.
 */

async function mountToggle(page, { attrs = {}, clicks = 0 } = {}) {
  return page.evaluate(
    async ({ attrs, clicks }) => {
      await import('/slds-components/slds-toggle/slds-toggle.js');
      document.querySelectorAll('slds-toggle').forEach((el) => el.remove());

      const el = document.createElement('slds-toggle');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      // Event am Parent abgreifen — belegt zugleich, dass `toggle` bubbelt.
      const events = [];
      document.body.addEventListener('toggle', (event) =>
        events.push(event.detail)
      );

      const input = el.shadowRoot.querySelector('input[type="checkbox"]');
      for (let i = 0; i < clicks; i += 1) {
        input.click();
        await el.updateComplete;
      }

      const root = el.shadowRoot;
      const label = root.querySelector('label');
      const faux = root.querySelector('.slds-checkbox_faux_container');
      const text = (selector) => {
        const node = root.querySelector(selector);
        return node ? node.textContent.trim() : null;
      };

      return {
        dir: root.querySelector('div[dir]')
          ? root.querySelector('div[dir]').getAttribute('dir')
          : null,
        hasFormElement: !!root.querySelector('.slds-form-element'),
        labelClass: label ? label.className : null,
        labelText: text('.slds-form-element__label'),
        onText: text('.slds-checkbox_on'),
        offText: text('.slds-checkbox_off'),
        hasFaux: !!root.querySelector('.slds-checkbox_faux'),
        ariaLive: faux ? faux.getAttribute('aria-live') : null,
        inputName: input ? input.getAttribute('name') : null,
        inputChecked: input ? input.checked : null,
        inputDisabled: input ? input.disabled : null,
        labelFor: label ? label.getAttribute('for') : null,
        inputId: input ? input.id : null,
        describedBy: input ? input.getAttribute('aria-describedby') : null,
        stateTextId: faux ? faux.id : null,
        hostCheckedAttr: el.hasAttribute('checked'),
        events,
      };
    },
    { attrs, clicks }
  );
}

test.describe('slds-toggle', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('Struktur: SLDS-Blueprint mit Faux-Container und On/Off-Spans', async ({
    page,
  }) => {
    const res = await mountToggle(page);
    expect(res.hasFormElement).toBe(true);
    expect(res.labelClass).toContain('slds-checkbox_toggle');
    expect(res.labelClass).toContain('slds-grid');
    expect(res.hasFaux).toBe(true);
    expect(res.ariaLive).toBe('assertive');
  });

  test('label, enabled-label, disabled-label und name landen im Markup', async ({
    page,
  }) => {
    const res = await mountToggle(page, {
      attrs: {
        label: 'Veröffentlichen',
        'enabled-label': 'An',
        'disabled-label': 'Aus',
        name: 'publish',
      },
    });
    expect(res.labelText).toBe('Veröffentlichen');
    expect(res.onText).toBe('An');
    expect(res.offText).toBe('Aus');
    expect(res.inputName).toBe('publish');
  });

  test('Label und Input sind über for/id verknüpft', async ({ page }) => {
    const res = await mountToggle(page);
    expect(res.inputId).toBeTruthy();
    expect(res.labelFor).toBe(res.inputId);
  });

  test('die id bleibt über Updates hinweg stabil', async ({ page }) => {
    // Früher wurde sie in render() per Math.random() neu erzeugt und wechselte
    // damit bei jedem Update — von außen nicht referenzierbar.
    const ids = await page.evaluate(async () => {
      await import('/slds-components/slds-toggle/slds-toggle.js');
      document.querySelectorAll('slds-toggle').forEach((el) => el.remove());

      const el = document.createElement('slds-toggle');
      el.setAttribute('label', 'Erst');
      document.body.appendChild(el);
      await el.updateComplete;
      const before = el.shadowRoot.querySelector('input').id;

      el.setAttribute('label', 'Dann');
      el.setAttribute('checked', '');
      await el.updateComplete;
      const input = el.shadowRoot.querySelector('input');

      return { before, after: input.id, labelFor: input.id };
    });
    expect(ids.after).toBe(ids.before);
  });

  test('aria-describedby zeigt auf den Zustandstext, nicht auf das Input selbst', async ({
    page,
  }) => {
    const res = await mountToggle(page, {
      attrs: { 'enabled-label': 'An', 'disabled-label': 'Aus' },
    });
    expect(res.describedBy).toBeTruthy();
    expect(res.describedBy).toBe(res.stateTextId);
    expect(res.describedBy).not.toBe(res.inputId);
  });

  test('checked setzt den Schalter', async ({ page }) => {
    const on = await mountToggle(page, { attrs: { checked: true } });
    expect(on.inputChecked).toBe(true);

    const off = await mountToggle(page);
    expect(off.inputChecked).toBe(false);
  });

  test('disabled deaktiviert den Schalter', async ({ page }) => {
    const res = await mountToggle(page, { attrs: { disabled: true } });
    expect(res.inputDisabled).toBe(true);
  });

  test('direction="right-to-left" dreht die Leserichtung, sonst ltr', async ({
    page,
  }) => {
    const rtl = await mountToggle(page, {
      attrs: { direction: 'right-to-left' },
    });
    expect(rtl.dir).toBe('rtl');

    const ltr = await mountToggle(page);
    expect(ltr.dir).toBe('ltr');
  });

  test('Klick feuert toggle mit detail { checked, name } und bubbelt', async ({
    page,
  }) => {
    const res = await mountToggle(page, {
      attrs: { name: 'publish' },
      clicks: 1,
    });
    expect(res.events).toEqual([{ checked: true, name: 'publish' }]);
    expect(res.inputChecked).toBe(true);
    // `checked` ist reflect: true -> der Zustand ist von außen am Attribut lesbar.
    expect(res.hostCheckedAttr).toBe(true);
  });

  test('Zweiter Klick schaltet zurück und meldet checked: false', async ({
    page,
  }) => {
    const res = await mountToggle(page, {
      attrs: { name: 'publish' },
      clicks: 2,
    });
    expect(res.events).toEqual([
      { checked: true, name: 'publish' },
      { checked: false, name: 'publish' },
    ]);
    expect(res.inputChecked).toBe(false);
    expect(res.hostCheckedAttr).toBe(false);
  });
});
