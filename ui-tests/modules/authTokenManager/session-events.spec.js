const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');
const { fakeJwt } = require('../../support/session');

/**
 * What `authTokenManager` reports when a refresh begins or ends a session.
 *
 * The module has no element; it fires on `window`. Only a change of the
 * session counts:
 *
 * - a session restored from the refresh token (none was stored) →
 *   `logged-in`, reason `restore`, once the session is written;
 * - a refresh the server refuses while a session was stored → `logged-out`,
 *   reason `expired`, once session and refresh token are gone;
 * - an ordinary refresh, a refused restore without a session and a refresh
 *   that never reached the server → nothing.
 */

const SESSION_KEY = 'code_exchange_response';

/** A dummy JWT that expired a minute ago. */
function expiredJwt() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) - 60;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

const session = (token) => ({
  authenticationResult: {
    access: { access_token: token, scopes: ['read', 'edit'] },
  },
});

const REFRESHED = {
  authenticationResult: {
    access: { access_token: fakeJwt(), scopes: ['read', 'edit'] },
    refresh: { refresh_token: 'refresh-token-2' },
  },
};

/** Puts session and refresh token in place and records the session events. */
async function prepare(page, { storedSession = null }) {
  await page.evaluate(
    ([sessionKey, storedSession]) => {
      if (storedSession) {
        sessionStorage.setItem(sessionKey, JSON.stringify(storedSession));
      }
      localStorage.setItem('refresh_token', 'refresh-token-1');
      window.sessionEvents = [];
      for (const name of ['logged-in', 'logged-out']) {
        window.addEventListener(name, (event) =>
          window.sessionEvents.push({
            name,
            reason: event.detail?.reason ?? null,
            session: sessionStorage.getItem(sessionKey),
            refreshToken: localStorage.getItem('refresh_token'),
          })
        );
      }
    },
    [SESSION_KEY, storedSession]
  );
}

/** Calls one export of the module and returns its result. */
const call = (page, name) =>
  page.evaluate(async (name) => {
    const module = await import('/modules/authTokenManager.js');
    return module[name]();
  }, name);

const readEvents = (page) => page.evaluate(() => window.sessionEvents);

/** Waits a moment, so that an unwanted event would have arrived. */
const settle = (page) => page.waitForTimeout(300);

test.describe('authTokenManager: session events', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test.describe('the server accepts the refresh', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/1.0/auth/refresh', (route) =>
        route.fulfill({ json: REFRESHED })
      );
    });

    test('a restored session reports logged-in once it is stored', async ({
      page,
    }) => {
      await prepare(page, { storedSession: null });

      expect(await call(page, 'tryRestoreSession')).toBe(true);

      const events = await readEvents(page);
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('logged-in');
      expect(events[0].reason).toBe('restore');
      expect(JSON.parse(events[0].session)).toEqual(REFRESHED);
      expect(events[0].refreshToken).toBe('refresh-token-2');
    });

    test('an ordinary refresh reports nothing', async ({ page }) => {
      await prepare(page, { storedSession: session(expiredJwt()) });

      expect(await call(page, 'refreshAccessToken')).toBe(true);

      await settle(page);
      expect(await readEvents(page)).toEqual([]);
    });
  });

  test.describe('the server refuses the refresh', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/1.0/auth/refresh', (route) =>
        route.fulfill({ status: 401, body: 'Unauthorized' })
      );
    });

    test('an expired session reports logged-out once it is gone', async ({
      page,
    }) => {
      await prepare(page, { storedSession: session(expiredJwt()) });

      expect(await call(page, 'refreshAccessToken')).toBe(false);

      const events = await readEvents(page);
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('logged-out');
      expect(events[0].reason).toBe('expired');
      expect(events[0].session).toBeNull();
      expect(events[0].refreshToken).toBeNull();
    });

    // A visitor with an old refresh token and no session: nothing ended.
    test('a refused restore without a session reports nothing', async ({
      page,
    }) => {
      await prepare(page, { storedSession: null });

      expect(await call(page, 'tryRestoreSession')).toBe(false);

      await settle(page);
      expect(await readEvents(page)).toEqual([]);
    });
  });

  test('a refresh that never reaches the server reports nothing', async ({
    page,
  }) => {
    await page.route('**/api/1.0/auth/refresh', (route) => route.abort());
    await prepare(page, { storedSession: session(expiredJwt()) });

    expect(await call(page, 'refreshAccessToken')).toBe(false);

    await settle(page);
    expect(await readEvents(page)).toEqual([]);
  });
});
