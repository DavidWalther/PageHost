const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * App-Test für den classList-Contract von `slds-layout` / `slds-layout-item`.
 *
 * Beide rendern ins **Light DOM** — die `classList` des Hosts liegt also offen und
 * gehört technisch dem Consumer. Sie ist aber **von der Komponente verwaltet**: Nur
 * die Attribute der Komponente sollen wirken, niemand soll SLDS-Klassen direkt am
 * Host ablegen. Genau das war passiert (`slds-m-bottom--medium` im `bookstore`,
 * `slds-p-vertical_x-small` im `custom-navigation-modal`) — die Utility-Klassen sind
 * inzwischen in ein eigenes `<div>` gewandert.
 *
 * Dieser Test hält den Contract fest: In der laufenden App trägt kein Layout-Host
 * eine Klasse, die die Komponente nicht selbst gesetzt hat.
 */

// Präfixe, die die Komponenten selbst vergeben.
const OWNED_PREFIXES = [
  'slds-grid',
  'slds-wrap',
  'slds-gutters',
  'slds-col',
  'slds-size_',
  'slds-small-size_',
  'slds-medium-size_',
  'slds-large-size_',
  'slds-align-',
];

test.describe('Layout: classList-Contract', () => {
  test('kein Consumer setzt Klassen an einem Layout-Host', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();

    // Beide Modals öffnen — dort sitzen die meisten Layout-Items.
    const openModal = async (buttonId) => {
      await page.evaluate((id) => {
        document
          .querySelector('app-bookstore')
          .shadowRoot.querySelector(id)
          .click();
      }, buttonId);
      await page.waitForTimeout(500);
    };

    await openModal('#button-navigation_open');
    await page.keyboard.press('Escape');
    await openModal('#button-settings_open');

    const foreign = await page.evaluate((ownedPrefixes) => {
      const found = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'slds-layout' || tag === 'slds-layout-item') {
            const unexpected = [...el.classList].filter(
              (cls) => !ownedPrefixes.some((prefix) => cls.startsWith(prefix))
            );
            if (unexpected.length) {
              found.push({ tag, classes: unexpected });
            }
          }
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return found;
    }, OWNED_PREFIXES);

    // Wer Abstände braucht, legt sie auf ein eigenes Element im Slot-Inhalt —
    // nicht auf den Layout-Host.
    expect(foreign).toEqual([]);
  });
});
