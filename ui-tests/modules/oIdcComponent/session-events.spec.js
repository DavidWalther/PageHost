const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * What `oidc-component` reports once a session begins or ends.
 *
 * `logged-in` and `logged-out` come **after** the session was written or
 * removed: a listener that asks the backend right away must already go with
 * — or without — the token. Both bubble and are composed, so they leave any
 * shadow root the component sits in; `detail.reason` names what happened.
 *
 * The component is mounted on a blank page, inside a shadow root of its own.
 */

const SESSION_KEY = 'code_exchange_response';
const EXCHANGE_RESPONSE = {
  authenticationResult: {
    access: { access_token: 'access-token', scopes: ['read', 'edit'] },
    refresh: { refresh_token: 'refresh-token' },
  },
};

/**
 * Mounts the component inside a shadow root and records, for every session
 * event that reaches `window`, its reason and the stored session at that
 * moment.
 */
async function mount(page) {
  await page.evaluate(async (sessionKey) => {
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
    await import('/modules/oIdcComponent.js');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const component = document.createElement('oidc-component');
    component.setAttribute(
      'server-endpoint-auth-code-exchange',
      '/api/1.0/oAuth2/codeexchange'
    );
    host.attachShadow({ mode: 'open' }).appendChild(component);
    window.componentUnderTest = component;
  }, SESSION_KEY);
}

const readEvents = (page) => page.evaluate(() => window.sessionEvents);

test.describe('oidc-component: session events', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('a code exchange reports logged-in once the session is stored', async ({
    page,
  }) => {
    await page.route('**/api/1.0/oAuth2/codeexchange', (route) =>
      route.fulfill({ json: EXCHANGE_RESPONSE })
    );
    // Back from the identity provider: code and state in the address, the
    // state the flow started with in the session.
    await page.evaluate(() => {
      sessionStorage.setItem('oidc_state', 'state-1');
      window.history.replaceState({}, '', '/?code=code-1&state=state-1');
    });

    await mount(page);

    await expect.poll(() => readEvents(page)).toHaveLength(1);
    const [event] = await readEvents(page);
    expect(event.name).toBe('logged-in');
    expect(event.reason).toBe('code-exchange');
    expect(JSON.parse(event.session)).toEqual(EXCHANGE_RESPONSE);
  });

  test('a rejected code exchange reports nothing', async ({ page }) => {
    await page.route('**/api/1.0/oAuth2/codeexchange', (route) =>
      route.fulfill({ status: 401, body: 'Unauthorized' })
    );
    await page.evaluate(() => {
      sessionStorage.setItem('oidc_state', 'state-1');
      window.history.replaceState({}, '', '/?code=code-1&state=state-1');
    });

    await mount(page);

    // Give an unwanted event the time to arrive.
    await page.waitForTimeout(500);
    expect(await readEvents(page)).toEqual([]);
  });

  test('a logout reports logged-out once session and token are gone', async ({
    page,
  }) => {
    await page.evaluate(
      ([sessionKey, response]) => {
        sessionStorage.setItem(sessionKey, JSON.stringify(response));
        localStorage.setItem('refresh_token', 'refresh-token');
      },
      [SESSION_KEY, EXCHANGE_RESPONSE]
    );
    await mount(page);
    // The consumer answers `logout` by signing off at the backend and then
    // calling back — here at once.
    await page.evaluate(() =>
      window.componentUnderTest.addEventListener('logout', (event) =>
        event.detail.callback()
      )
    );

    await page.evaluate(() => window.componentUnderTest.logout());

    await expect.poll(() => readEvents(page)).toHaveLength(1);
    const [event] = await readEvents(page);
    expect(event.name).toBe('logged-out');
    expect(event.reason).toBe('logout');
    expect(event.session).toBeNull();
    expect(event.refreshToken).toBeNull();
  });

  test('asking to log out reports nothing before the consumer calls back', async ({
    page,
  }) => {
    await mount(page);
    await page.evaluate(() =>
      window.componentUnderTest.addEventListener('logout', () => {})
    );

    await page.evaluate(() => window.componentUnderTest.logout());

    await page.waitForTimeout(500);
    expect(await readEvents(page)).toEqual([]);
  });
});
