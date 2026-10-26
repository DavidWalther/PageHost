const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Signing out with the button in the settings.
 *
 * The component signs off at the backend (`GET /api/1.0/auth/logout`) and
 * then lets `oidc-component` remove the session. Whatever the backend
 * answers, the session ends here: a failed sign-off is reported, but nobody
 * stays signed in because of it.
 *
 * The component lives in the settings of the application; the spec runs it
 * there, with a session from the start.
 */

const SESSION_KEY = 'code_exchange_response';

/** Opens the page signed in and records toasts and session events. */
async function openSignedIn(page, logoutRoute) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await page.route('**/api/1.0/auth/logout', logoutRoute);
  await withSession(page, ['read', 'edit']);
  await page.addInitScript(() => {
    localStorage.setItem('refresh_token', 'refresh-token');
    window.recorded = [];
    window.addEventListener('logged-out', (event) =>
      window.recorded.push({ event: 'logged-out', ...event.detail })
    );
    // The toast is answered — and stopped — by public/index.js on the
    // application element; window sees it on the way down.
    window.addEventListener(
      'toast',
      (event) =>
        window.recorded.push({
          event: 'toast',
          message: event.detail.message,
          variant: event.detail.variant,
        }),
      { capture: true }
    );
  });
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
}

async function logOut(page) {
  await page.locator('#button-settings_open').click();
  await page.locator('custom-login-module #button-logout').click();
}

const readRecorded = (page) => page.evaluate(() => window.recorded);
const readStores = (page) =>
  page.evaluate((sessionKey) => {
    return {
      session: sessionStorage.getItem(sessionKey),
      refreshToken: localStorage.getItem('refresh_token'),
    };
  }, SESSION_KEY);

test.describe('custom-login-module: logout', () => {
  test.use({ actionTimeout: 5000 });

  test('signed off at the backend: the session ends with a success', async ({
    page,
  }) => {
    await openSignedIn(page, (route) =>
      route.fulfill({ json: { success: true } })
    );

    await logOut(page);

    await expect.poll(() => readRecorded(page)).toHaveLength(2);
    expect(await readRecorded(page)).toEqual([
      { event: 'toast', message: 'Logout successful', variant: 'success' },
      { event: 'logged-out', reason: 'logout' },
    ]);
    expect(await readStores(page)).toEqual({
      session: null,
      refreshToken: null,
    });
  });

  test('the backend fails: the session ends all the same, with an error', async ({
    page,
  }) => {
    await openSignedIn(page, (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );

    await logOut(page);

    await expect.poll(() => readRecorded(page)).toHaveLength(2);
    expect(await readRecorded(page)).toEqual([
      { event: 'toast', message: 'Logout failed', variant: 'error' },
      { event: 'logged-out', reason: 'logout' },
    ]);
    expect(await readStores(page)).toEqual({
      session: null,
      refreshToken: null,
    });
  });

  test('the backend is not reached: the session ends all the same', async ({
    page,
  }) => {
    await openSignedIn(page, (route) => route.abort());

    await logOut(page);

    await expect.poll(() => readRecorded(page)).toHaveLength(2);
    expect(await readRecorded(page)).toEqual([
      { event: 'toast', message: 'Logout failed', variant: 'error' },
      { event: 'logged-out', reason: 'logout' },
    ]);
    expect(await readStores(page)).toEqual({
      session: null,
      refreshToken: null,
    });
  });
});
