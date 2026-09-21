const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * `custom-content-publish` — das Veröffentlichen eines Inhalts, in einem eigenen
 * Modal.
 *
 * Bewusst **dünn** und bewusst **getrennt** vom Editor: Später tritt eine
 * einheitliche Komponente an ihre Stelle, die Inhalte *und Listen von Inhalten*
 * veröffentlicht. Bis dahin hält sie nichts als einen Auslöser, ein Modal und
 * `custom-publishing`.
 *
 * Der Auslöser folgt derselben Regel wie der Schalter darin: Er verlangt
 * **beide** Scopes, `publish` und `edit`. Ohne sie öffnete sich sonst ein Modal,
 * dessen Schalter still deaktiviert ist.
 */

async function mount(page, { scopes = ['publish', 'edit'], attrs = {} } = {}) {
  await page.evaluate(
    async ({ scopes, attrs }) => {
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
      await import('/slds-components/slds-toggle/slds-toggle.js');
      await import('/components/custom-content-publish/custom-content-publish.js');

      document
        .querySelectorAll('custom-content-publish')
        .forEach((el) => el.remove());

      const el = document.createElement('custom-content-publish');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { scopes, attrs }
  );
  return page.locator('custom-content-publish');
}

async function open(page) {
  await page.evaluate(async () => {
    const el = document.querySelector('custom-content-publish');
    el.show();
    await el.updateComplete;
  });
}

const ATTRS = {
  'record-id': '00cn00000000000001',
  'publish-date': '2022-01-01 00:00:00',
};

test.describe('custom-content-publish', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('beide Scopes zeigen den Auslöser', async ({ page }) => {
    const component = await mount(page, { attrs: ATTRS });

    const trigger = component.locator('slds-button-icon');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('icon', 'utility:upload');
  });

  test('ohne Scope "publish" gibt es keinen Auslöser', async ({ page }) => {
    const component = await mount(page, { scopes: ['edit'], attrs: ATTRS });

    await expect(component.locator('slds-button-icon')).toHaveCount(0);
  });

  test('ohne Scope "edit" gibt es keinen Auslöser', async ({ page }) => {
    const component = await mount(page, { scopes: ['publish'], attrs: ATTRS });

    await expect(component.locator('slds-button-icon')).toHaveCount(0);
  });

  test('ohne Sitzung gibt es keinen Auslöser', async ({ page }) => {
    const component = await mount(page, { scopes: [], attrs: ATTRS });

    await expect(component.locator('slds-button-icon')).toHaveCount(0);
  });

  test('das Modal hält custom-publishing und keinen Footer', async ({
    page,
  }) => {
    const component = await mount(page, { attrs: ATTRS });
    await open(page);

    const modal = component.locator('slds-modal');
    await expect(modal).toHaveAttribute('open', '');
    await expect(modal).toHaveAttribute('footless', '');

    const publishing = component.locator('custom-publishing');
    await expect(publishing).toHaveAttribute('object-name', 'content');
    await expect(publishing).toHaveAttribute('record-id', '00cn00000000000001');
    await expect(publishing).toHaveAttribute(
      'publish-date',
      '2022-01-01 00:00:00'
    );
  });

  test('der Klick auf den Auslöser öffnet das Modal', async ({ page }) => {
    const component = await mount(page, { attrs: ATTRS });

    await component.locator('slds-button-icon').click();

    await expect(component.locator('slds-modal')).toHaveAttribute('open', '');
  });

  test('published verlässt die Komponente, damit der Absatz nachlädt', async ({
    page,
  }) => {
    await mount(page, { attrs: ATTRS });
    await open(page);

    const seen = await page.evaluate(async () => {
      const received = [];
      document.body.addEventListener('published', (event) =>
        received.push(event.detail.recordId)
      );
      const publishing = document
        .querySelector('custom-content-publish')
        .shadowRoot.querySelector('custom-publishing');
      publishing.dispatchEvent(
        new CustomEvent('published', {
          detail: { recordId: '00cn00000000000001', objectName: 'content' },
          bubbles: true,
          composed: true,
        })
      );
      return received;
    });

    expect(seen).toEqual(['00cn00000000000001']);
  });
});
