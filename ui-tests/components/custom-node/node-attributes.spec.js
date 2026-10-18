const { test, expect } = require('@playwright/test');
const { MOCK_NODES } = require('../../support/mock-callouts');
const { mountNode } = require('../../support/node-mount');

/**
 * What the attributes of `custom-node` switch.
 *
 * The node stays free of types: the **data** say what a node has (children,
 * contents), the **consumer** says what this instance is for — with
 * attributes, never read from anything else:
 *
 *   rendering (`no-…`, on by default):  no-child-navigation, no-contents
 *   actions   (`can-…`, off by default): can-create-content, can-delete
 *
 * The page once held two instances, a selection above and a node with its
 * contents below; their sets of attributes are the two set-ups here. The
 * page now shows its node through `custom-node-view` and
 * `custom-node-contents`; `custom-node` lives on in the feeds, so it is
 * mounted on its own.
 */

const SESSION_SCOPES = ['read', 'edit', 'create', 'delete'];

/** The selection: a root with its children, no contents. */
const SELECTION = {
  'child-buttons_number-max': 2,
  'no-contents': true,
};

/** A node with its contents, no selection. */
const CONTENTS = {
  'can-create-content': true,
  'can-delete': true,
  'no-child-navigation': true,
};

// A node with children **and** contents — allowed in the type-free model.
// With it, "renders no contents" and "renders no selection" mean something.
const NODE_WITH_BOTH = {
  ...MOCK_NODES.wurzel,
  contents: [
    {
      id: '00cn00000000000090',
      name: 'Content of the root',
      sortnumber: 1,
      published_date: '2022-01-01 00:00:00',
    },
  ],
};

const PLUS = 'slds-button-icon[icon="utility:add"]';

test.describe('Node attributes: actions', () => {
  test.use({ actionTimeout: 5000 });

  test('the selection offers neither create content nor delete', async ({
    page,
  }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_BOTH,
      attrs: SELECTION,
      scopes: SESSION_SCOPES,
    });

    await expect(node.locator('#button-create-content')).toHaveCount(0);
    await expect(node.locator('#button-delete')).toHaveCount(0);
    await expect(node.locator(PLUS)).toHaveCount(0);
  });

  test('the contents offer create content and delete', async ({ page }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_BOTH,
      attrs: CONTENTS,
      scopes: SESSION_SCOPES,
    });

    await expect(node.locator('#button-create-content')).toBeVisible();
    await expect(node.locator('#button-delete')).toBeVisible();
    await expect(node.locator(PLUS)).toHaveCount(1);
  });

  test('edit and share have no attribute: both set-ups keep them', async ({
    page,
  }) => {
    for (const attrs of [SELECTION, CONTENTS]) {
      const node = await mountNode(page, {
        node: NODE_WITH_BOTH,
        attrs,
        scopes: SESSION_SCOPES,
      });
      await expect(node.locator('#node-edit')).toHaveCount(1);
      await expect(node.locator('#button-share')).toHaveCount(1);
    }
  });
});

test.describe('Node attributes: attribute and scope together', () => {
  // The attribute adds to the scope check, it does not replace it.
  test.use({ actionTimeout: 5000 });

  test('without a session the actions are missing despite the attributes', async ({
    page,
  }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_BOTH,
      attrs: CONTENTS,
    });

    await expect(node.locator('#button-create-content')).toHaveCount(0);
    await expect(node.locator('#button-delete')).toHaveCount(0);
    await expect(node.locator(PLUS)).toHaveCount(0);
  });
});

test.describe('Node attributes: rendering', () => {
  test.use({ actionTimeout: 5000 });

  test('no-contents shows the selection, but neither contents nor hint', async ({
    page,
  }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_BOTH,
      attrs: SELECTION,
    });

    await expect(node.locator('#child-navigation')).toHaveCount(1);
    // Although the node has contents, this instance is not for them …
    await expect(node.locator('custom-paragraph')).toHaveCount(0);
    await expect(node.locator('custom-node-contents')).toHaveCount(0);
    // … and "none there" would be a statement it is not entitled to.
    await expect(node.locator('#no-contents')).toHaveCount(0);
  });

  test('no-child-navigation shows the contents, but no selection', async ({
    page,
  }) => {
    const node = await mountNode(page, {
      node: NODE_WITH_BOTH,
      attrs: CONTENTS,
    });

    await expect(node.locator('custom-paragraph')).toHaveCount(1);
    await expect(node.locator('#child-navigation')).toHaveCount(0);
  });
});
