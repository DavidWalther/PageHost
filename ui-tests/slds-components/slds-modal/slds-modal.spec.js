const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * Tests für die Lit-Komponente `slds-modal`.
 *
 * Schwerpunkt ist der Icon-Contract: Das Close-Icon wird per Sprite-Referenz
 * eingebunden und muss **auflösen**. Geprüft wird deshalb `use.href.baseVal`
 * (die vom Browser aufgelöste Referenz) und nicht das rohe Attribut — siehe
 * `doc/conventions.md`, Abschnitt „SVG-Icons: `href` statt `xlink:href`".
 * Dazu der Grundvertrag: geschlossen rendert die Komponente nichts, offen
 * Dialog + Backdrop, und die Schließpfade feuern `close`.
 */

async function mountModal(page, { attrs = {}, action } = {}) {
  return page.evaluate(
    async ({ attrs, action }) => {
      await import('/slds-components/slds-modal/slds-modal.js');
      document.querySelectorAll('slds-modal').forEach((el) => el.remove());

      const el = document.createElement('slds-modal');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      let closeEvents = 0;
      el.addEventListener('close', () => (closeEvents += 1));

      if (action === 'click-close') {
        el.shadowRoot.querySelector('.slds-modal__close').click();
      } else if (action === 'click-backdrop') {
        el.shadowRoot.querySelector('.slds-backdrop').click();
      } else if (action === 'escape') {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
      }
      await el.updateComplete;

      const root = el.shadowRoot;
      const use = root.querySelector('svg use');

      return {
        open: el.open,
        closeEvents,
        hasDialog: !!root.querySelector('section.slds-modal'),
        hasBackdrop: !!root.querySelector('.slds-backdrop'),
        hasCloseButton: !!root.querySelector('.slds-modal__close'),
        hasHeader: !!root.querySelector('.slds-modal__header'),
        hasFooter: !!root.querySelector('.slds-modal__footer'),
        heading: root.querySelector('.slds-modal__title')
          ? root.querySelector('.slds-modal__title').textContent.trim()
          : null,
        // Das native title-Attribut am Host -> Browser-Tooltip. Muss leer bleiben.
        hostTitle: el.title,
        // Aufgelöste Sprite-Referenz — deckt auf, wenn das Icon nicht auflöst.
        iconHref: use ? use.href.baseVal : null,
        assistive: root.querySelector('.slds-assistive-text')
          ? root.querySelector('.slds-assistive-text').textContent.trim()
          : null,
      };
    },
    { attrs, action }
  );
}

test.describe('slds-modal', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('geschlossen: rendert nichts', async ({ page }) => {
    const res = await mountModal(page);
    expect(res.open).toBe(false);
    expect(res.hasDialog).toBe(false);
    expect(res.hasBackdrop).toBe(false);
  });

  test('open: rendert Dialog, Backdrop und Close-Button', async ({ page }) => {
    const res = await mountModal(page, { attrs: { open: true } });
    expect(res.hasDialog).toBe(true);
    expect(res.hasBackdrop).toBe(true);
    expect(res.hasCloseButton).toBe(true);
    expect(res.assistive).toBe('Cancel & Close');
  });

  test('Close-Icon: use-Referenz löst auf das close-Symbol auf', async ({
    page,
  }) => {
    const res = await mountModal(page, { attrs: { open: true } });
    expect(res.iconHref).toBe(
      '/assets/icons/utility-sprite/svg/symbols.svg#close'
    );
  });

  test('heading wird im Header gerendert, headless entfernt ihn', async ({
    page,
  }) => {
    const withHeader = await mountModal(page, {
      attrs: { open: true, heading: 'Kapitel bearbeiten' },
    });
    expect(withHeader.hasHeader).toBe(true);
    expect(withHeader.heading).toBe('Kapitel bearbeiten');
    // Die Property hiess frueher `title` und ueberschattete damit das globale
    // HTML-Attribut: der Host bekam zusaetzlich einen Browser-Tooltip.
    expect(withHeader.hostTitle).toBe('');

    const headless = await mountModal(page, {
      attrs: { open: true, headless: true },
    });
    expect(headless.hasHeader).toBe(false);
  });

  test('footless entfernt den Footer', async ({ page }) => {
    const withFooter = await mountModal(page, { attrs: { open: true } });
    expect(withFooter.hasFooter).toBe(true);

    const footless = await mountModal(page, {
      attrs: { open: true, footless: true },
    });
    expect(footless.hasFooter).toBe(false);
  });

  test('Close-Button schließt und feuert close', async ({ page }) => {
    const res = await mountModal(page, {
      attrs: { open: true },
      action: 'click-close',
    });
    expect(res.open).toBe(false);
    expect(res.closeEvents).toBe(1);
    expect(res.hasDialog).toBe(false);
  });

  test('Backdrop-Klick schließt und feuert close', async ({ page }) => {
    const res = await mountModal(page, {
      attrs: { open: true },
      action: 'click-backdrop',
    });
    expect(res.open).toBe(false);
    expect(res.closeEvents).toBe(1);
  });

  test('Escape schließt und feuert close', async ({ page }) => {
    const res = await mountModal(page, {
      attrs: { open: true },
      action: 'escape',
    });
    expect(res.open).toBe(false);
    expect(res.closeEvents).toBe(1);
  });

  // --- Fokus-Verwaltung -----------------------------------------------------
  //
  // Der Inhalt des Dialogs kommt als geslottetes Light DOM. Der Trap suchte die
  // fokussierbaren Elemente früher ausschließlich im Shadow-DOM, fand dort nur ein
  // <slot> — und griff deshalb nie. Diese Tests drücken echte Tasten, weil eine
  // reine DOM-Prüfung das nicht belegen würde.

  // Mountet ein offenes Modal mit zwei fokussierbaren Elementen im Default-Slot.
  async function mountOpenModalWithButtons(page) {
    await page.evaluate(async () => {
      await import('/slds-components/slds-modal/slds-modal.js');
      document.querySelectorAll('slds-modal').forEach((el) => el.remove());
      document.querySelectorAll('#outside').forEach((el) => el.remove());

      const outside = document.createElement('button');
      outside.id = 'outside';
      outside.textContent = 'Außerhalb';
      document.body.appendChild(outside);
      outside.focus();

      const el = document.createElement('slds-modal');
      el.innerHTML = `
        <button id="first-in-body">Erster</button>
        <button id="last-in-body">Zweiter</button>
      `;
      document.body.appendChild(el);
      await el.updateComplete;

      el.open = true;
      await el.updateComplete;
    });
  }

  // Kennung des fokussierten Elements. `document.activeElement` retargetet: liegt
  // der Fokus in einem Shadow Root, meldet es nur dessen äußersten Host — deshalb
  // bis zum echten Element absteigen.
  async function focusedId(page) {
    return page.evaluate(() => {
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) {
        active = active.shadowRoot.activeElement;
      }
      if (!active) return null;
      if (active.classList.contains('slds-modal__close')) return 'close-button';
      return active.id || active.tagName.toLowerCase();
    });
  }

  test('Fokus wandert beim Öffnen in den Dialog', async ({ page }) => {
    await mountOpenModalWithButtons(page);
    // Erstes fokussierbares Element ist der Close-Button des Shadow-DOM.
    expect(await focusedId(page)).toBe('close-button');
  });

  test('Tab am letzten Element springt zurück zum ersten', async ({ page }) => {
    await mountOpenModalWithButtons(page);
    await page.evaluate(() => document.querySelector('#last-in-body').focus());
    expect(await focusedId(page)).toBe('last-in-body');

    await page.keyboard.press('Tab');
    expect(await focusedId(page)).toBe('close-button');
  });

  test('Shift+Tab am ersten Element springt zum letzten', async ({ page }) => {
    await mountOpenModalWithButtons(page);
    expect(await focusedId(page)).toBe('close-button');

    await page.keyboard.press('Shift+Tab');
    expect(await focusedId(page)).toBe('last-in-body');
  });

  test('Body-Scroll: erst das letzte offene Modal gibt ihn frei und stellt den Ausgangswert her', async ({
    page,
  }) => {
    // Früher setzte jedes Modal beim Schließen pauschal overflow = '' — das erste
    // Schließen gab den Scroll also frei, obwohl noch ein Modal offen war, und
    // überschrieb dabei einen zuvor gesetzten eigenen Wert.
    const res = await page.evaluate(async () => {
      await import('/slds-components/slds-modal/slds-modal.js');
      document.querySelectorAll('slds-modal').forEach((el) => el.remove());
      document.body.style.overflow = 'scroll'; // Ausgangswert der Seite

      const first = document.createElement('slds-modal');
      const second = document.createElement('slds-modal');
      document.body.append(first, second);
      await first.updateComplete;
      await second.updateComplete;

      first.show();
      await first.updateComplete;
      const afterFirstOpen = document.body.style.overflow;

      second.show();
      await second.updateComplete;

      first.hide();
      await first.updateComplete;
      const afterFirstClose = document.body.style.overflow;

      second.hide();
      await second.updateComplete;
      const afterSecondClose = document.body.style.overflow;

      document.body.style.overflow = '';
      return { afterFirstOpen, afterFirstClose, afterSecondClose };
    });

    expect(res.afterFirstOpen).toBe('hidden');
    // Ein Modal ist noch offen -> Scroll bleibt gesperrt.
    expect(res.afterFirstClose).toBe('hidden');
    // Jetzt ist keines mehr offen -> der Ausgangswert der Seite kehrt zurück.
    expect(res.afterSecondClose).toBe('scroll');
  });

  test('Fokus-Trap hält auch, wenn das Modal in einem fremden Shadow Root steckt', async ({
    page,
  }) => {
    // Genau der Fall aller vier Consumer: custom-navigation-modal & Co. wickeln das
    // slds-modal ein, sein Slot-Inhalt liegt also im Shadow Root eines ANDEREN
    // Elements. `document.activeElement` meldet dann nur den äußersten Host — wer
    // damit vergleicht, findet das fokussierte Element nie und lässt Tab entkommen.
    await page.evaluate(async () => {
      await import('/slds-components/slds-modal/slds-modal.js');
      document.querySelectorAll('modal-wrapper').forEach((el) => el.remove());

      if (!customElements.get('modal-wrapper')) {
        customElements.define(
          'modal-wrapper',
          class extends HTMLElement {
            constructor() {
              super();
              this.attachShadow({ mode: 'open' });
            }
          }
        );
      }

      const wrapper = document.createElement('modal-wrapper');
      document.body.appendChild(wrapper);
      wrapper.shadowRoot.innerHTML = `
        <slds-modal>
          <button id="first-in-body">Erster</button>
          <button id="last-in-body">Zweiter</button>
        </slds-modal>
      `;

      const modal = wrapper.shadowRoot.querySelector('slds-modal');
      await modal.updateComplete;
      modal.open = true;
      await modal.updateComplete;
    });

    const deepFocusedId = () =>
      page.evaluate(() => {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) {
          active = active.shadowRoot.activeElement;
        }
        if (active?.classList.contains('slds-modal__close')) {
          return 'close-button';
        }
        return active?.id ?? active?.tagName.toLowerCase() ?? null;
      });

    expect(await deepFocusedId()).toBe('close-button');

    // Durchtabben: der Fokus darf den Dialog nie verlassen.
    const trail = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      trail.push(await deepFocusedId());
    }
    // Erwartet: zyklisch über die drei fokussierbaren Elemente, nichts von außen.
    expect(trail).toEqual([
      'first-in-body',
      'last-in-body',
      'close-button',
      'first-in-body',
      'last-in-body',
      'close-button',
    ]);
  });

  test('Schließen gibt den Fokus an den Auslöser zurück', async ({ page }) => {
    await mountOpenModalWithButtons(page);
    await page.evaluate(async () => {
      const modal = document.querySelector('slds-modal');
      modal.hide();
      await modal.updateComplete;
    });
    expect(await focusedId(page)).toBe('outside');
  });
});
