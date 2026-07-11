const { test, expect } = require('@playwright/test');

/**
 * Struktur-, Zustands- und Slot-Tests für die Lit-Komponente `slds-panel`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, daher ist kein Consumer und kein echtes Backend nötig. Geprüft
 * wird das gerenderte Shadow-DOM, das dem Legacy-Markup entspricht: docked-left
 * Panel mit Header (`header`-Slot), Body (Default-Slot), Close-Button und einem
 * `.screencover`-Overlay.
 *
 * Zustand (Legacy toggelt diese Klassen, der Port rendert sie aus `_open`):
 *   closed -> `.slds-panel` ohne `slds-is-open`, `.screencover` mit `slds-hide`
 *   open   -> `.slds-panel` mit `slds-is-open`,  `.screencover` mit `slds-show`
 *
 * `slds-panel` hat derzeit keinen Consumer — diese Spec ist die einzige
 * Beschreibung des Contracts.
 */

/**
 * Mountet das Panel, führt optional eine Folge von Aktionen aus und liest den
 * resultierenden Shadow-DOM-Zustand aus.
 *
 * `actions`: 'open' | 'close' | 'click-close' | 'click-screencover'
 */
async function mountPanel(page, { slots = {}, actions = [] } = {}) {
  return page.evaluate(
    async ({ slots, actions }) => {
      await import('/slds-components/slds-panel/slds-panel.js');
      document.querySelectorAll('slds-panel').forEach((el) => el.remove());

      const el = document.createElement('slds-panel');
      for (const [slotName, text] of Object.entries(slots)) {
        const span = document.createElement('span');
        if (slotName !== 'default') span.setAttribute('slot', slotName);
        span.textContent = text;
        el.appendChild(span);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      for (const action of actions) {
        if (action === 'open') el.openPanel();
        if (action === 'close') el.closePanel();
        if (action === 'click-close') {
          el.shadowRoot.querySelector('.slds-panel__close').click();
        }
        if (action === 'click-screencover') {
          el.shadowRoot.querySelector('.screencover').click();
        }
        await el.updateComplete;
      }

      const root = el.shadowRoot;
      const panel = root.querySelector('.slds-panel');
      const screencover = root.querySelector('.screencover');
      const closeButton = root.querySelector('.slds-panel__close');
      const title = root.querySelector('h2.slds-panel__header-title');
      const use = root.querySelector('svg use');
      const assistive = root.querySelector('.slds-assistive-text');

      const assigned = {};
      root.querySelectorAll('slot').forEach((s) => {
        const key = s.getAttribute('name') || 'default';
        assigned[key] = s.assignedNodes().map((n) => n.textContent || '');
      });

      const panelStyle = panel ? getComputedStyle(panel) : null;
      const coverStyle = screencover ? getComputedStyle(screencover) : null;

      return {
        panelCount: root.querySelectorAll('.slds-panel').length,
        panelClass: panel ? panel.className : null,
        screencoverClass: screencover ? screencover.className : null,
        hasHeader: !!root.querySelector('.slds-panel__header'),
        hasBody: !!root.querySelector('.slds-panel__body'),
        titleClass: title ? title.className : null,
        titleAttr: title ? title.getAttribute('title') : null,
        headerSlotInTitle: !!root.querySelector(
          'h2.slds-panel__header-title slot[name="header"]'
        ),
        defaultSlotInBody: !!root.querySelector(
          '.slds-panel__body slot:not([name])'
        ),
        closeButtonClass: closeButton ? closeButton.className : null,
        closeButtonTitle: closeButton
          ? closeButton.getAttribute('title')
          : null,
        // href.baseVal ist die vom Browser tatsächlich aufgelöste Sprite-
        // Referenz — getAttribute('xlink:href') würde auch einen nicht
        // auflösenden Wert liefern (Icon fehlt), baseVal fällt darauf herein.
        href: use ? use.href.baseVal : null,
        assistive: assistive ? assistive.textContent : null,
        assigned,
        panelPosition: panelStyle ? panelStyle.position : null,
        panelZIndex: panelStyle ? panelStyle.zIndex : null,
        panelMaxWidth: panelStyle ? panelStyle.maxWidth : null,
        coverZIndex: coverStyle ? coverStyle.zIndex : null,
      };
    },
    { slots, actions }
  );
}

test.describe('slds-panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Struktur: docked-left Panel mit Header, Body und Close-Button', async ({
    page,
  }) => {
    const res = await mountPanel(page);
    expect(res.panelCount).toBe(1);
    expect(res.panelClass).toContain('slds-size_medium');
    expect(res.panelClass).toContain('slds-panel_docked');
    expect(res.panelClass).toContain('slds-panel_docked-left');
    expect(res.hasHeader).toBe(true);
    expect(res.hasBody).toBe(true);
    expect(res.titleClass).toContain('slds-text-heading_small');
    expect(res.titleClass).toContain('slds-truncate');
    expect(res.titleAttr).toBe('Panel Header');
    expect(res.closeButtonClass).toContain('slds-button_icon-small');
    expect(res.closeButtonTitle).toBe('Collapse Panel Header');
    expect(res.assistive).toBe('Collapse Panel Header');
  });

  test('Icon: use-Referenz löst auf das close-Symbol auf', async ({ page }) => {
    const res = await mountPanel(page);
    expect(res.href).toBe('/assets/icons/utility-sprite/svg/symbols.svg#close');
  });

  test('Initialzustand: Panel geschlossen, Screencover versteckt', async ({
    page,
  }) => {
    const res = await mountPanel(page);
    expect(res.panelClass).not.toContain('slds-is-open');
    expect(res.screencoverClass).toContain('slds-hide');
    expect(res.screencoverClass).not.toContain('slds-show');
  });

  test('openPanel() öffnet das Panel und zeigt den Screencover', async ({
    page,
  }) => {
    const res = await mountPanel(page, { actions: ['open'] });
    expect(res.panelClass).toContain('slds-is-open');
    expect(res.screencoverClass).toContain('slds-show');
    expect(res.screencoverClass).not.toContain('slds-hide');
  });

  test('closePanel() stellt den Ausgangszustand wieder her', async ({
    page,
  }) => {
    const res = await mountPanel(page, { actions: ['open', 'close'] });
    expect(res.panelClass).not.toContain('slds-is-open');
    expect(res.screencoverClass).toContain('slds-hide');
    expect(res.screencoverClass).not.toContain('slds-show');
  });

  test('Klick auf den Close-Button schließt das Panel', async ({ page }) => {
    const res = await mountPanel(page, { actions: ['open', 'click-close'] });
    expect(res.panelClass).not.toContain('slds-is-open');
    expect(res.screencoverClass).toContain('slds-hide');
  });

  test('Klick auf den Screencover schließt das Panel', async ({ page }) => {
    const res = await mountPanel(page, {
      actions: ['open', 'click-screencover'],
    });
    expect(res.panelClass).not.toContain('slds-is-open');
    expect(res.screencoverClass).toContain('slds-hide');
  });

  test('Slot-Projektion: header im Titel, Default-Slot im Body', async ({
    page,
  }) => {
    const res = await mountPanel(page, {
      slots: { header: 'Titel', default: 'Inhalt' },
    });
    expect(res.headerSlotInTitle).toBe(true);
    expect(res.defaultSlotInBody).toBe(true);
    expect(res.assigned.header).toContain('Titel');
    expect(res.assigned.default).toContain('Inhalt');
  });

  test('Layout: Panel und Screencover behalten ihre Positionierung', async ({
    page,
  }) => {
    const res = await mountPanel(page);
    expect(res.panelPosition).toBe('fixed');
    expect(res.panelZIndex).toBe('100');
    expect(res.panelMaxWidth).toBe('400px');
    expect(res.coverZIndex).toBe('90');
  });
});
