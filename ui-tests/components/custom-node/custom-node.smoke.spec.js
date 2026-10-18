const { test, expect } = require('@playwright/test');
const { MOCK_NODES, MOCK_CONTENT } = require('../../support/mock-callouts');
const { mountNode, navigatedTo } = require('../../support/node-mount');

/**
 * Smoke test of `custom-node`: one node, with its children to choose from
 * and its contents.
 *
 * The page shows its node through `custom-node-view` and
 * `custom-node-contents`; `custom-node` lives on in the feeds. It is mounted
 * on its own here. What its attributes switch is held by
 * `node-attributes.spec.js`.
 */

test.describe('custom-node', () => {
  test.use({ actionTimeout: 5000 });

  test('shows its children to choose from', async ({ page }) => {
    const node = await mountNode(page, {
      node: { ...MOCK_NODES.wurzel, contents: [] },
      attrs: { 'child-buttons_number-max': 2 },
    });

    await expect(node.locator('#child-navigation button')).toHaveText([
      'Mock Chapter 1 for Story 1',
      'Mock Chapter 2 for Story 1',
    ]);
    await expect(node.locator('custom-paragraph')).toHaveCount(0);
  });

  test('shows its contents in their active version', async ({ page }) => {
    // The content endpoint delivers every representation and the pointer to
    // the active one (here `html`). Ignoring the pointer would show the text.
    const node = await mountNode(page, {
      node: MOCK_NODES.kind1,
      contentRecords: { [MOCK_CONTENT.id]: MOCK_CONTENT },
    });

    const paragraph = node.locator('custom-paragraph');
    await expect(paragraph).toHaveCount(1);
    await expect(paragraph.locator('#content p')).toHaveCount(1);
    await expect(paragraph.locator('#content')).toContainText(
      'Lorem ipsum dolor sit amet'
    );
  });

  test('a click on a child reports it', async ({ page }) => {
    const node = await mountNode(page, {
      node: { ...MOCK_NODES.wurzel, contents: [] },
      attrs: { 'child-buttons_number-max': 2 },
    });

    await node.locator('button[data-node-id="000n00000000000002"]').click();

    // The consumer listens for `navigation` with `type: 'node'`.
    expect(await navigatedTo(page)).toEqual(['000n00000000000002']);
    await expect(
      node.locator('button[data-node-id="000n00000000000002"]')
    ).toBeDisabled();
  });
});
