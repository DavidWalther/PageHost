const { test, expect } = require('@playwright/test');

/**
 * Struktur- und Attribut-Tests für die Lit-Komponenten `slds-layout` und
 * `slds-layout-item` (SLDS-Grid).
 *
 * Besonderheit gegenüber allen anderen SLDS-Komponenten: Beide rendern über
 * `createRenderRoot() { return this; }` ins **Light DOM**. Es gibt also keinen
 * Shadow Root — die SLDS-Klassen landen direkt am **Host**. Geprüft wird deshalb
 * `el.classList` statt eines Shadow-DOM-Baums.
 *
 * Die Tests halten das **Ist-Verhalten** fest, auch wo es fehlerhaft ist (siehe
 * das tote `<slot>` unten). Solche Tests beginnen mit `FEHLVERHALTEN` und schlagen
 * um, sobald der Bug behoben wird — dann gehört der Test mit angepasst.
 */

async function mountGrid(page, { layoutAttrs = {}, itemAttrs = {} } = {}) {
  return page.evaluate(
    async ({ layoutAttrs, itemAttrs }) => {
      await import('/slds-components/slds-layout/slds-layout.js');
      await import('/slds-components/slds-layout/slds-layout-item.js');
      document.querySelectorAll('slds-layout').forEach((el) => el.remove());

      const layout = document.createElement('slds-layout');
      for (const [name, value] of Object.entries(layoutAttrs)) {
        layout.setAttribute(name, value === true ? '' : value);
      }

      const item = document.createElement('slds-layout-item');
      for (const [name, value] of Object.entries(itemAttrs)) {
        item.setAttribute(name, value === true ? '' : value);
      }
      item.textContent = 'Erste Spalte';

      const second = document.createElement('slds-layout-item');
      second.textContent = 'Zweite Spalte';

      layout.append(item, second);
      document.body.appendChild(layout);
      await layout.updateComplete;
      await item.updateComplete;
      await second.updateComplete;

      return {
        layoutHasShadowRoot: !!layout.shadowRoot,
        itemHasShadowRoot: !!item.shadowRoot,
        layoutClasses: [...layout.classList],
        itemClasses: [...item.classList],
        // Kinder bleiben im Light DOM des Layouts und behalten ihre Reihenfolge.
        childTags: [...layout.children].map((child) => child.tagName),
        childTexts: [...layout.children]
          .filter((child) => child.tagName === 'SLDS-LAYOUT-ITEM')
          .map((child) => child.textContent.trim()),
      };
    },
    { layoutAttrs, itemAttrs }
  );
}

// Setzt bzw. entfernt ein Attribut nach dem Mount und liefert die Klassen danach.
async function toggleAttribute(page, selector, name, present) {
  return page.evaluate(
    async ({ selector, name, present }) => {
      const el = document.querySelector(selector);
      if (present) {
        el.setAttribute(name, '');
      } else {
        el.removeAttribute(name);
      }
      await el.updateComplete;
      return [...el.classList];
    },
    { selector, name, present }
  );
}

test.describe('slds-layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Light DOM: kein Shadow Root, slds-grid und slds-col am Host', async ({
    page,
  }) => {
    const res = await mountGrid(page);
    expect(res.layoutHasShadowRoot).toBe(false);
    expect(res.itemHasShadowRoot).toBe(false);
    expect(res.layoutClasses).toContain('slds-grid');
    expect(res.itemClasses).toContain('slds-col');
  });

  test('Kinder bleiben im Light DOM und behalten ihre Reihenfolge', async ({
    page,
  }) => {
    const res = await mountGrid(page);
    expect(res.childTexts).toEqual(['Erste Spalte', 'Zweite Spalte']);
  });

  test('FEHLVERHALTEN: ein totes slot-Element wird angehängt', async ({
    page,
  }) => {
    // Beide Komponenten rendern `html`<slot></slot>`` in ihren eigenen Light DOM.
    // Ein <slot> projiziert aber nur INNERHALB eines Shadow Roots — hier hat es
    // keinerlei Funktion und bleibt als leeres Element im Baum zurück.
    // Dieser Test schlägt um, sobald render() auf `nothing` umgestellt wird —
    // genau das ist beabsichtigt.
    const res = await mountGrid(page);
    expect(res.childTags).toEqual([
      'SLDS-LAYOUT-ITEM',
      'SLDS-LAYOUT-ITEM',
      'SLOT',
    ]);
  });

  test('Layout-Attribute schalten die passenden SLDS-Klassen', async ({
    page,
  }) => {
    const res = await mountGrid(page, {
      layoutAttrs: {
        wrap: true,
        'gutters-small': true,
        'align-spread': true,
        vertical: true,
        'reverse-vertical': true,
      },
    });
    expect(res.layoutClasses).toEqual(
      expect.arrayContaining([
        'slds-grid',
        'slds-wrap',
        'slds-gutters_small',
        'slds-grid_align-spread',
        'slds-grid_vertical',
        'slds-grid_vertical-reverse',
      ])
    );
  });

  test('Layout: Entfernen des Attributs entfernt die Klasse wieder', async ({
    page,
  }) => {
    await mountGrid(page, { layoutAttrs: { wrap: true } });

    const without = await toggleAttribute(page, 'slds-layout', 'wrap', false);
    expect(without).not.toContain('slds-wrap');
    expect(without).toContain('slds-grid');

    const again = await toggleAttribute(page, 'slds-layout', 'wrap', true);
    expect(again).toContain('slds-wrap');
  });

  test('Item: Größen-, Bump- und Align-Attribute schalten die passenden Klassen', async ({
    page,
  }) => {
    const res = await mountGrid(page, {
      itemAttrs: {
        'size-1-of-2': true,
        'medium-size-1-of-3': true,
        'bump-right': true,
        'align-middle': true,
      },
    });
    expect(res.itemClasses).toEqual(
      expect.arrayContaining([
        'slds-col',
        'slds-size_1-of-2',
        'slds-medium-size_1-of-3',
        'slds-col_bump-right',
        'slds-align-middle',
      ])
    );
  });

  test('Item: Entfernen des Größen-Attributs entfernt die Klasse wieder', async ({
    page,
  }) => {
    await mountGrid(page, { itemAttrs: { 'size-1-of-2': true } });

    const without = await toggleAttribute(
      page,
      'slds-layout-item',
      'size-1-of-2',
      false
    );
    expect(without).not.toContain('slds-size_1-of-2');
    expect(without).toContain('slds-col');
  });
});
