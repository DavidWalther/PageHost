const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * The login modal says plainly that nobody can register — the backend turns
 * an unknown email away. The notice stands in a box of its own, framed in
 * the warning colour.
 */

test.describe('custom-login-module: no self-registration', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/');
    await page.locator('#button-settings_open').click();
    await page.locator('custom-login-module #button-login').click();
  });

  test('says that no new registrations are possible', async ({ page }) => {
    await expect(page.locator('custom-login-module .warning')).toHaveText(
      'Neue Registrierungen sind im Moment nicht möglich.'
    );
  });

  test('frames the notice with a solid border of 1px', async ({ page }) => {
    const notice = page.locator('custom-login-module .warning');
    await expect(notice).toBeVisible();

    const border = await notice.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.borderTopWidth, style: style.borderTopStyle };
    });

    expect(border).toEqual({ width: '1px', style: 'solid' });
  });
});
