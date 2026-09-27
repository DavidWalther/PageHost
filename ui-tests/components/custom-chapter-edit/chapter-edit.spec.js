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
   * Pins a bug as the current state, so it flips once the bug is fixed.
   *
   * `_handleNameChange` reads `event.detail.value || event.target.value`. An
   * emptied field reports `''`, which is falsy, so the fallback wins — and
   * `slds-input` never updates its own `value`, so the fallback is the previous
   * name. An empty name therefore cannot be entered at all, which also puts the
   * validation "Kapitelname ist erforderlich" out of reach: in create mode the
   * name starts as "Neues Kapitel", in edit mode with the stored one.
   */
  test('FEHLVERHALTEN: an emptied name field keeps the previous name', async ({
    page,
  }) => {
    const editor = await mount(page);
    await captureWrites(page);
    await openThroughTrigger(page);

    await editor.locator('#input-text').fill('');
    await editor.locator('#input-text').blur();
    await editor.locator('button', { hasText: 'Speichern' }).click();

    const message = await written(page);
    expect(message).not.toBeNull();
    expect(message.payload.name).toBe(NODE.name);
  });

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
