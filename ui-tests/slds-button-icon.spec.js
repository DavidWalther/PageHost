const { test, expect } = require('@playwright/test');

/**
 * Attribut-, Icon- und Klick-Contract-Tests für die Lit-Komponente
 * `slds-button-icon` (stark genutzte, interaktive Komponente).
 *
 * Isolierter Mount — der App-Server liefert `public/` statisch aus, daher ist
 * kein Consumer und kein echtes Backend nötig. Geprüft wird das gerenderte
 * Shadow-DOM, das dem Legacy-Verhalten entspricht: inneres
 * `button.slds-button.slds-button_icon`, Variant-/Size-Klassen, `disabled`,
 * `use`-`xlink:href` + kapitalisierter Assistive-Text, sowie der native
 * Klick-Contract (Klick des inneren Buttons retargetiert auf den Host; bei
 * `disabled` feuert kein Klick).
 */

async function mountButton(page, { attrs = {} } = {}) {
  return page.evaluate(
    async ({ attrs }) => {
      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      document
        .querySelectorAll('slds-button-icon')
        .forEach((el) => el.remove());

      const el = document.createElement('slds-button-icon');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      const root = el.shadowRoot;
      const button = root.querySelector('button');
      const use = root.querySelector('use');
      const assistive = root.querySelector('.slds-assistive-text');

      return {
        hasButton: !!button,
        buttonClass: button ? button.className : null,
        disabled: button ? button.hasAttribute('disabled') : null,
        // href.baseVal ist die vom Browser tatsächlich aufgelöste Sprite-
        // Referenz — im Gegensatz zu getAttribute('xlink:href') fällt hier ein
        // nicht-genamespacetes/nicht-auflösbares href auf (Icon würde fehlen).
        href: use ? use.href.baseVal : null,
        assistive: assistive ? assistive.textContent : null,
      };
    },
    { attrs }
  );
}

// Klickt den inneren <button> und meldet, ob ein am Host registrierter
// nativer 'click'-Listener gefeuert hat.
async function clickInnerButton(page, { attrs = {} } = {}) {
  return page.evaluate(
    async ({ attrs }) => {
      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      document
        .querySelectorAll('slds-button-icon')
        .forEach((el) => el.remove());

      const el = document.createElement('slds-button-icon');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      let fired = 0;
      el.addEventListener('click', () => (fired += 1));
      el.shadowRoot.querySelector('button').click();
      return fired;
    },
    { attrs }
  );
}

test.describe('slds-button-icon', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Default: Basisklassen, Variant-Default container-filled, Icon + Assistive', async ({
    page,
  }) => {
    const res = await mountButton(page, {
      attrs: { icon: 'utility:settings' },
    });
    expect(res.hasButton).toBe(true);
    expect(res.buttonClass).toContain('slds-button');
    expect(res.buttonClass).toContain('slds-button_icon');
    expect(res.buttonClass).toContain('slds-button_icon-border-filled');
    expect(res.href).toBe(
      '/assets/icons/utility-sprite/svg/symbols.svg#settings'
    );
    expect(res.assistive).toBe('Settings');
  });

  test('Variant: container-transparent und icon-only setzen die richtige Klasse', async ({
    page,
  }) => {
    const transparent = await mountButton(page, {
      attrs: { icon: 'utility:rows', variant: 'container-transparent' },
    });
    expect(transparent.buttonClass).toContain('slds-button_icon-border');
    expect(transparent.buttonClass).not.toContain(
      'slds-button_icon-border-filled'
    );

    const iconOnly = await mountButton(page, {
      attrs: { icon: 'utility:rows', variant: 'icon-only' },
    });
    expect(iconOnly.buttonClass).toContain('slds-button_icon-container');
  });

  test('Variant: ungültiger Wert setzt keine Variant-Klasse', async ({
    page,
  }) => {
    const res = await mountButton(page, {
      attrs: { icon: 'utility:rows', variant: 'bogus' },
    });
    expect(res.buttonClass).not.toContain('slds-button_icon-container');
    expect(res.buttonClass).not.toContain('slds-button_icon-border');
    expect(res.buttonClass).not.toContain('slds-button_icon-border-filled');
  });

  test('Size: small setzt die Größenklasse, ungültige Size nicht', async ({
    page,
  }) => {
    const small = await mountButton(page, {
      attrs: { icon: 'utility:rows', size: 'small' },
    });
    expect(small.buttonClass).toContain('slds-button_icon-small');

    const bogus = await mountButton(page, {
      attrs: { icon: 'utility:rows', size: 'bogus' },
    });
    expect(bogus.buttonClass).not.toContain('slds-button_icon-bogus');
    expect(bogus.buttonClass).not.toContain('slds-button_icon-small');
  });

  test('disabled: gesetzt -> button disabled, ohne -> nicht disabled', async ({
    page,
  }) => {
    const on = await mountButton(page, {
      attrs: { icon: 'utility:settings', disabled: true },
    });
    expect(on.disabled).toBe(true);

    const off = await mountButton(page, {
      attrs: { icon: 'utility:settings' },
    });
    expect(off.disabled).toBe(false);
  });

  test('Icon-Parsing: Typ bestimmt Sprite, Name wird kapitalisiert; ohne icon leer', async ({
    page,
  }) => {
    const res = await mountButton(page, { attrs: { icon: 'doctype:image' } });
    expect(res.href).toBe('/assets/icons/doctype-sprite/svg/symbols.svg#image');
    expect(res.assistive).toBe('Image');

    const none = await mountButton(page);
    expect(none.href === '' || none.href === null).toBe(true);
    expect(none.assistive).toBe('');
  });

  test('Klick-Contract: nativer click am Host feuert; disabled feuert nicht', async ({
    page,
  }) => {
    const enabled = await clickInnerButton(page, {
      attrs: { icon: 'utility:settings' },
    });
    expect(enabled).toBe(1);

    const disabled = await clickInnerButton(page, {
      attrs: { icon: 'utility:settings', disabled: true },
    });
    expect(disabled).toBe(0);
  });
});
