const { test, expect } = require('@playwright/test');

/**
 * Attribut-Effekt-Tests für die Lit-Komponente `slds-spinner`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, daher ist kein Consumer und kein echtes Backend nötig. Geprüft
 * wird das gerenderte Shadow-DOM, das dem Legacy-Verhalten entspricht: der
 * Spinner steckt immer in einem zentrierten Placeholder, ist immer `brand`, und
 * `container`/`size`/`hidden` wirken wie gehabt.
 */

async function mountSpinner(page, attrs = {}) {
  return page.evaluate(async (attrs) => {
    await import('/slds-components/slds-spinner/slds-spinner.js');
    document.querySelectorAll('slds-spinner').forEach((el) => el.remove());

    const el = document.createElement('slds-spinner');
    for (const [name, value] of Object.entries(attrs)) {
      el.setAttribute(name, value === true ? '' : value);
    }
    document.body.appendChild(el);
    await el.updateComplete;

    const root = el.shadowRoot;
    const spinner = root.querySelector('.slds-spinner');
    return {
      hasCenter: !!root.querySelector('.slds-align_absolute-center'),
      hasContainer: !!root.querySelector('.slds-spinner_container'),
      spinnerClass: spinner ? spinner.className : null,
      hostDisplay: getComputedStyle(el).display,
    };
  }, attrs);
}

test.describe('slds-spinner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Default: zentrierter Placeholder mit brand-Spinner', async ({
    page,
  }) => {
    const res = await mountSpinner(page);
    expect(res.hasCenter).toBe(true);
    expect(res.spinnerClass).toContain('slds-spinner');
    expect(res.spinnerClass).toContain('slds-spinner_brand');
    expect(res.hasContainer).toBe(false);
  });

  test('size="large" setzt die Größenklasse', async ({ page }) => {
    const res = await mountSpinner(page, { size: 'large' });
    expect(res.spinnerClass).toContain('slds-spinner_large');
  });

  test('container ergänzt das Overlay, bleibt zentriert', async ({ page }) => {
    const res = await mountSpinner(page, { container: true });
    expect(res.hasContainer).toBe(true);
    expect(res.hasCenter).toBe(true);
  });

  test('immer brand (kein inverse)', async ({ page }) => {
    const res = await mountSpinner(page);
    expect(res.spinnerClass).not.toContain('slds-spinner_inverse');
  });

  test('hidden blendet den Host aus', async ({ page }) => {
    const res = await mountSpinner(page, { hidden: true });
    expect(res.hostDisplay).toBe('none');
  });
});
