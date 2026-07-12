const { test, expect } = require('@playwright/test');

/**
 * Struktur-, Attribut- und Event-Tests für die Lit-Komponente `slds-breadcrumbs`.
 *
 * Die Komponente wird isoliert gemountet — der App-Server liefert `public/`
 * statisch aus, ein Consumer oder echtes Backend ist nicht nötig. Die Komponente
 * hat derzeit keinen Consumer; die Tests schreiben deshalb den Contract fest, den
 * die README beschreibt.
 *
 * Wichtig: Die Tests halten das **Ist-Verhalten** fest, auch wo es fehlerhaft ist
 * (siehe den Overflow-Grenzfall unten). Solche Tests beginnen mit `FEHLVERHALTEN`
 * und schlagen um, sobald der Bug behoben wird — dann gehört der Test mit angepasst.
 */

const ITEMS = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'accounts', label: 'Accounts', href: '/accounts' },
  { key: 'contacts', label: 'Contacts', href: '/contacts' },
  { key: 'record', label: 'ACME Corp' },
];

async function mountBreadcrumbs(page, { attrs = {}, items = ITEMS } = {}) {
  return page.evaluate(
    async ({ attrs, items }) => {
      await import('/slds-components/slds-breadcrumbs/slds-breadcrumbs.js');
      document
        .querySelectorAll('slds-breadcrumbs')
        .forEach((el) => el.remove());

      const el = document.createElement('slds-breadcrumbs');
      el.setAttribute('items', JSON.stringify(items));
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;

      const root = el.shadowRoot;
      const nav = root.querySelector('nav');
      const list = root.querySelector('ol');
      const listItems = [...root.querySelectorAll('li')];

      return {
        // Bei card-container ist die Wurzel eine <slds-card>, sonst direkt das <nav>.
        rootTag: root.firstElementChild ? root.firstElementChild.tagName : null,
        navSlot: nav ? nav.getAttribute('slot') : null,
        navRole: nav ? nav.getAttribute('role') : null,
        ariaLabel: nav ? nav.getAttribute('aria-label') : null,
        listClass: list ? list.className : null,
        labels: listItems.map((li) => li.textContent.trim()),
        tags: listItems.map((li) =>
          li.firstElementChild ? li.firstElementChild.tagName : null
        ),
        ariaCurrent: listItems.map((li) => li.getAttribute('aria-current')),
        hrefs: listItems.map((li) => {
          const anchor = li.querySelector('a');
          return anchor ? anchor.getAttribute('href') : null;
        }),
      };
    },
    { attrs, items }
  );
}

async function clickCrumb(page, index) {
  return page.evaluate(async (index) => {
    const el = document.querySelector('slds-breadcrumbs');
    const details = [];
    el.addEventListener('click', (event) => details.push(event.detail));

    const anchors = el.shadowRoot.querySelectorAll('a');
    anchors[index].click();
    await el.updateComplete;
    return details;
  }, index);
}

test.describe('slds-breadcrumbs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Struktur: nav mit ol und einem li je Item', async ({ page }) => {
    const res = await mountBreadcrumbs(page);
    expect(res.rootTag).toBe('NAV');
    expect(res.navRole).toBe('navigation');
    expect(res.listClass).toContain('slds-breadcrumb');
    expect(res.labels).toEqual(['Home', 'Accounts', 'Contacts', 'ACME Corp']);
  });

  test('aria-label: Default "Breadcrumbs", überschreibbar', async ({
    page,
  }) => {
    const defaultLabel = await mountBreadcrumbs(page);
    expect(defaultLabel.ariaLabel).toBe('Breadcrumbs');

    const custom = await mountBreadcrumbs(page, {
      attrs: { 'aria-label': 'Seitennavigation' },
    });
    expect(custom.ariaLabel).toBe('Seitennavigation');
  });

  test('size setzt die Textklasse am ol', async ({ page }) => {
    const medium = await mountBreadcrumbs(page);
    expect(medium.listClass).toContain('slds-text-heading_medium');

    const large = await mountBreadcrumbs(page, { attrs: { size: 'large' } });
    expect(large.listClass).toContain('slds-text-heading_large');
  });

  test('Letztes Item ist ein span mit aria-current="page", die übrigen sind Links', async ({
    page,
  }) => {
    const res = await mountBreadcrumbs(page);
    expect(res.tags).toEqual(['A', 'A', 'A', 'SPAN']);
    expect(res.ariaCurrent).toEqual([null, null, null, 'page']);
    expect(res.hrefs).toEqual(['/', '/accounts', '/contacts', null]);
  });

  test('last-item-as-link rendert auch das letzte Item als Link', async ({
    page,
  }) => {
    const res = await mountBreadcrumbs(page, {
      attrs: { 'last-item-as-link': true },
    });
    expect(res.tags).toEqual(['A', 'A', 'A', 'A']);
    // aria-current bleibt erhalten — der Link markiert weiterhin die aktuelle Seite.
    expect(res.ariaCurrent[3]).toBe('page');
  });

  test('Klick feuert click mit detail { key, label, href, index }', async ({
    page,
  }) => {
    await mountBreadcrumbs(page);
    const details = await clickCrumb(page, 1);
    expect(details).toEqual([
      { key: 'accounts', label: 'Accounts', href: '/accounts', index: 1 },
    ]);
  });

  test('overflow: erstes Item, Ellipse und die letzten zwei bei Limit 3', async ({
    page,
  }) => {
    const res = await mountBreadcrumbs(page, {
      attrs: { overflow: true, overflow_limit: '3' },
    });
    expect(res.labels).toEqual(['Home', '…', 'Contacts', 'ACME Corp']);
  });

  test('overflow bleibt wirkungslos, solange die Item-Zahl das Limit nicht übersteigt', async ({
    page,
  }) => {
    const res = await mountBreadcrumbs(page, {
      attrs: { overflow: true, overflow_limit: '4' },
    });
    expect(res.labels).toEqual(['Home', 'Accounts', 'Contacts', 'ACME Corp']);
  });

  test('FEHLVERHALTEN: overflow_limit="1" dupliziert die Liste', async ({
    page,
  }) => {
    // Kein gewolltes Verhalten, sondern ein festgehaltener Bug: `_visibleItems`
    // rechnet `slice(-(limit - 1))` -> bei limit 1 ist das `slice(-0)`, und -0 ist
    // in JS 0, also `slice(0)` = das ganze Array. Ergebnis: erstes Item, Ellipse,
    // danach nochmals ALLE Items ("Home" taucht doppelt auf).
    // Dieser Test schlägt um, sobald der Guard `limit < 2` nachgerüstet wird —
    // genau das ist beabsichtigt.
    const res = await mountBreadcrumbs(page, {
      attrs: { overflow: true, overflow_limit: '1' },
    });
    expect(res.labels).toEqual([
      'Home',
      '…',
      'Home',
      'Accounts',
      'Contacts',
      'ACME Corp',
    ]);
  });

  test('card-container wickelt die Breadcrumbs in eine slds-card', async ({
    page,
  }) => {
    const res = await mountBreadcrumbs(page, {
      attrs: { 'card-container': true },
    });
    expect(res.rootTag).toBe('SLDS-CARD');
    // Das nav wird in den header-Slot der Karte projiziert.
    expect(res.navSlot).toBe('header');
    expect(res.labels).toEqual(['Home', 'Accounts', 'Contacts', 'ACME Corp']);
  });
});
