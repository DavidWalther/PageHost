const { test, expect } = require('@playwright/test');

/**
 * Attribut-Effekt-Tests für die Lit-Komponente `slds-progress-bar`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, ein Consumer oder echtes Backend ist nicht nötig. Geprüft wird
 * das gerenderte Shadow-DOM: die ARIA-Rolle samt Wertebereich, das Clamping des
 * `percent`-Werts und die Modifier-Klassen für Größe, Form und Variante.
 */

async function mountProgressBar(page, attrs = {}) {
  return page.evaluate(async (attrs) => {
    await import('/slds-components/slds-progress-bar/slds-progress-bar.js');
    document.querySelectorAll('slds-progress-bar').forEach((el) => el.remove());

    const el = document.createElement('slds-progress-bar');
    for (const [name, value] of Object.entries(attrs)) {
      el.setAttribute(name, value === true ? '' : value);
    }
    document.body.appendChild(el);
    await el.updateComplete;

    const root = el.shadowRoot;
    const bar = root.querySelector('[role="progressbar"]');
    const value = root.querySelector('.slds-progress-bar__value');
    const assistive = root.querySelector('.slds-assistive-text');

    return {
      barClass: bar ? bar.className : null,
      valueClass: value ? value.className : null,
      ariaMin: bar ? bar.getAttribute('aria-valuemin') : null,
      ariaMax: bar ? bar.getAttribute('aria-valuemax') : null,
      ariaNow: bar ? bar.getAttribute('aria-valuenow') : null,
      // Inline-Style: waagerecht wächst der Balken über width, senkrecht über height.
      width: value ? value.style.width : null,
      height: value ? value.style.height : null,
      assistive: assistive ? assistive.textContent.trim() : null,
    };
  }, attrs);
}

test.describe('slds-progress-bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Struktur: progressbar-Rolle mit Wertebereich und Value-Span', async ({
    page,
  }) => {
    const res = await mountProgressBar(page);
    expect(res.barClass).toContain('slds-progress-bar');
    expect(res.valueClass).toContain('slds-progress-bar__value');
    expect(res.ariaMin).toBe('0');
    expect(res.ariaMax).toBe('100');
    expect(res.ariaNow).toBe('0');
  });

  test('percent setzt Breite, ARIA-Wert und Assistive-Text', async ({
    page,
  }) => {
    const res = await mountProgressBar(page, { percent: '60' });
    expect(res.width).toBe('60%');
    expect(res.ariaNow).toBe('60');
    expect(res.assistive).toBe('Progress: 60%');
  });

  test('percent wird nach unten auf 0 geklemmt', async ({ page }) => {
    const res = await mountProgressBar(page, { percent: '-10' });
    expect(res.width).toBe('0%');
    expect(res.ariaNow).toBe('0');
  });

  test('percent wird nach oben auf 100 geklemmt', async ({ page }) => {
    const res = await mountProgressBar(page, { percent: '150' });
    expect(res.width).toBe('100%');
    expect(res.ariaNow).toBe('100');
  });

  test('size: medium (Default) ohne Modifier, small mit Modifier', async ({
    page,
  }) => {
    // `medium` vergibt bewusst keine Klasse: die Basisklasse `.slds-progress-bar`
    // hat bereits `height: 0.5rem` — denselben Wert wie `.slds-progress-bar_medium`.
    const medium = await mountProgressBar(page);
    expect(medium.barClass).not.toContain('slds-progress-bar_medium');

    const small = await mountProgressBar(page, { size: 'small' });
    expect(small.barClass).toContain('slds-progress-bar_small');
  });

  test('circular setzt die Klasse für runde Enden', async ({ page }) => {
    const res = await mountProgressBar(page, { circular: true });
    expect(res.barClass).toContain('slds-progress-bar_circular');
  });

  test('vertical: Klasse gesetzt, Fortschritt wächst über height statt width', async ({
    page,
  }) => {
    const res = await mountProgressBar(page, { vertical: true, percent: '40' });
    expect(res.barClass).toContain('slds-progress-bar_vertical');
    expect(res.height).toBe('40%');
    expect(res.width).toBe('');
  });

  test('variant="success" färbt den gefüllten Teil, base nicht', async ({
    page,
  }) => {
    const success = await mountProgressBar(page, { variant: 'success' });
    expect(success.valueClass).toContain('slds-progress-bar__value_success');

    const base = await mountProgressBar(page);
    expect(base.valueClass).not.toContain('slds-progress-bar__value_success');
  });
});
