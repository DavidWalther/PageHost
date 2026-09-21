const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

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

  test('Layout: gutters-xxx-small und gutters-x-large schalten ihre Klassen', async ({
    page,
  }) => {
    // Beide Stufen stehen in der SLDS-Grid-Doku (2px / 32px); damit deckt
    // slds-layout alle neun dokumentierten Gutter-Stufen ab.
    const xxxSmall = await mountGrid(page, {
      layoutAttrs: { 'gutters-xxx-small': true },
    });
    expect(xxxSmall.layoutClasses).toContain('slds-gutters_xxx-small');

    const xLarge = await mountGrid(page, {
      layoutAttrs: { 'gutters-x-large': true },
    });
    expect(xLarge.layoutClasses).toContain('slds-gutters_x-large');
  });

  test('Layout: Entfernen von gutters-xxx-small und gutters-x-large entfernt die Klassen', async ({
    page,
  }) => {
    await mountGrid(page, {
      layoutAttrs: { 'gutters-xxx-small': true, 'gutters-x-large': true },
    });

    await toggleAttribute(page, 'slds-layout', 'gutters-xxx-small', false);
    const without = await toggleAttribute(
      page,
      'slds-layout',
      'gutters-x-large',
      false
    );
    expect(without).not.toContain('slds-gutters_xxx-small');
    expect(without).not.toContain('slds-gutters_x-large');
    expect(without).toContain('slds-grid');
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

  test('Item: Boolean-Properties sind ohne Attribut false, nicht undefined', async ({
    page,
  }) => {
    // classList.toggle(cls, undefined) schaltet UM, statt abzuschalten. Liest
    // updated() eine Boolean-Property, die selbst nicht geändert wurde, würde
    // `undefined` eine Klasse setzen, wo sie entfernt gehört. Geprüft wird der
    // Typ, nicht nur `falsy` — sonst ginge `undefined` als `false` durch.
    await mountGrid(page);

    const values = await page.evaluate(() => {
      const item = document.querySelector('slds-layout-item');
      return Object.fromEntries(
        [
          'bumpLeft',
          'bumpRight',
          'bumpTop',
          'bumpBottom',
          'alignTop',
          'alignMiddle',
          'alignBottom',
          'growNone',
          'shrinkNone',
        ].map((prop) => [
          prop,
          typeof item[prop] === 'boolean' ? item[prop] : typeof item[prop],
        ])
      );
    });
    expect(values).toEqual({
      bumpLeft: false,
      bumpRight: false,
      bumpTop: false,
      bumpBottom: false,
      alignTop: false,
      alignMiddle: false,
      alignBottom: false,
      growNone: false,
      shrinkNone: false,
    });
  });

  test('Item: grow-none setzt slds-grow-none', async ({ page }) => {
    const res = await mountGrid(page, { itemAttrs: { 'grow-none': true } });
    expect(res.itemClasses).toContain('slds-grow-none');
    expect(res.itemClasses).not.toContain('slds-shrink-none');
  });

  test('Item: shrink-none setzt slds-shrink-none', async ({ page }) => {
    const res = await mountGrid(page, { itemAttrs: { 'shrink-none': true } });
    expect(res.itemClasses).toContain('slds-shrink-none');
    expect(res.itemClasses).not.toContain('slds-grow-none');
  });

  test('Item: grow-none und shrink-none wirken nebeneinander', async ({
    page,
  }) => {
    const res = await mountGrid(page, {
      itemAttrs: { 'grow-none': true, 'shrink-none': true },
    });
    expect(res.itemClasses).toEqual(
      expect.arrayContaining(['slds-col', 'slds-grow-none', 'slds-shrink-none'])
    );
  });

  test('Item: Entfernen von grow-none entfernt die Klasse wieder', async ({
    page,
  }) => {
    await mountGrid(page, { itemAttrs: { 'grow-none': true } });

    const without = await toggleAttribute(
      page,
      'slds-layout-item',
      'grow-none',
      false
    );
    expect(without).not.toContain('slds-grow-none');
    expect(without).toContain('slds-col');

    const again = await toggleAttribute(
      page,
      'slds-layout-item',
      'grow-none',
      true
    );
    expect(again).toContain('slds-grow-none');
  });

  test('Item: eine gültige size unterdrückt grow-none und shrink-none', async ({
    page,
  }) => {
    // slds-size_* setzt flex: none bei jeder Breite und überfährt beide
    // Utilities. Die Klassen wären wirkungslos — also werden sie nicht gesetzt.
    const res = await mountGrid(page, {
      itemAttrs: { size: '1-of-2', 'grow-none': true, 'shrink-none': true },
    });
    expect(res.itemClasses).toContain('slds-size_1-of-2');
    expect(res.itemClasses).not.toContain('slds-grow-none');
    expect(res.itemClasses).not.toContain('slds-shrink-none');
  });

  test('Item: eine Breakpoint-Size unterdrückt grow-none nicht', async ({
    page,
  }) => {
    // slds-medium-size_* setzt flex: none erst ab 48em. Darunter wirkt
    // slds-grow-none weiterhin und darf nicht verschluckt werden.
    const res = await mountGrid(page, {
      itemAttrs: { 'medium-size': '1-of-3', 'grow-none': true },
    });
    expect(res.itemClasses).toEqual(
      expect.arrayContaining(['slds-medium-size_1-of-3', 'slds-grow-none'])
    );
  });

  test('Item: eine ungültige size unterdrückt grow-none nicht', async ({
    page,
  }) => {
    // 1-of-9 erzeugt keine Größenklasse — ohne flex: none wirkt grow-none.
    const res = await mountGrid(page, {
      itemAttrs: { size: '1-of-9', 'grow-none': true },
    });
    expect(res.itemClasses).toEqual(['slds-col', 'slds-grow-none']);
  });

  test('Item: size zur Laufzeit setzen entfernt grow-none und shrink-none', async ({
    page,
  }) => {
    await mountGrid(page, {
      itemAttrs: { 'grow-none': true, 'shrink-none': true },
    });

    const after = await page.evaluate(async () => {
      const item = document.querySelector('slds-layout-item');
      item.setAttribute('size', '1-of-2');
      await item.updateComplete;
      return [...item.classList];
    });
    expect(after).toContain('slds-size_1-of-2');
    expect(after).not.toContain('slds-grow-none');
    expect(after).not.toContain('slds-shrink-none');
  });

  test('Item: size zur Laufzeit entfernen stellt grow-none und shrink-none wieder her', async ({
    page,
  }) => {
    const mounted = await mountGrid(page, {
      itemAttrs: { size: '1-of-2', 'grow-none': true, 'shrink-none': true },
    });
    expect(mounted.itemClasses).not.toContain('slds-grow-none');
    expect(mounted.itemClasses).not.toContain('slds-shrink-none');

    const after = await page.evaluate(async () => {
      const item = document.querySelector('slds-layout-item');
      item.removeAttribute('size');
      await item.updateComplete;
      return [...item.classList];
    });
    expect(after).not.toContain('slds-size_1-of-2');
    expect(after).toContain('slds-grow-none');
    expect(after).toContain('slds-shrink-none');
  });

  test('Item: size-Wechsel ohne grow-none setzt keine grow- oder shrink-Klasse', async ({
    page,
  }) => {
    // Ein size-Wechsel bewertet grow/shrink neu, obwohl deren Properties sich
    // nicht geändert haben. Wären sie undefined statt false, würde
    // classList.toggle(cls, undefined) die Klasse SETZEN statt entfernen.
    await mountGrid(page, { itemAttrs: { size: '1-of-2' } });

    const after = await page.evaluate(async () => {
      const item = document.querySelector('slds-layout-item');
      item.setAttribute('size', '1-of-9');
      await item.updateComplete;
      item.removeAttribute('size');
      await item.updateComplete;
      return [...item.classList];
    });
    expect(after).toEqual(['slds-col']);
  });
});
