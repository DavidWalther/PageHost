const { test, expect } = require('@playwright/test');
const { MOCK_NODES } = require('../../support/mock-callouts');
const { mountNode } = require('../../support/node-mount');

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

const ROOT = { ...MOCK_NODES.wurzel, contents: [] };

// Mehr Kinder als child-buttons_number-max (2) -> die Combobox erscheint.
const NODE_WITH_MANY_CHILDREN = {
  ...ROOT,
  nodes: [1, 2, 3, 4].map((n) => ({
    id: `000c0000000000000${n}`,
    name: `Mock Chapter ${n}`,
    sortnumber: n,
    parent_node_id: ROOT.id,
  })),
};

// Mounted on its own (the page shows its node through custom-node-view).
const ATTRS = { 'child-buttons_number-max': 2, 'no-contents': true };

test.describe('Knoten: Aufbau der Kind-Navigation', () => {
  test('Buttons: jedes Element ist so breit wie sein Button plus Gutter', async ({
    page,
  }) => {
    const node = await mountNode(page, { node: ROOT, attrs: ATTRS });
    await expect(node.locator('#child-navigation button')).toHaveCount(2);

    const nav = await readChildNavigation(node);
    expect(nav.items).toHaveLength(2);
    for (const item of nav.items) {
      expect(item.kind).toBe('button');
      expect(
        Math.abs(item.width - (item.contentWidth + GUTTER))
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test('Combobox: ihr Element nimmt die volle Breite ein', async ({ page }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_MANY_CHILDREN,
      attrs: ATTRS,
    });
    await expect(node.locator('#child-navigation slds-combobox')).toHaveCount(
      1
    );

    const nav = await readChildNavigation(node);
    expect(nav.items).toHaveLength(1);
    const [item] = nav.items;
    expect(item.kind).toBe('slds-combobox');
    expect(Math.abs(item.width - nav.width)).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(item.width - (item.contentWidth + GUTTER))
    ).toBeLessThanOrEqual(0.5);
  });
});
