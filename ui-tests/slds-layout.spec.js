const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('./support/component-page');

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
    await gotoComponentPage(page);
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

  test('kein totes slot-Element im Light DOM', async ({ page }) => {
    // Früher rendeten beide Komponenten ein <slot> in ihren eigenen Light DOM.
    // Ein <slot> projiziert nur INNERHALB eines Shadow Roots — dort war es
    // funktionslos und blieb als leeres Element im Baum zurück.
    const res = await mountGrid(page);
    expect(res.childTags).toEqual(['SLDS-LAYOUT-ITEM', 'SLDS-LAYOUT-ITEM']);
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
        size: '1-of-2',
        'medium-size': '1-of-3',
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

  test('Item: alle vier Breakpoints wirken nebeneinander', async ({ page }) => {
    const res = await mountGrid(page, {
      itemAttrs: {
        size: '1-of-1',
        'small-size': '1-of-2',
        'medium-size': '1-of-3',
        'large-size': '1-of-4',
      },
    });
    expect(res.itemClasses).toEqual(
      expect.arrayContaining([
        'slds-size_1-of-1',
        'slds-small-size_1-of-2',
        'slds-medium-size_1-of-3',
        'slds-large-size_1-of-4',
      ])
    );
  });

  test('Item: Siebtel werden unterstützt (SLDS kennt sie, die Komponente bisher nicht)', async ({
    page,
  }) => {
    const res = await mountGrid(page, { itemAttrs: { size: '3-of-7' } });
    expect(res.itemClasses).toContain('slds-size_3-of-7');
  });

  test('Item: unbekannter Bruchteil erzeugt keine Größenklasse', async ({
    page,
  }) => {
    // SLDS kennt keinen Nenner 9 — ein Tippfehler darf keine wirkungslose Klasse
    // erzeugen, die still nichts tut.
    const res = await mountGrid(page, { itemAttrs: { size: '1-of-9' } });
    expect(res.itemClasses).toEqual(['slds-col']);
  });

  test('Item: Größenwechsel ersetzt die Klasse, statt sie zu akkumulieren', async ({
    page,
  }) => {
    await mountGrid(page, { itemAttrs: { size: '1-of-2' } });

    const after = await page.evaluate(async () => {
      const item = document.querySelector('slds-layout-item');
      item.setAttribute('size', '3-of-4');
      await item.updateComplete;
      return [...item.classList];
    });
    expect(after).toContain('slds-size_3-of-4');
    expect(after).not.toContain('slds-size_1-of-2');
  });

  test('Item: Entfernen des Größen-Attributs entfernt die Klasse wieder', async ({
    page,
  }) => {
    await mountGrid(page, { itemAttrs: { size: '1-of-2' } });

    const without = await page.evaluate(async () => {
      const item = document.querySelector('slds-layout-item');
      item.removeAttribute('size');
      await item.updateComplete;
      return [...item.classList];
    });
    expect(without).not.toContain('slds-size_1-of-2');
    expect(without).toContain('slds-col');
  });

  test('Item: eine consumer-eigene Klasse am Host überlebt einen Größenwechsel', async ({
    page,
  }) => {
    // Light DOM: die classList gehört der Komponente nicht allein. bookstore und
    // custom-navigation-modal setzen dort eigene Klassen (slds-m-bottom--medium,
    // slds-p-vertical_x-small) — die dürfen nicht mit aufgeräumt werden.
    await mountGrid(page, { itemAttrs: { size: '1-of-2' } });

    const after = await page.evaluate(async () => {
      const item = document.querySelector('slds-layout-item');
      item.classList.add('slds-m-bottom--medium');
      item.setAttribute('size', '3-of-4');
      await item.updateComplete;
      return [...item.classList];
    });
    expect(after).toContain('slds-m-bottom--medium');
    expect(after).toContain('slds-size_3-of-4');
  });
});
