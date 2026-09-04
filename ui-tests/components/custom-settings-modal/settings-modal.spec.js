const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Einstellungs-Modal und seine Danger Zone.
 *
 * App-Test (bootet die echte App), liegt aber nach der Ablage-Regel im Ordner
 * seines Gegenstands: `custom-settings-modal`. Geprüft wird, dass das Modal über
 * das Zahnrad aufgeht und die rot umrandete Danger Zone mit ihren Aktionen
 * zeigt — das Fundament, auf dem weitere Danger-Zone-Aktionen aufsetzen.
 *
 * Die Zone selbst wird nur gerendert, wenn dem `danger`-Slot etwas zugewiesen
 * ist (`custom-settings-modal.js`), ihr Inhalt kommt also von der Anwendung.
 */
test.describe('Einstellungs-Modal', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/');
  });

  test('Modal ist zu, bis das Zahnrad geklickt wird', async ({ page }) => {
    await expect(page.locator('.danger-zone')).not.toBeVisible();

    await page.locator('#button-settings_open').click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('Danger Zone ist sichtbar, sobald das Modal offen ist', async ({
    page,
  }) => {
    await page.locator('#button-settings_open').click();

    // Sichtbar heißt: dem danger-Slot ist etwas zugewiesen. Ein leerer Slot
    // hielte die Zone ausgeblendet.
    await expect(page.locator('.danger-zone')).toBeVisible();
  });

  test('Danger Zone bietet das Löschen der Login-Session an', async ({
    page,
  }) => {
    await page.locator('#button-settings_open').click();

    // Der Inhalt der Zone ist Licht-DOM der Anwendung, das durch den
    // danger-Slot projiziert wird — er hängt deshalb am slot-Attribut, nicht
    // unter .danger-zone (dort steht nur der <slot> selbst).
    const dangerRow = page.locator('[slot="danger"]', {
      hasText: 'Login-Session löschen',
    });
    await expect(dangerRow).toBeVisible();
    await expect(
      dangerRow.getByRole('button', { name: 'Session löschen' })
    ).toBeVisible();
  });
});
