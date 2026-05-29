const { test, expect } = require('@playwright/test');
const { setupDefaultMocks } = require('./helpers/mockBackend');

const DUMMY_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  Buffer.from(
    JSON.stringify({ exp: 9999999999, sub: 'test@example.com' })
  ).toString('base64url'),
  'fakesignature',
].join('.');

const SESSION_DATA = JSON.stringify({
  authenticationResult: {
    access: { access_token: DUMMY_JWT },
    refresh: { refresh_token: 'dummy-refresh-token' },
  },
});

test.describe('custom-login-module', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultMocks(page);
  });

  test('A: shows login button when logged out', async ({ page }) => {
    await page.goto('/fixtures/login-module.html');

    await expect(page.locator('#button-login')).toBeVisible();
    await expect(page.locator('#button-logout')).toBeHidden();
  });

  test('B: opens login modal on button click', async ({ page }) => {
    await page.goto('/fixtures/login-module.html');

    await page.locator('#button-login').click();

    await expect(page.locator('slds-modal[title="Login"]')).toHaveAttribute(
      'open',
      ''
    );
    await expect(
      page.locator('text=Neue Regisrierungen sind im Moment nicht möglich.')
    ).toBeVisible();
    await expect(page.locator('img[alt="Google G logo"]')).toBeVisible();
  });

  test.describe('when session is stored', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((data) => {
        sessionStorage.setItem('code_exchange_response', data);
      }, SESSION_DATA);
    });

    test('C: shows logout button when already logged in', async ({ page }) => {
      await page.goto('/fixtures/login-module.html');

      await expect(page.locator('#button-logout')).toBeVisible();
      await expect(page.locator('#button-login')).toBeHidden();
    });

    test('D: calls logout endpoint and shows login button after logout', async ({
      page,
    }) => {
      await page.goto('/fixtures/login-module.html');

      const logoutRequest = page.waitForRequest('**/api/1.0/auth/logout');
      await page.locator('#button-logout').click();
      await logoutRequest;

      await expect(page.locator('#button-login')).toBeVisible();
    });
  });

  test('E: restores session automatically from refresh token on mount', async ({
    page,
  }) => {
    await page.route('**/api/1.0/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticationResult: {
            access: { access_token: DUMMY_JWT },
            refresh: { refresh_token: 'new-refresh-token' },
          },
        }),
      })
    );

    await page.addInitScript(() => {
      localStorage.setItem('refresh_token', 'test-refresh-token');
    });

    await page.goto('/fixtures/login-module.html');

    await expect(page.locator('#button-logout')).toBeVisible();
  });
});
