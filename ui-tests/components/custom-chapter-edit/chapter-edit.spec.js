const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * `custom-chapter-edit` — the node editor in a modal.
 *
 * The component owns the triggering icon button *and* the modal. `chapter-id`
 * decides the mode: set means edit, absent means create. It fetches nothing; the
 * record arrives through attributes.
 *
 * Labels are quoted in German because that is what the component renders. The
 * operator surface fixes no language (doc/coding-conventions.md); these strings
 * are selectors, not assertions about wording.
 */

const NODE = {
  id: '00nd00000000000001',
  parentId: '00nd00000000000000',
  name: 'Chapter one',
  sortNumber: 3,
};

async function mount(page, { scopes = ['edit', 'create'], edit = true } = {}) {
  await page.evaluate(
    async ({ scopes, edit, node }) => {
      if (scopes.length > 0) {
        sessionStorage.setItem(
          'code_exchange_response',
          JSON.stringify({ authenticationResult: { access: { scopes } } })
        );
      } else {
        sessionStorage.removeItem('code_exchange_response');
      }

      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/slds-components/slds-modal/slds-modal.js');
      await import('/slds-components/slds-input/slds-input.js');
      await import('/slds-components/slds-toggle/slds-toggle.js');
      await import('/components/custom-publishing/custom-publishing.js');
      await import('/components/custom-chapter-edit/custom-chapter-edit.js');

      document
        .querySelectorAll('custom-chapter-edit')
        .forEach((el) => el.remove());

      const el = document.createElement('custom-chapter-edit');
      el.setAttribute('story-id', node.parentId);
      if (edit) {
        el.setAttribute('chapter-id', node.id);
        el.setAttribute('name', node.name);
        el.setAttribute('sort-number', String(node.sortNumber));
      }
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { scopes, edit, node: NODE }
  );
  return page.locator('custom-chapter-edit');
}

/** Opens the modal through the trigger, which is what fills the form. */
async function openThroughTrigger(page, icon = 'utility:edit') {
  await page.evaluate(async (icon) => {
    const el = document.querySelector('custom-chapter-edit');
    el.shadowRoot
      .querySelector(`slds-button-icon[icon="${icon}"]`)
      .shadowRoot.querySelector('button')
      .click();
    await el.updateComplete;
  }, icon);
}

/** Captures `create` and `save`, answering the callback as the server would. */
async function captureWrites(page) {
  await page.evaluate(() => {
    window.__written = null;
    const answer = (event) => {
      window.__written = {
        event: event.type,
        object: event.detail.object,
        payload: event.detail.payload,
      };
      event.detail.callback(null, {
        success: true,
        result: { id: '00nd00000000000001', ...event.detail.payload },
      });
    };
    document.body.addEventListener('create', answer);
    document.body.addEventListener('save', answer);
  });
}

const written = (page) => page.evaluate(() => window.__written);

/** Collects the messages of every `toast` the component fires. */
async function captureToasts(page) {
  await page.evaluate(() => {
    window.__toasts = [];
    document.body.addEventListener('toast', (event) => {
      window.__toasts.push(event.detail.message);
    });
  });
}

const toasts = (page) => page.evaluate(() => window.__toasts);

/** Flips the reverse-order switch; its input lives in the toggle's shadow root. */
async function flipReverseSwitch(page) {
  await page.evaluate(async () => {
    const el = document.querySelector('custom-chapter-edit');
    el.shadowRoot
      .querySelector('slds-toggle')
      .shadowRoot.querySelector('input[type="checkbox"]')
      .click();
    await el.updateComplete;
  });
}

test.describe('custom-chapter-edit: triggers', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('the pencil appears with the edit scope', async ({ page }) => {
    const editor = await mount(page, { scopes: ['edit'] });

    await expect(
      editor.locator('slds-button-icon[icon="utility:edit"]')
    ).toHaveCount(1);
  });

  test('no session renders no trigger at all', async ({ page }) => {
    const editor = await mount(page, { scopes: [] });

    await expect(editor.locator('slds-button-icon')).toHaveCount(0);
  });

  test('the edit scope alone does not offer creating', async ({ page }) => {
    const editor = await mount(page, { scopes: ['edit'], edit: false });

    await expect(editor.locator('slds-button-icon')).toHaveCount(0);
  });

  test('the plus appears in create mode with the create scope', async ({
    page,
  }) => {
    const editor = await mount(page, { scopes: ['create'], edit: false });

    await expect(
      editor.locator('slds-button-icon[icon="utility:add"]')
    ).toHaveCount(1);
  });
});

test.describe('custom-chapter-edit: the form', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('the fields start from the attributes', async ({ page }) => {
    const editor = await mount(page);
    await openThroughTrigger(page);

    await expect(editor.locator('#input-text')).toHaveValue(NODE.name);
    await expect(editor.locator('#input-number')).toHaveValue(
      String(NODE.sortNumber)
    );
  });

  test('edit mode offers the publish tab, create mode does not', async ({
    page,
  }) => {
    const editing = await mount(page);
    await openThroughTrigger(page);
    await expect(
      editing.locator('a', { hasText: 'Veröffentlichen' })
    ).toHaveCount(1);

    const creating = await mount(page, { edit: false });
    await openThroughTrigger(page, 'utility:add');
    await expect(
      creating.locator('a', { hasText: 'Veröffentlichen' })
    ).toHaveCount(0);
  });

  /**
   * A node needs a name — unlike a content, which may be saved without one. The
   * refusal has to be **audible**: this used to fail silently, because the
   * handler's `||` fallback restored the previous name and the check never had
   * anything to complain about.
   */
  test('an empty name is refused, and says so', async ({ page }) => {
    const editor = await mount(page);
    await captureWrites(page);
    await captureToasts(page);
    await openThroughTrigger(page);

    await editor.locator('#input-text').fill('');
    await editor.locator('#input-text').blur();
    await editor.locator('button', { hasText: 'Speichern' }).click();

    expect(await written(page)).toBeNull();
    expect(await toasts(page)).toContain('Kapitelname ist erforderlich');
    await expect(editor.locator('.slds-modal')).toHaveCount(1);
  });

  /**
   * `1` is the agreed silent default for the sort number: a number with exactly
   * one sensible smallest value gets an answer, not a complaint. Deliberately
   * different from the name, which is refused out loud.
   */
  for (const entered of ['', '0']) {
    test(`a sort number of "${entered}" becomes 1 without a word`, async ({
      page,
    }) => {
      const editor = await mount(page);
      await captureWrites(page);
      await captureToasts(page);
      await openThroughTrigger(page);

      await editor.locator('#input-number').fill(entered);
      await editor.locator('#input-number').blur();
      await editor.locator('button', { hasText: 'Speichern' }).click();

      const message = await written(page);
      expect(message.payload.sortnumber).toBe(1);
      expect(await toasts(page)).not.toContain(
        'Sortierung muss mindestens 1 sein'
      );
    });
  }

  test('saving sends the node columns', async ({ page }) => {
    const editor = await mount(page);
    await captureWrites(page);
    await openThroughTrigger(page);

    await editor.locator('#input-text').fill('Chapter two');
    await editor.locator('#input-text').blur();
    await editor.locator('button', { hasText: 'Speichern' }).click();

    const message = await written(page);
    expect(message.event).toBe('save');
    expect(message.object).toBe('node');
    expect(message.payload.id).toBe(NODE.id);
    expect(message.payload.name).toBe('Chapter two');
    expect(message.payload.parent_node_id).toBe(NODE.parentId);
  });
});

test.describe('custom-chapter-edit: reverse order', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  /**
   * The switch is the only way to reverse a node's contents. It has to reach the
   * payload — otherwise it flips on screen and the saved value stays put.
   */
  test('the switch reaches the payload', async ({ page }) => {
    const editor = await mount(page);
    await captureWrites(page);
    await openThroughTrigger(page);

    await flipReverseSwitch(page);
    await editor.locator('button', { hasText: 'Speichern' }).click();

    const message = await written(page);
    expect(message.payload.reversed).toBe(true);
  });
});

test.describe('custom-chapter-edit: opened from outside', () => {
  // The navigation modal is the trigger: no button of its own, openCreate()
  // instead. The siblings come in as `chapters` (with their sortnumber).
  const SIBLINGS = [
    { id: 'n-a', name: 'A', sortnumber: 10 },
    { id: 'n-b', name: 'B', sortnumber: 30 },
    { id: 'n-c', name: 'C', sortnumber: 20 },
  ];

  async function mountWithoutTrigger(
    page,
    { scopes = ['create', 'edit'], parentId = 'n-parent' } = {}
  ) {
    await page.evaluate(
      async ({ scopes, parentId, siblings }) => {
        sessionStorage.setItem(
          'code_exchange_response',
          JSON.stringify({ authenticationResult: { access: { scopes } } })
        );
        await import('/slds-components/slds-button-icon/slds-button-icon.js');
        await import('/slds-components/slds-modal/slds-modal.js');
        await import('/slds-components/slds-input/slds-input.js');
        await import('/slds-components/slds-toggle/slds-toggle.js');
        await import('/components/custom-publishing/custom-publishing.js');
        await import('/components/custom-chapter-edit/custom-chapter-edit.js');
        document
          .querySelectorAll('custom-chapter-edit')
          .forEach((el) => el.remove());

        const el = document.createElement('custom-chapter-edit');
        el.setAttribute('no-trigger', '');
        if (parentId) {
          el.setAttribute('story-id', parentId);
        }
        el.chapters = siblings;
        document.body.appendChild(el);
        await el.updateComplete;
      },
      { scopes, parentId, siblings: SIBLINGS }
    );
    return page.locator('custom-chapter-edit');
  }

  const openCreate = (page) =>
    page.evaluate(async () => {
      const el = document.querySelector('custom-chapter-edit');
      el.openCreate();
      await el.updateComplete;
    });

  const modalOpen = (page) =>
    page.locator('custom-chapter-edit slds-modal[open]');

  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('no-trigger renders no button of its own', async ({ page }) => {
    test.fail(true, 'no-trigger does not exist yet (#187)');
    const editor = await mountWithoutTrigger(page);

    await expect(editor.locator('slds-button-icon')).toHaveCount(0);
  });

  test('openCreate opens the dialog with a name and the next sort number', async ({
    page,
  }) => {
    test.fail(true, 'openCreate does not exist yet (#187)');
    const editor = await mountWithoutTrigger(page);

    await openCreate(page);

    await expect(modalOpen(page)).toHaveCount(1);
    await expect(editor.locator('slds-input').first()).toHaveAttribute(
      'value',
      'Neues Kapitel'
    );
    // Highest sortnumber among the siblings (30) plus one.
    await expect(editor.locator('slds-input').nth(1)).toHaveAttribute(
      'value',
      '31'
    );
  });

  test('confirming creates a child of story-id', async ({ page }) => {
    test.fail(true, 'openCreate does not exist yet (#187)');
    const editor = await mountWithoutTrigger(page);
    await captureWrites(page);
    await openCreate(page);

    await editor.locator('button', { hasText: 'Erstellen' }).click();

    const message = await written(page);
    expect(message.event).toBe('create');
    expect(message.object).toBe('node');
    expect(message.payload.parent_node_id).toBe('n-parent');
    expect(message.payload.sortnumber).toBe(31);
  });

  test('without story-id it creates a root', async ({ page }) => {
    test.fail(true, 'openCreate does not exist yet (#187)');
    const editor = await mountWithoutTrigger(page, { parentId: null });
    await captureWrites(page);
    await openCreate(page);

    await editor.locator('button', { hasText: 'Erstellen' }).click();

    expect((await written(page)).payload.parent_node_id).toBeFalsy();
  });

  test('without the create scope openCreate opens nothing', async ({
    page,
  }) => {
    test.fail(true, 'openCreate does not exist yet (#187)');
    await mountWithoutTrigger(page, { scopes: ['edit'] });

    await openCreate(page);

    await expect(
      page.locator('custom-chapter-edit slds-modal')
    ).not.toHaveAttribute('open');
  });
});
