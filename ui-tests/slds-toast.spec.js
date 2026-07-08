const { test, expect } = require('@playwright/test');

/**
 * Attribut- und Slot-Effekt-Tests für die Lit-Komponente `slds-toast`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, daher ist kein Consumer und kein echtes Backend nötig. Geprüft
 * wird das gerenderte Shadow-DOM, das dem Legacy-Verhalten entspricht: Theme-
 * Klasse `slds-theme_<state>`, Icon `#<state>`, Assistive-Text = State,
 * `slds-icon-utility-<state>`; ungültiger/fehlender State fällt auf `info`
 * zurück; die Nachricht steckt im Default-Slot.
 */

async function mountToast(page, { attrs = {}, message } = {}) {
  return page.evaluate(
    async ({ attrs, message }) => {
      await import('/slds-components/slds-toast/slds-toast.js');
      document.querySelectorAll('slds-toast').forEach((el) => el.remove());

      const el = document.createElement('slds-toast');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      if (message !== undefined) el.textContent = message;
      document.body.appendChild(el);
      await el.updateComplete;

      const root = el.shadowRoot;
      const notify = root.querySelector('.slds-notify');
      const use = root.querySelector('svg use');
      const assistive = root.querySelector('.slds-assistive-text');
      const iconContainer = root.querySelector('.slds-icon_container');
      const slot = root.querySelector('slot');

      return {
        notifyClass: notify ? notify.className : null,
        role: notify ? notify.getAttribute('role') : null,
        href: use ? use.getAttribute('xlink:href') : null,
        assistive: assistive ? assistive.textContent : null,
        iconContainerClass: iconContainer ? iconContainer.className : null,
        slotAssigned: slot
          ? slot.assignedNodes().map((n) => n.textContent)
          : [],
      };
    },
    { attrs, message }
  );
}

test.describe('slds-toast', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Default: info-Theme, Icon, Assistive-Text', async ({ page }) => {
    const res = await mountToast(page);
    expect(res.notifyClass).toContain('slds-notify_toast');
    expect(res.notifyClass).toContain('slds-theme_info');
    expect(res.role).toBe('status');
    expect(res.href).toContain('#info');
    expect(res.href).toContain('utility-sprite');
    expect(res.assistive).toBe('info');
    expect(res.iconContainerClass).toContain('slds-icon-utility-info');
  });

  test('state="error" setzt Theme, Icon und Assistive-Text', async ({
    page,
  }) => {
    const res = await mountToast(page, { attrs: { state: 'error' } });
    expect(res.notifyClass).toContain('slds-theme_error');
    expect(res.href).toContain('#error');
    expect(res.assistive).toBe('error');
    expect(res.iconContainerClass).toContain('slds-icon-utility-error');
  });

  test('ungültiger State fällt auf info zurück', async ({ page }) => {
    const res = await mountToast(page, { attrs: { state: 'bogus' } });
    expect(res.notifyClass).toContain('slds-theme_info');
    expect(res.href).toContain('#info');
    expect(res.assistive).toBe('info');
  });

  test('Nachricht landet im Default-Slot', async ({ page }) => {
    const res = await mountToast(page, { message: 'Gespeichert' });
    expect(res.slotAssigned).toContain('Gespeichert');
  });
});
