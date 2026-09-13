const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Aufbau der Kind-Navigation von `custom-node`.
 *
 * Die Kind-Knoten stehen als Buttons in einem umbrechenden Grid mit
 * `slds-gutters` (12px je Seite). Jedes Element ist genau so breit wie sein
 * Button plus 24px — die Elemente wachsen **nicht**. Ohne diese Regel teilten
 * sie sich die ganze Breite der Karte.
 *
 * Wird die Auswahl zur Combobox (mehr Kinder als `child-buttons_number-max`),
 * nimmt deren Element die volle Breite ein.
 *
 * Die Zusicherungen sind bewusst **strukturneutral**: Sie greifen auf die Kinder
 * von `#child-navigation` und deren Rechtecke zu, nicht auf bestimmte Tags oder
 * Klassen der Grid-Elemente.
 */

// Gutter der Kind-Navigation: slds-gutters, 12px je Seite.
const GUTTER = 24;

const navigationNode = (page) =>
  page.locator('custom-node[data-role="navigation"]');

function readChildNavigation(node) {
  return node.evaluate((host) => {
    const nav = host.shadowRoot.querySelector('#child-navigation');
    return {
      width: nav.getBoundingClientRect().width,
      items: [...nav.children].map((item) => {
        const content = item.querySelector('button, slds-combobox');
        return {
          width: item.getBoundingClientRect().width,
          kind: content ? content.tagName.toLowerCase() : null,
          contentWidth: content ? content.getBoundingClientRect().width : 0,
        };
      }),
    };
  });
}

const ROOT = MOCK_NODES.wurzel;

// Mehr Kinder als child-buttons_number-max (2) -> die Combobox erscheint.
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

test.describe('Knoten: Aufbau der Kind-Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
  });

  test('Buttons: jedes Element ist so breit wie sein Button plus Gutter', async ({
    page,
  }) => {
    await page.goto('/000c00000000000001');
    await expect(
      navigationNode(page).locator('#child-navigation button')
    ).toHaveCount(2);

    const nav = await readChildNavigation(navigationNode(page));
    expect(nav.items).toHaveLength(2);
    for (const item of nav.items) {
      expect(item.kind).toBe('button');
      expect(
        Math.abs(item.width - (item.contentWidth + GUTTER))
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test('Combobox: ihr Element nimmt die volle Breite ein', async ({ page }) => {
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
    await expect(
      navigationNode(page).locator('#child-navigation slds-combobox')
    ).toHaveCount(1);

    const nav = await readChildNavigation(navigationNode(page));
    expect(nav.items).toHaveLength(1);
    const [item] = nav.items;
    expect(item.kind).toBe('slds-combobox');
    expect(Math.abs(item.width - nav.width)).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(item.width - (item.contentWidth + GUTTER))
    ).toBeLessThanOrEqual(0.5);
  });
});
