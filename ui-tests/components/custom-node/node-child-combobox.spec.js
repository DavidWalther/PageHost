const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * App-Test für die Auswahl eines Kind-Knotens per Combobox.
 *
 * `custom-node` rendert die `<slds-combobox>` **nur**, wenn ein Knoten mehr
 * Kinder hat als `child-buttons_number-max` (der `bookstore` setzt 2). Die
 * Standard-Mockdaten haben genau 2 Kinder — dieser Pfad wäre sonst von **keinem**
 * Test abgedeckt: Der `combobox-select`-Contract zwischen Komponente und Consumer
 * könnte brechen, ohne dass die Suite rot wird. Genau das sichert dieser Test ab.
 *
 * Vorgänger dieses Specs war `custom-story/story-chapter-combobox.spec.js`; mit
 * der Zusammenführung von Story und Kapitel zu `custom-node` ist er hierher
 * gewandert.
 */

const ROOT = MOCK_NODES.wurzel;

const NODE_WITH_MANY_CHILDREN = {
  ...ROOT,
  nodes: [1, 2, 3, 4].map((n) => ({
    id: `000c0000000000000${n}`,
    legacy_id: `000c0000000000000${n}`,
    name: `Mock Chapter ${n}`,
    description: null,
    sortnumber: n,
    reversed: null,
    parent_node_id: ROOT.id,
    cover_node_id: null,
    published_date: '2022-01-01 00:00:00',
  })),
};

test.describe('Knoten: Auswahl eines Kindes per Combobox', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    // Mehr Kinder als child-buttons_number-max (2) -> die Combobox erscheint.
    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const match =
        id === ROOT.id || id === ROOT.legacy_id
          ? NODE_WITH_MANY_CHILDREN
          : Object.values(MOCK_NODES).find(
              (node) => node.id === id || node.legacy_id === id
            );
      return route.fulfill({ json: match || {} });
    });

    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();
  });

  // Greift auf die Combobox im Shadow-DOM des oberen custom-node zu.
  async function readCombobox(page) {
    return page.evaluate(() => {
      const app = document.querySelector('app-bookstore');
      const node = app.shadowRoot.querySelector(
        'custom-node[data-role="navigation"]'
      );
      const combobox = node?.shadowRoot?.querySelector('slds-combobox');
      if (!combobox) return { present: false };

      const options = [
        ...combobox.shadowRoot.querySelectorAll('ul.slds-listbox li'),
      ];
      return {
        present: true,
        optionCount: options.length,
        selectedChild: node.selectedChild,
      };
    });
  }

  test('bei mehr Kindern als Buttons erscheint die Combobox', async ({
    page,
  }) => {
    await expect
      .poll(async () => (await readCombobox(page)).present)
      .toBe(true);

    const state = await readCombobox(page);
    expect(state.optionCount).toBe(4);
  });

  test('die Schwelle steht im Markup, nicht in der Hydrierung', async ({
    page,
  }) => {
    // Der `bookstore` setzte den Wert früher erst **nach** `applyEntryPoint`
    // per `setAttribute`. Bis dahin war die Schwelle unbekannt, und ein Knoten
    // mit vielen Kindern rendete kurz als Button-Leiste, bevor er auf die
    // Combobox umsprang. Im Template gilt sie ab dem ersten Rendern.
    const attribut = await page.evaluate(() =>
      document
        .querySelector('app-bookstore')
        .shadowRoot.querySelector('custom-node[data-role="navigation"]')
        .getAttribute('child-buttons_number-max')
    );
    expect(attribut).toBe('2');
  });

  test('Options-Klick stellt das Kind im Consumer um', async ({ page }) => {
    await expect
      .poll(async () => (await readCombobox(page)).present)
      .toBe(true);

    const result = await page.evaluate(async () => {
      const app = document.querySelector('app-bookstore');
      const node = app.shadowRoot.querySelector(
        'custom-node[data-role="navigation"]'
      );
      const combobox = node.shadowRoot.querySelector('slds-combobox');

      combobox.shadowRoot.querySelector('.slds-combobox').click();
      await combobox.updateComplete;
      combobox.shadowRoot.querySelectorAll('ul.slds-listbox li')[2].click();
      await combobox.updateComplete;
      await node.updateComplete;

      return {
        selectedChild: node.selectedChild,
        inputText: combobox.shadowRoot.querySelector('input').value,
      };
    });

    // Der Consumer hört auf `combobox-select` — bricht der Event-Name, bleibt
    // selectedChild unverändert und dieser Test schlägt fehl.
    expect(result.selectedChild).toBe('000c00000000000003');
    expect(result.inputText).toBe('Mock Chapter 3');
  });
});
