const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * `custom-sibling-navigation` — previous / next at the end of the contents.
 *
 * It knows no tree: the host passes the two neighbours (`{ id, name }` or
 * `null`) and listens for `sibling-select`.
 */

async function mount(page, { previous = null, next = null } = {}) {
  await page.evaluate(
    async ({ previous, next }) => {
      await import('/components/custom-sibling-navigation/custom-sibling-navigation.js');
      document
        .querySelectorAll('custom-sibling-navigation')
        .forEach((el) => el.remove());
      const el = document.createElement('custom-sibling-navigation');
      el.previous = previous;
      el.next = next;
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { previous, next }
  );
}

const button = (page, direction) =>
  page.locator(
    `custom-sibling-navigation button[data-direction="${direction}"]`
  );

const PREVIOUS = { id: 'n-1', name: 'Kapitel 1' };
const NEXT = { id: 'n-3', name: 'Kapitel 3' };

test.describe('custom-sibling-navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('shows both neighbours with their names', async ({ page }) => {
    test.fail(true, 'component does not exist yet (#209)');
    await mount(page, { previous: PREVIOUS, next: NEXT });

    await expect(button(page, 'previous')).toHaveText('‹ Kapitel 1');
    await expect(button(page, 'next')).toHaveText('Kapitel 3 ›');
    await expect(button(page, 'next')).toHaveClass(/slds-button/);
  });

  test('leaves out the button of a missing neighbour', async ({ page }) => {
    test.fail(true, 'component does not exist yet (#209)');
    await mount(page, { next: NEXT });

    await expect(button(page, 'previous')).toHaveCount(0);
    await expect(button(page, 'next')).toHaveText('Kapitel 3 ›');
  });

  test('renders nothing without neighbours', async ({ page }) => {
    test.fail(true, 'component does not exist yet (#209)');
    await mount(page);

    const rendered = await page.evaluate(
      () =>
        document.querySelector('custom-sibling-navigation').shadowRoot
          .childElementCount
    );
    // Only the shared stylesheet may sit in the shadow root.
    await expect(page.locator('custom-sibling-navigation button')).toHaveCount(
      0
    );
    expect(rendered).toBeLessThanOrEqual(1);
  });

  test('reports the chosen neighbour as sibling-select', async ({ page }) => {
    test.fail(true, 'component does not exist yet (#209)');
    await mount(page, { previous: PREVIOUS, next: NEXT });
    await page.evaluate(() => {
      window.__selected = [];
      document.addEventListener('sibling-select', (event) =>
        window.__selected.push({
          detail: event.detail,
          composed: event.composed,
        })
      );
    });

    await button(page, 'next').click();
    await button(page, 'previous').click();

    expect(await page.evaluate(() => window.__selected)).toEqual([
      { detail: { id: 'n-3' }, composed: true },
      { detail: { id: 'n-1' }, composed: true },
    ]);
  });
});
