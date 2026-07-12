const { test, expect } = require('@playwright/test');

/**
 * Struktur-, Dropdown-, Selektions- und Filter-Tests für die Lit-Komponente
 * `slds-combobox`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, daher ist kein Consumer und kein echtes Backend nötig. Geprüft
 * wird das gerenderte Shadow-DOM: Struktur und ARIA, das Options-Markup samt
 * Truncate-Span, Selektion und Check-Icon, Dropdown-Toggle, Filter, Blur — und
 * der Event-Contract (`select` mit `detail.value`).
 */

const OPTIONS = [
  { value: 'c1', label: 'Alpha', title: 'Alpha title' },
  { value: 'c2', label: 'Beta', title: 'Beta title' },
  { value: 'c3', label: 'Gamma', title: 'Gamma title' },
];

// Mountet <slds-combobox>, spielt eine Aktionsfolge ab und liefert die Struktur
// des gerenderten Shadow-DOM zurück.
// Aktionen: { type: 'toggle' } | { type: 'click-option', index }
//         | { type: 'type', text } | { type: 'blur' }
async function mountCombobox(page, { attrs = {}, actions = [] } = {}) {
  return page.evaluate(
    async ({ attrs, actions }) => {
      await import('/slds-components/slds-combobox/slds-combobox.js');
      document.querySelectorAll('slds-combobox').forEach((el) => el.remove());

      const el = document.createElement('slds-combobox');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      const root = el.shadowRoot;

      for (const action of actions) {
        if (action.type === 'toggle') {
          root.querySelector('.slds-combobox').click();
        } else if (action.type === 'click-option') {
          root.querySelectorAll('ul.slds-listbox li')[action.index].click();
        } else if (action.type === 'type') {
          const input = root.querySelector('input');
          input.value = action.text;
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        } else if (action.type === 'blur') {
          root.querySelector('input').dispatchEvent(new FocusEvent('blur'));
          // Die Legacy schließt das Dropdown erst nach 50 ms (setTimeout).
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        await el.updateComplete;
      }

      const combobox = root.querySelector('.slds-combobox');
      const input = root.querySelector('input');
      const label = root.querySelector('label.slds-form-element__label');
      const listbox = root.querySelector('#listbox-id');
      const ul = root.querySelector('ul.slds-listbox');
      // Das Down-Icon sitzt im Icon-Container rechts im Form-Element.
      const downUse = root.querySelector('span.slds-input__icon use');

      const items = [...ul.querySelectorAll('li')].map((li) => {
        const div = li.querySelector('div');
        const body = li.querySelector('span.slds-media__body');
        const iconUse = div.querySelector('span.slds-listbox__option-icon use');
        return {
          id: div.id,
          dataValue: div.dataset.value,
          role: div.getAttribute('role'),
          divClass: div.className,
          ariaSelected: div.getAttribute('aria-selected'),
          ariaChecked: div.getAttribute('aria-checked'),
          bodyText: body ? body.textContent.trim() : null,
          bodyStyle: body ? body.getAttribute('style') : null,
          // Das Label steckt im Truncate-Span, der auch den title trägt (Blueprint).
          truncateText: body?.querySelector('span.slds-truncate')
            ? body.querySelector('span.slds-truncate').textContent.trim()
            : null,
          truncateTitle: body?.querySelector('span.slds-truncate')
            ? body.querySelector('span.slds-truncate').getAttribute('title')
            : null,
          hasTruncateSpan: !!(body && body.querySelector('span.slds-truncate')),
          // href.baseVal ist die vom Browser aufgelöste Sprite-Referenz —
          // getAttribute('xlink:href') würde auch ein nicht auflösendes Icon
          // durchgehen lassen.
          checkHref: iconUse ? iconUse.href.baseVal : null,
        };
      });

      return {
        hasFormElement: !!root.querySelector('.slds-form-element'),
        labelFor: label ? label.getAttribute('for') : null,
        labelText: label ? label.textContent.trim() : null,
        comboboxClass: combobox ? combobox.className : null,
        comboboxRole: combobox ? combobox.getAttribute('role') : null,
        ariaExpanded: combobox ? combobox.getAttribute('aria-expanded') : null,
        ariaHaspopup: combobox ? combobox.getAttribute('aria-haspopup') : null,
        inputId: input ? input.id : null,
        inputClass: input ? input.className : null,
        inputValue: input ? input.value : null,
        inputRole: input ? input.getAttribute('role') : null,
        inputPlaceholder: input ? input.getAttribute('placeholder') : null,
        inputReadonly: input ? input.hasAttribute('readonly') : null,
        inputDisabled: input ? input.disabled : null,
        ariaControls: input ? input.getAttribute('aria-controls') : null,
        autocomplete: input ? input.getAttribute('autocomplete') : null,
        activeDescendant: input
          ? input.getAttribute('aria-activedescendant')
          : null,
        listboxId: listbox ? listbox.id : null,
        listboxClass: listbox ? listbox.className : null,
        listboxRole: listbox ? listbox.getAttribute('role') : null,
        ulClass: ul ? ul.className : null,
        downHref: downUse ? downUse.href.baseVal : null,
        items,
      };
    },
    { attrs, actions }
  );
}

// Mountet, klickt eine Option und meldet, ob/wie das select-Event am Host bzw.
// (durch Bubbling) am document.body ankommt.
async function selectEvent(page, { attrs = {}, index = 0 } = {}) {
  return page.evaluate(
    async ({ attrs, index }) => {
      await import('/slds-components/slds-combobox/slds-combobox.js');
      document.querySelectorAll('slds-combobox').forEach((el) => el.remove());

      const el = document.createElement('slds-combobox');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      let onHost = null;
      let reachedBody = false;
      el.addEventListener('select', (event) => {
        onHost = {
          detailValue: event.detail ? event.detail.value : null,
          bubbles: event.bubbles,
          composed: event.composed,
        };
      });
      document.body.addEventListener('select', () => (reachedBody = true));

      el.shadowRoot.querySelectorAll('ul.slds-listbox li')[index].click();
      await el.updateComplete;

      return { onHost, reachedBody };
    },
    { attrs, index }
  );
}

test.describe('slds-combobox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Struktur: Combobox mit Input, Dropdown und Listbox', async ({
    page,
  }) => {
    const res = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
    });
    expect(res.hasFormElement).toBe(true);
    expect(res.labelFor).toBe('combobox-id');
    expect(res.comboboxClass).toContain('slds-combobox');
    expect(res.comboboxClass).toContain('slds-dropdown-trigger');
    expect(res.comboboxClass).toContain('slds-dropdown-trigger_click');
    expect(res.comboboxRole).toBe('combobox');
    expect(res.ariaHaspopup).toBe('listbox');
    expect(res.inputId).toBe('combobox-id');
    expect(res.inputClass).toContain('slds-input');
    expect(res.inputClass).toContain('slds-combobox__input');
    expect(res.inputRole).toBe('textbox');
    expect(res.ariaControls).toBe('listbox-id');
    expect(res.autocomplete).toBe('off');
    expect(res.listboxId).toBe('listbox-id');
    expect(res.listboxClass).toContain('slds-dropdown');
    expect(res.listboxClass).toContain('slds-dropdown_length-5');
    expect(res.listboxClass).toContain('slds-dropdown_fluid');
    expect(res.listboxRole).toBe('listbox');
    expect(res.ulClass).toContain('slds-listbox');
    expect(res.ulClass).toContain('slds-listbox_vertical');
  });

  test('Down-Icon: use-Referenz löst auf das down-Symbol auf', async ({
    page,
  }) => {
    const res = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
    });
    expect(res.downHref).toContain('utility-sprite');
    expect(res.downHref).toContain('#down');
  });

  test('label und placeholder wirken', async ({ page }) => {
    const res = await mountCombobox(page, {
      attrs: {
        options: JSON.stringify(OPTIONS),
        label: 'Kapitel',
        placeholder: 'Kapitel auswählen',
      },
    });
    expect(res.labelText).toBe('Kapitel');
    expect(res.inputPlaceholder).toBe('Kapitel auswählen');
  });

  test('Options-Rendering: li je Option mit Truncate-Span', async ({
    page,
  }) => {
    const res = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
    });
    expect(res.items).toHaveLength(3);

    const [first] = res.items;
    expect(first.id).toBe('c1');
    expect(first.dataValue).toBe('c1');
    expect(first.role).toBe('option');
    expect(first.divClass).toContain('slds-listbox__option');
    expect(first.divClass).toContain('slds-listbox__option_plain');
    expect(first.bodyStyle).toContain('--custom-combobox-option-color');

    // Ohne den Truncate-Span laufen lange Labels aus der Combobox heraus, statt
    // mit Ellipse abgeschnitten zu werden.
    expect(first.hasTruncateSpan).toBe(true);
    expect(first.truncateText).toBe('Alpha');
    expect(first.truncateTitle).toBe('Alpha title');

    expect(res.items.map((item) => item.truncateText)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
  });

  test('value markiert die passende Option und setzt den Input-Text', async ({
    page,
  }) => {
    const res = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS), value: 'c2' },
    });
    expect(res.inputValue).toBe('Beta');

    const beta = res.items[1];
    expect(beta.divClass).toContain('slds-is-selected');
    expect(beta.divClass).toContain('slds-has-focus');
    expect(beta.ariaSelected).toBe('true');
    expect(beta.ariaChecked).toBe('true');
    expect(beta.checkHref).toContain('#check');

    // Die anderen bleiben unmarkiert und ohne Check-Icon.
    expect(res.items[0].divClass).not.toContain('slds-is-selected');
    expect(res.items[0].checkHref).toBeNull();
    expect(res.items[2].checkHref).toBeNull();
  });

  test('readonly: default gesetzt, mit filterable entfernt', async ({
    page,
  }) => {
    const plain = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
    });
    expect(plain.inputReadonly).toBe(true);

    const filterable = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS), filterable: true },
    });
    expect(filterable.inputReadonly).toBe(false);
  });

  test('disabled deaktiviert den Input', async ({ page }) => {
    const res = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS), disabled: true },
    });
    expect(res.inputDisabled).toBe(true);
  });

  test('Dropdown: Klick öffnet, erneuter Klick schließt', async ({ page }) => {
    const closed = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
    });
    expect(closed.comboboxClass).not.toContain('slds-is-open');

    const opened = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      actions: [{ type: 'toggle' }],
    });
    expect(opened.comboboxClass).toContain('slds-is-open');

    const reclosed = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      actions: [{ type: 'toggle' }, { type: 'toggle' }],
    });
    expect(reclosed.comboboxClass).not.toContain('slds-is-open');
  });

  test('Options-Klick: markiert, setzt Input-Text und aria-activedescendant, Dropdown bleibt offen', async ({
    page,
  }) => {
    const res = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      actions: [{ type: 'toggle' }, { type: 'click-option', index: 2 }],
    });
    expect(res.inputValue).toBe('Gamma');
    expect(res.activeDescendant).toBe('c3');
    expect(res.items[2].divClass).toContain('slds-is-selected');
    expect(res.items[2].checkHref).toContain('#check');
    // Der li-Klick stoppt die Propagation -> kein Toggle, Dropdown bleibt offen.
    expect(res.comboboxClass).toContain('slds-is-open');
  });

  test('select-Event: detail.value am Host, bubbelt und ist composed', async ({
    page,
  }) => {
    // Feuerte früher ohne bubbles/composed (beide undefined) und verließ die
    // Komponente damit nicht — nur ein Listener direkt am Element sah es.
    const res = await selectEvent(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      index: 1,
    });
    expect(res.onHost).not.toBeNull();
    expect(res.onHost.detailValue).toBe('c2');
    expect(res.onHost.bubbles).toBe(true);
    expect(res.onHost.composed).toBe(true);
    expect(res.reachedBody).toBe(true);
  });

  test('Filter: filterable reduziert die Liste, ohne filterable passiert nichts', async ({
    page,
  }) => {
    const filtered = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS), filterable: true },
      actions: [{ type: 'type', text: 'alp' }],
    });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].bodyText).toBe('Alpha');

    const unfiltered = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      actions: [{ type: 'type', text: 'alp' }],
    });
    expect(unfiltered.items).toHaveLength(3);
  });

  test('Blur schließt das Dropdown', async ({ page }) => {
    const res = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      actions: [{ type: 'toggle' }, { type: 'blur' }],
    });
    expect(res.comboboxClass).not.toContain('slds-is-open');
  });

  test('aria-expanded folgt dem Dropdown-Zustand', async ({ page }) => {
    // Stand früher statisch auf "false" — Screenreader erfuhren nie, dass das
    // Dropdown offen ist; nur die Klasse slds-is-open spiegelte den Zustand.
    const closed = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
    });
    expect(closed.comboboxClass).not.toContain('slds-is-open');
    expect(closed.ariaExpanded).toBe('false');

    const open = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      actions: [{ type: 'toggle' }],
    });
    expect(open.comboboxClass).toContain('slds-is-open');
    expect(open.ariaExpanded).toBe('true');

    const reclosed = await mountCombobox(page, {
      attrs: { options: JSON.stringify(OPTIONS) },
      actions: [{ type: 'toggle' }, { type: 'toggle' }],
    });
    expect(reclosed.ariaExpanded).toBe('false');
  });
});
