const { test, expect } = require('@playwright/test');

/**
 * Attribut-, Typ- und Event-Tests für die Lit-Komponente `slds-input`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, daher ist kein Consumer und kein echtes Backend nötig. Geprüft
 * wird das gerenderte Shadow-DOM, das dem Legacy-Verhalten entspricht:
 * `.slds-form-element` mit Label und einem Control-Input, dessen Typ per
 * Strategy gewählt wird (`date` → Date-Input, alles andere → Text-Input als
 * Fallback), das `value`/`label`-Attribut wirkt, `type`/`value`/`label` reaktiv
 * sind und ein nativer `change` am Input als `change`-CustomEvent mit
 * `detail: { type, value }` am Host erneut gefeuert wird.
 *
 * Hinweis zum reaktiven `type`-Wechsel (Test 7): In der Legacy war das ein No-Op
 * (der `placeholder-input`-Slot ist nach dem Erst-Render bereits durch ein
 * Template ersetzt). Der Lit-Port löst die Strategy bei jedem Render neu auf und
 * unterstützt den Wechsel sauber — eine bewusste, nie exponierte Divergenz.
 */

// Mountet <slds-input> mit den gegebenen Attributen, wendet optional danach eine
// Attribut-Änderung an (Reaktivitäts-Tests) und liefert die Struktur des
// gerenderten Shadow-DOM zurück.
async function mountInput(page, { attrs = {}, setAttrAfter } = {}) {
  return page.evaluate(
    async ({ attrs, setAttrAfter }) => {
      await import('/slds-components/slds-input/slds-input.js');
      document.querySelectorAll('slds-input').forEach((el) => el.remove());

      const el = document.createElement('slds-input');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      if (setAttrAfter) {
        el.setAttribute(setAttrAfter.name, setAttrAfter.value);
        await el.updateComplete;
      }

      const root = el.shadowRoot;
      const formElement = root.querySelector('.slds-form-element');
      const label = root.querySelector('label.slds-form-element__label');
      const control = root.querySelector('.slds-form-element__control');
      const input = root.querySelector('input.input-element');

      return {
        hasFormElement: !!formElement,
        labelClass: label ? label.className : null,
        labelFor: label ? label.getAttribute('for') : null,
        labelText: label ? label.textContent : null,
        hasControl: !!control,
        inputId: input ? input.id : null,
        inputType: input ? input.getAttribute('type') : null,
        inputClass: input ? input.className : null,
        inputValue: input ? input.value : null,
      };
    },
    { attrs, setAttrAfter }
  );
}

// Mountet <slds-input>, registriert einen Host-`change`-Listener, setzt den
// Input-Wert, dispatcht ein natives `change` und meldet das am Host beobachtete
// (erneut gefeuerte) CustomEvent.
async function dispatchChange(page, { attrs = {}, inputValue } = {}) {
  return page.evaluate(
    async ({ attrs, inputValue }) => {
      await import('/slds-components/slds-input/slds-input.js');
      document.querySelectorAll('slds-input').forEach((el) => el.remove());

      const el = document.createElement('slds-input');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      let captured = null;
      el.addEventListener('change', (event) => {
        captured = {
          name: event.type,
          bubbles: event.bubbles,
          detailType: event.detail ? event.detail.type : null,
          detailValue: event.detail ? event.detail.value : null,
        };
      });

      const input = el.shadowRoot.querySelector('input.input-element');
      input.value = inputValue;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      return captured;
    },
    { attrs, inputValue }
  );
}

test.describe('slds-input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Struktur: Form-Element mit Label und Text-Input (default)', async ({
    page,
  }) => {
    const res = await mountInput(page);
    expect(res.hasFormElement).toBe(true);
    expect(res.labelClass).toContain('slds-form-element__label');
    expect(res.hasControl).toBe(true);
    expect(res.inputId).toBe('input-text');
    expect(res.inputType).toBe('text');
    expect(res.inputClass).toContain('slds-input');
    expect(res.inputClass).toContain('input-element');
    // Das Label zeigte früher auf ein `input-sample1`, das es nie gab.
    expect(res.labelFor).toBe(res.inputId);
  });

  test('Label und Input sind auch beim date-Typ verknüpft', async ({
    page,
  }) => {
    const res = await mountInput(page, { attrs: { type: 'date' } });
    expect(res.inputId).toBe('input-date');
    expect(res.labelFor).toBe('input-date');
  });

  test('label-Attribut setzt den Label-Text', async ({ page }) => {
    const res = await mountInput(page, { attrs: { label: 'Chapter Name' } });
    expect(res.labelText).toBe('Chapter Name');
  });

  test('value-Attribut setzt den Input-Wert', async ({ page }) => {
    const res = await mountInput(page, { attrs: { value: 'Hello' } });
    expect(res.inputValue).toBe('Hello');
  });

  test('type="date" rendert einen Date-Input', async ({ page }) => {
    const res = await mountInput(page, { attrs: { type: 'date' } });
    expect(res.inputId).toBe('input-date');
    expect(res.inputType).toBe('date');
  });

  test('type="number" fällt auf den Text-Input zurück (faithful)', async ({
    page,
  }) => {
    const res = await mountInput(page, { attrs: { type: 'number' } });
    expect(res.inputId).toBe('input-text');
    expect(res.inputType).toBe('text');
  });

  test('change-Event: nativer change am Input feuert change am Host', async ({
    page,
  }) => {
    const res = await dispatchChange(page, {
      attrs: { type: 'text' },
      inputValue: 'typed value',
    });
    expect(res).not.toBeNull();
    expect(res.name).toBe('change');
    expect(res.bubbles).toBe(true);
    expect(res.detailType).toBe('text');
    expect(res.detailValue).toBe('typed value');
  });

  test('Reaktiv: type-Wechsel rendert den Date-Input', async ({ page }) => {
    const res = await mountInput(page, {
      attrs: { type: 'text' },
      setAttrAfter: { name: 'type', value: 'date' },
    });
    expect(res.inputId).toBe('input-date');
    expect(res.inputType).toBe('date');
  });

  test('Reaktiv: value-Änderung aktualisiert den Input-Wert', async ({
    page,
  }) => {
    const res = await mountInput(page, {
      attrs: { value: 'first' },
      setAttrAfter: { name: 'value', value: 'second' },
    });
    expect(res.inputValue).toBe('second');
  });

  test('Reaktiv: label-Änderung aktualisiert den Label-Text', async ({
    page,
  }) => {
    const res = await mountInput(page, {
      attrs: { label: 'Old' },
      setAttrAfter: { name: 'label', value: 'New' },
    });
    expect(res.labelText).toBe('New');
  });
});
