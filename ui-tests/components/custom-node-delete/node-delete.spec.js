const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * `custom-node-delete` — the one action that deletes a node.
 *
 * Its own button is one trigger; a host without it (`no-trigger`) calls
 * `requestDelete()`. Before asking, the action loads the node (for its
 * contents) and the content tree (for every node below it) through `query`
 * events. A node with nodes below it needs a second confirmation; declining
 * either one sends nothing.
 *
 * The prompts are operator surface, so their wording is not pinned — only the
 * numbers they must name.
 */

const TREE = [
  {
    id: 'n-root',
    name: 'Root',
    childnodes: [
      { id: 'n-leaf', name: 'Leaf', childnodes: [] },
      { id: 'n-texts', name: 'Leaf with texts', childnodes: [] },
      {
        id: 'n-mid',
        name: 'Middle',
        childnodes: [
          {
            id: 'n-c1',
            name: 'Child 1',
            childnodes: [{ id: 'n-c2', name: 'Child 2', childnodes: [] }],
          },
          { id: 'n-c3', name: 'Child 3', childnodes: [] },
        ],
      },
    ],
  },
];

const NODES = {
  'n-leaf': { id: 'n-leaf', name: 'Leaf', nodes: [], contents: [] },
  'n-texts': {
    id: 'n-texts',
    name: 'Leaf with texts',
    nodes: [],
    contents: [{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }],
  },
  'n-mid': {
    id: 'n-mid',
    name: 'Middle',
    nodes: [{ id: 'n-c1' }, { id: 'n-c3' }],
    contents: [],
  },
};

const ALL_SCOPES = ['read', 'edit', 'create', 'delete'];

/**
 * Signs in (unless `scopes` is empty), opens a blank page, answers the
 * `query` events and mounts the component for `nodeId`.
 */
async function mount(
  page,
  {
    scopes = ALL_SCOPES,
    nodeId = 'n-leaf',
    noTrigger = false,
    queryFails = false,
  } = {}
) {
  if (scopes.length > 0) {
    await withSession(page, scopes);
  }
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ nodeId, noTrigger, queryFails, tree, nodes }) => {
      window.__toasts = [];
      window.__deleted = [];
      document.body.addEventListener('toast', (event) => {
        window.__toasts.push(event.detail.message);
      });
      document.body.addEventListener('node-deleted', (event) => {
        window.__deleted.push(event.detail);
      });
      document.body.addEventListener('query', (event) => {
        const { payload, callback } = event.detail;
        if (queryFails) {
          callback(new Error('offline'), null);
        } else if (payload.object === 'contents') {
          callback(null, tree);
        } else if (payload.object === 'node') {
          callback(null, nodes[payload.id] ?? {});
        }
      });

      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/components/custom-node-delete/custom-node-delete.js');

      const el = document.createElement('custom-node-delete');
      el.setAttribute('node-id', nodeId);
      if (noTrigger) {
        el.setAttribute('no-trigger', '');
      }
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { nodeId, noTrigger, queryFails, tree: TREE, nodes: NODES }
  );
  return page.locator('custom-node-delete');
}

/** Answers the prompts in order (true = OK) and records their messages. */
function answerPrompts(page, answers) {
  const messages = [];
  page.on('dialog', (dialog) => {
    messages.push(dialog.message());
    const accept = answers[messages.length - 1] ?? false;
    return accept ? dialog.accept() : dialog.dismiss();
  });
  return messages;
}

/** Records every delete request; answers it as the server would. */
async function routeDelete(page, { fail = false } = {}) {
  const urls = [];
  await page.route('**/api/1.0/data/delete**', (route) => {
    urls.push(route.request().url());
    return fail
      ? route.fulfill({
          status: 500,
          json: { success: false, error: 'Database down' },
        })
      : route.fulfill({ json: { success: true } });
  });
  return urls;
}

const deleted = (page) => page.evaluate(() => window.__deleted);
const toasts = (page) => page.evaluate(() => window.__toasts);

/** Lets every pending callback and request settle. */
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
}

test.describe('custom-node-delete', () => {
  test.use({ actionTimeout: 5000 });
  // The component does not exist yet.
  test.fail();

  test.describe('trigger', () => {
    test('shows its button with the delete scope', async ({ page }) => {
      const action = await mount(page);

      await expect(action.locator('#button-delete')).toBeVisible();
    });

    test('shows no button without the delete scope', async ({ page }) => {
      const action = await mount(page, { scopes: ['read', 'edit'] });

      await expect(action.locator('#button-delete')).toHaveCount(0);
    });

    test('shows no button with no-trigger', async ({ page }) => {
      const action = await mount(page, { noTrigger: true });

      await expect(action.locator('#button-delete')).toHaveCount(0);
    });

    test('canDelete() follows the delete scope', async ({ page }) => {
      await mount(page, { scopes: ['read', 'edit'], noTrigger: true });

      const allowed = await page.evaluate(() =>
        document.querySelector('custom-node-delete').canDelete()
      );

      expect(allowed).toBe(false);
    });
  });

  test.describe('confirmation', () => {
    test('a leaf without contents: one prompt, then the request', async ({
      page,
    }) => {
      const action = await mount(page);
      const urls = await routeDelete(page);
      const messages = answerPrompts(page, [true]);

      await action.locator('#button-delete').click();

      await expect.poll(() => urls.length).toBe(1);
      expect(urls[0]).toContain('object=node');
      expect(urls[0]).toContain('id=n-leaf');
      expect(messages).toHaveLength(1);
      expect(messages[0]).not.toMatch(/\d/);
    });

    test('a leaf with contents: the prompt names how many', async ({
      page,
    }) => {
      const action = await mount(page, { nodeId: 'n-texts' });
      const urls = await routeDelete(page);
      const messages = answerPrompts(page, [true]);

      await action.locator('#button-delete').click();

      await expect.poll(() => urls.length).toBe(1);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('3');
    });

    test('a node with nodes below: a second prompt names all of them', async ({
      page,
    }) => {
      const action = await mount(page, { nodeId: 'n-mid' });
      const urls = await routeDelete(page);
      const messages = answerPrompts(page, [true, true]);

      await action.locator('#button-delete').click();

      await expect.poll(() => urls.length).toBe(1);
      expect(urls[0]).toContain('id=n-mid');
      expect(messages).toHaveLength(2);
      // n-c1, n-c2 and n-c3 — the grandchild counts too.
      expect(messages[1]).toContain('3');
    });

    test('declining the first prompt sends nothing', async ({ page }) => {
      const action = await mount(page, { nodeId: 'n-mid' });
      const urls = await routeDelete(page);
      const messages = answerPrompts(page, [false]);

      await action.locator('#button-delete').click();
      await expect.poll(() => messages.length).toBe(1);
      await settle(page);

      expect(messages).toHaveLength(1);
      expect(urls).toEqual([]);
      expect(await deleted(page)).toEqual([]);
    });

    test('declining the second prompt sends nothing', async ({ page }) => {
      const action = await mount(page, { nodeId: 'n-mid' });
      const urls = await routeDelete(page);
      const messages = answerPrompts(page, [true, false]);

      await action.locator('#button-delete').click();
      await expect.poll(() => messages.length).toBe(2);
      await settle(page);

      expect(urls).toEqual([]);
      expect(await deleted(page)).toEqual([]);
    });
  });

  test.describe('result', () => {
    test('reports the node and every node below it', async ({ page }) => {
      const action = await mount(page, { nodeId: 'n-mid' });
      await routeDelete(page);
      answerPrompts(page, [true, true]);

      await action.locator('#button-delete').click();

      await expect.poll(() => deleted(page)).toHaveLength(1);
      const [detail] = await deleted(page);
      expect(detail.nodeId).toBe('n-mid');
      expect([...detail.nodeIds].sort()).toEqual(
        ['n-c1', 'n-c2', 'n-c3', 'n-mid'].sort()
      );
      expect(await toasts(page)).toHaveLength(1);
    });

    test('a failed request shows the error and reports nothing', async ({
      page,
    }) => {
      const action = await mount(page);
      await routeDelete(page, { fail: true });
      answerPrompts(page, [true]);

      await action.locator('#button-delete').click();

      await expect.poll(() => toasts(page)).toEqual(['Database down']);
      expect(await deleted(page)).toEqual([]);
    });

    test('without the node or the tree nothing is asked or sent', async ({
      page,
    }) => {
      const action = await mount(page, { queryFails: true });
      const urls = await routeDelete(page);
      const messages = answerPrompts(page, [true, true]);

      await action.locator('#button-delete').click();

      await expect.poll(() => toasts(page)).toHaveLength(1);
      await settle(page);
      expect(messages).toEqual([]);
      expect(urls).toEqual([]);
    });
  });

  test.describe('without its own button', () => {
    test('requestDelete() runs the same action', async ({ page }) => {
      await mount(page, { nodeId: 'n-mid', noTrigger: true });
      const urls = await routeDelete(page);
      const messages = answerPrompts(page, [true, true]);

      await page.evaluate(() =>
        document.querySelector('custom-node-delete').requestDelete()
      );

      await expect.poll(() => urls.length).toBe(1);
      expect(messages).toHaveLength(2);
    });
  });
});
