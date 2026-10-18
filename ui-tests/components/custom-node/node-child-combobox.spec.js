const { test, expect } = require('@playwright/test');
const { MOCK_NODES } = require('../../support/mock-callouts');
const { mountNode, navigatedTo } = require('../../support/node-mount');

/**
 * Choosing a child of `custom-node` through its combobox.
 *
 * `custom-node` renders the `<slds-combobox>` only when a node has more
 * children than `child-buttons_number-max`; below that it shows buttons. This
 * spec keeps the `combobox-select` contract between the combobox and the node
 * covered — it could break without any other spec turning red.
 *
 * Mounted on its own: the page shows its node through `custom-node-view`,
 * whose combobox has its own spec.
 */

const ROOT = MOCK_NODES.wurzel;

const NODE_WITH_MANY_CHILDREN = {
  ...ROOT,
  nodes: [1, 2, 3, 4].map((n) => ({
    id: `000c0000000000000${n}`,
    name: `Mock Chapter ${n}`,
    sortnumber: n,
    parent_node_id: ROOT.id,
  })),
  contents: [],
};

/** The combobox inside the node, or that there is none. */
function readCombobox(node) {
  return node.evaluate((host) => {
    const combobox = host.shadowRoot.querySelector('slds-combobox');
    if (!combobox) return { present: false };
    return {
      present: true,
      optionCount:
        combobox.shadowRoot.querySelectorAll('ul.slds-listbox li').length,
    };
  });
}

test.describe('Node: choosing a child through the combobox', () => {
  test.use({ actionTimeout: 5000 });

  test('more children than buttons bring the combobox', async ({ page }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_MANY_CHILDREN,
      attrs: { 'child-buttons_number-max': 2, 'no-contents': true },
    });

    await expect
      .poll(async () => (await readCombobox(node)).present)
      .toBe(true);
    expect((await readCombobox(node)).optionCount).toBe(4);
  });

  test('up to the limit the children are buttons', async ({ page }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_MANY_CHILDREN,
      attrs: { 'child-buttons_number-max': 4, 'no-contents': true },
    });

    await expect(node.locator('#child-navigation button')).toHaveCount(4);
    expect((await readCombobox(node)).present).toBe(false);
  });

  test('a click on an option selects the child and reports it', async ({
    page,
  }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_MANY_CHILDREN,
      attrs: { 'child-buttons_number-max': 2, 'no-contents': true },
    });
    await expect
      .poll(async () => (await readCombobox(node)).present)
      .toBe(true);

    const result = await node.evaluate(async (host) => {
      const combobox = host.shadowRoot.querySelector('slds-combobox');
      combobox.shadowRoot.querySelector('.slds-combobox').click();
      await combobox.updateComplete;
      combobox.shadowRoot.querySelectorAll('ul.slds-listbox li')[2].click();
      await combobox.updateComplete;
      await host.updateComplete;
      return {
        selectedChild: host.selectedChild,
        inputText: combobox.shadowRoot.querySelector('input').value,
      };
    });

    expect(result.selectedChild).toBe('000c00000000000003');
    expect(result.inputText).toBe('Mock Chapter 3');
    expect(await navigatedTo(page)).toEqual(['000c00000000000003']);
  });
});
