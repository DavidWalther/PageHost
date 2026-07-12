const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('./support/component-page');

/**
 * Struktur- und Slot-Effekt-Tests für die Lit-Komponente `slds-global-header`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, daher ist kein Consumer und kein echtes Backend nötig. Geprüft
 * wird das gerenderte Shadow-DOM, das dem Legacy-Verhalten entspricht: Wurzel
 * `header.slds-global-header_container` → `div.slds-global-header` mit drei
 * `div.slds-global-header__item` (der mittlere zusätzlich
 * `slds-global-header__item_search`) und den drei benannten Slots
 * `logo` / `search` / `actions`, die Light-DOM-Inhalt projizieren.
 */

async function mountHeader(page, { slots = {} } = {}) {
  return page.evaluate(
    async ({ slots }) => {
      await import('/slds-components/slds-global-header/slds-global-header.js');
      document
        .querySelectorAll('slds-global-header')
        .forEach((el) => el.remove());

      const el = document.createElement('slds-global-header');
      for (const [slotName, text] of Object.entries(slots)) {
        const span = document.createElement('span');
        span.setAttribute('slot', slotName);
        span.textContent = text;
        el.appendChild(span);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      const root = el.shadowRoot;
      const items = Array.from(
        root.querySelectorAll('.slds-global-header__item')
      );

      const assigned = {};
      root.querySelectorAll('slot').forEach((s) => {
        const key = s.getAttribute('name') || 'default';
        assigned[key] = s.assignedNodes().map((n) => n.textContent || '');
      });

      return {
        hasContainer: !!root.querySelector(
          'header.slds-global-header_container'
        ),
        hasHeader: !!root.querySelector('.slds-global-header'),
        itemCount: items.length,
        searchItemClass: items.length === 3 ? items[1].className : null,
        hasLogoSlot: !!root.querySelector('slot[name="logo"]'),
        hasSearchSlot: !!root.querySelector('slot[name="search"]'),
        hasActionsSlot: !!root.querySelector('slot[name="actions"]'),
        assigned,
      };
    },
    { slots }
  );
}

test.describe('slds-global-header', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('Struktur: Container, Header, drei Items, drei benannte Slots', async ({
    page,
  }) => {
    const res = await mountHeader(page);
    expect(res.hasContainer).toBe(true);
    expect(res.hasHeader).toBe(true);
    expect(res.itemCount).toBe(3);
    expect(res.searchItemClass).toContain('slds-global-header__item_search');
    expect(res.hasLogoSlot).toBe(true);
    expect(res.hasSearchSlot).toBe(true);
    expect(res.hasActionsSlot).toBe(true);
  });

  test('Slot-Projektion: logo/search/actions', async ({ page }) => {
    const res = await mountHeader(page, {
      slots: { logo: 'Logo', search: 'Suche', actions: 'Aktionen' },
    });
    expect(res.assigned.logo).toContain('Logo');
    expect(res.assigned.search).toContain('Suche');
    expect(res.assigned.actions).toContain('Aktionen');
  });
});
