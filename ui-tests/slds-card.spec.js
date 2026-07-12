const { test, expect } = require('@playwright/test');

/**
 * Attribut- und Slot-Effekt-Tests für die Lit-Komponente `slds-card`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, daher ist kein Consumer und kein echtes Backend nötig. Geprüft
 * wird das gerenderte Shadow-DOM, das dem Legacy-Verhalten entspricht: Wurzel
 * `article.slds-card`, Header immer vorhanden, Body im `slds-card__body_inner`,
 * Footer nur ohne `no-footer`, `no-border` setzt die Klasse `no-border`, und die
 * benannten Slots (`header`/`actions`/`footer`) sowie der Default-Slot (Body)
 * projizieren Light-DOM-Inhalt.
 */

async function mountCard(page, { attrs = {}, slots = {} } = {}) {
  return page.evaluate(
    async ({ attrs, slots }) => {
      await import('/slds-components/slds-card/slds-card.js');
      document.querySelectorAll('slds-card').forEach((el) => el.remove());

      const el = document.createElement('slds-card');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      for (const [slotName, text] of Object.entries(slots)) {
        const span = document.createElement('span');
        if (slotName !== 'default') span.setAttribute('slot', slotName);
        span.textContent = text;
        el.appendChild(span);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      const root = el.shadowRoot;
      const article = root.querySelector('article');

      const assigned = {};
      root.querySelectorAll('slot').forEach((s) => {
        const key = s.getAttribute('name') || 'default';
        assigned[key] = s.assignedNodes().map((n) => n.textContent || '');
      });

      return {
        hasArticle: !!article,
        articleClass: article ? article.className : null,
        hasHeaderBlock: !!root.querySelector('.slds-card__header'),
        hasHeaderSlot: !!root.querySelector('slot[name="header"]'),
        hasActionsSlot: !!root.querySelector('slot[name="actions"]'),
        hasBodyInner: !!root.querySelector('.slds-card__body_inner'),
        hasDefaultSlot: !!root.querySelector(
          '.slds-card__body_inner slot:not([name])'
        ),
        hasFooter: !!root.querySelector('.slds-card__footer'),
        // Text, den das Shadow-DOM des Footers selbst beisteuert (ohne den
        // geslotteten Inhalt) — deckt versehentlich mitgerenderte Zeichen auf.
        footerAssistiveText: root.querySelector(
          '.slds-card__footer .slds-assistive-text'
        )
          ? root
              .querySelector('.slds-card__footer .slds-assistive-text')
              .textContent.trim()
          : null,
        assigned,
      };
    },
    { attrs, slots }
  );
}

test.describe('slds-card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Default: article + Header + Body + Footer', async ({ page }) => {
    const res = await mountCard(page);
    expect(res.hasArticle).toBe(true);
    expect(res.articleClass).toContain('slds-card');
    expect(res.hasHeaderBlock).toBe(true);
    expect(res.hasHeaderSlot).toBe(true);
    expect(res.hasActionsSlot).toBe(true);
    expect(res.hasBodyInner).toBe(true);
    expect(res.hasDefaultSlot).toBe(true);
    expect(res.hasFooter).toBe(true);
  });

  test('no-footer entfernt den Footer, Header bleibt', async ({ page }) => {
    const res = await mountCard(page, { attrs: { 'no-footer': true } });
    expect(res.hasFooter).toBe(false);
    expect(res.hasHeaderBlock).toBe(true);
  });

  test('Footer: kein überzähliges Zeichen im Assistive-Text', async ({
    page,
  }) => {
    // Das Markup trug hinter dem footer-Slot ein zweites ">", das als Textknoten
    // im Assistive-Text landete und Screenreadern vorgelesen wurde.
    const res = await mountCard(page);
    expect(res.footerAssistiveText).toBe('');
  });

  test('no-border setzt die Klasse no-border am Article', async ({ page }) => {
    const res = await mountCard(page, { attrs: { 'no-border': true } });
    expect(res.articleClass).toContain('no-border');
  });

  test('no-header entfernt den Header, Body und Footer bleiben', async ({
    page,
  }) => {
    const res = await mountCard(page, { attrs: { 'no-header': true } });
    expect(res.hasHeaderBlock).toBe(false);
    expect(res.hasHeaderSlot).toBe(false);
    expect(res.hasActionsSlot).toBe(false);
    expect(res.hasBodyInner).toBe(true);
    expect(res.hasFooter).toBe(true);
  });

  test('Slot-Projektion: header/actions/footer/default', async ({ page }) => {
    const res = await mountCard(page, {
      slots: {
        header: 'Titel',
        actions: 'Aktion',
        footer: 'Fuß',
        default: 'Inhalt',
      },
    });
    expect(res.assigned.header).toContain('Titel');
    expect(res.assigned.actions).toContain('Aktion');
    expect(res.assigned.footer).toContain('Fuß');
    expect(res.assigned.default).toContain('Inhalt');
  });
});
