const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_CONTENTS,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { fakeJwt, withSession } = require('../../support/session');

/**
 * The page follows a change of the session.
 *
 * What the page shows depends on the session: the `edit` scope sees
 * unpublished nodes, a visitor does not. When a session begins (`logged-in`)
 * or ends (`logged-out`), the application loads again what depends on it —
 * the content tree and the feeds:
 *
 * - a login through the provider (`code-exchange`) and a logout lead to the
 *   start page;
 * - a session restored from the refresh token (`restore`) keeps the place and
 *   fetches the node shown again — its actions appear.
 *
 * The flows run through the application itself: the code exchange, the
 * refresh and the logout are mocked at the network. The tree answers with an
 * unpublished root only to a request with a token, as the backend does.
 */

const FEED_ROOT_ID = '000n00000000000090';
const CHILD = MOCK_NODES.kind1;
const DRAFT = {
  id: '000n00000000000099',
  label: 'Draft',
  name: 'Draft',
  sortnumber: 9,
  childnodes: [],
};
const SESSION_KEY = 'code_exchange_response';

let treeRequests;
// One entry per request for the feed root: did it carry a token?
let feedRootRequests;
// How often each node was asked for.
let nodeRequests;

/**
 * Mocks the callouts; the tree depends on the token, as in the backend.
 * `holdFirstTree` returns a promise the first tree answer waits for.
 */
async function mockCallouts(page, { holdFirstTree = null } = {}) {
  treeRequests = [];
  nodeRequests = {};
  feedRootRequests = [];
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', async (route) => {
    const withToken = !!route.request().headers()['authorization'];
    treeRequests.push({ withToken });
    if (treeRequests.length === 1 && holdFirstTree) {
      await holdFirstTree();
    }
    const result = withToken
      ? [...MOCK_CONTENTS.result, DRAFT]
      : MOCK_CONTENTS.result;
    return route.fulfill({ json: { result } });
  });
  await page.route('**/data/query/node**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    nodeRequests[id] = (nodeRequests[id] ?? 0) + 1;
    if (id === FEED_ROOT_ID) {
      feedRootRequests.push({
        withToken: !!route.request().headers()['authorization'],
      });
    }
    return route.fallback();
  });
  await cacheLitBundle(page);
}

/** Resolves once `condition` holds — for a mock that answers late. */
async function waitUntil(condition) {
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** The names of the roots the navigation modal holds. */
const treeNames = (page) =>
  page
    .locator('custom-navigation-modal')
    .evaluate((modal) => modal.tree.map((node) => node.name));

function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const isShown = (element) => element.getClientRects().length > 0;
    return {
      feedsShown: isShown(root.querySelector('#feeds')),
      viewId: root.querySelector('custom-node-view').getAttribute('id'),
      path: window.location.pathname,
    };
  });
}

test.describe('Page after a change of the session', () => {
  test.use({ actionTimeout: 5000 });

  test.describe('a login through the provider', () => {
    test.beforeEach(async ({ page }) => {
      await mockCallouts(page);
      // The exchange answers once the page has loaded tree and feeds without
      // a session — the login has to load them again.
      await page.route('**/api/1.0/oAuth2/codeexchange', async (route) => {
        await waitUntil(
          () => treeRequests.length >= 1 && feedRootRequests.length >= 1
        );
        return route.fulfill({
          json: {
            authenticationResult: {
              access: { access_token: fakeJwt(), scopes: ['read', 'edit'] },
              refresh: { refresh_token: 'refresh-token' },
            },
          },
        });
      });
      // Back from the identity provider: the state the flow started with.
      await page.addInitScript(() =>
        sessionStorage.setItem('oidc_state', 'state-1')
      );
      await page.goto('/?code=code-1&state=state-1');
    });

    test('loads the tree again with the token', async ({ page }) => {
      await expect.poll(() => treeRequests.length).toBe(2);
      expect(treeRequests).toEqual([{ withToken: false }, { withToken: true }]);
      await expect.poll(() => treeNames(page)).toContain('Draft');
    });

    test('loads the feeds again with the token', async () => {
      await expect.poll(() => feedRootRequests.length).toBe(2);
      expect(feedRootRequests).toEqual([
        { withToken: false },
        { withToken: true },
      ]);
    });

    test('shows the start page', async ({ page }) => {
      await expect.poll(() => treeRequests.length).toBe(2);
      const state = await readPage(page);
      expect(state.feedsShown).toBe(true);
      expect(state.path).toBe('/');
    });
  });

  // The tree at the start goes out without a session and may answer last —
  // after the one the login asked for.
  test('a login keeps its tree when the first answer comes late', async ({
    page,
  }) => {
    await mockCallouts(page, {
      holdFirstTree: async () => {
        await waitUntil(() => treeRequests.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 300));
      },
    });
    await page.route('**/api/1.0/oAuth2/codeexchange', (route) =>
      route.fulfill({
        json: {
          authenticationResult: {
            access: { access_token: fakeJwt(), scopes: ['read', 'edit'] },
            refresh: { refresh_token: 'refresh-token' },
          },
        },
      })
    );
    await page.addInitScript(() =>
      sessionStorage.setItem('oidc_state', 'state-1')
    );
    await page.goto('/?code=code-1&state=state-1');
    await expect.poll(() => treeNames(page)).toContain('Draft');

    // Give the late answer the time to arrive.
    await page.waitForTimeout(800);

    expect(treeRequests).toEqual([{ withToken: false }, { withToken: true }]);
    expect(await treeNames(page)).toContain('Draft');
  });

  test.describe('a session restored from the refresh token', () => {
    test.beforeEach(async ({ page }) => {
      await mockCallouts(page);
      // The refresh answers once tree and node were loaded without a
      // session — the restore has to load them again.
      await page.route('**/api/1.0/auth/refresh', async (route) => {
        await waitUntil(
          () => treeRequests.length >= 1 && (nodeRequests[CHILD.id] ?? 0) >= 1
        );
        return route.fulfill({
          json: {
            authenticationResult: {
              access: { access_token: fakeJwt(), scopes: ['read', 'edit'] },
              refresh: { refresh_token: 'refresh-token-2' },
            },
          },
        });
      });
      // A new tab: no session, but the refresh token of an earlier one.
      await page.addInitScript(() =>
        localStorage.setItem('refresh_token', 'refresh-token-1')
      );
      await page.goto(`/${CHILD.id}`);
    });

    test('loads the tree again with the token', async ({ page }) => {
      await expect.poll(() => treeRequests.length).toBe(2);
      expect(treeRequests).toEqual([{ withToken: false }, { withToken: true }]);
      await expect.poll(() => treeNames(page)).toContain('Draft');
    });

    test('fetches the node shown again, its actions appear', async ({
      page,
    }) => {
      await expect.poll(() => nodeRequests[CHILD.id]).toBe(2);
      await expect(page.locator('custom-node-view #node-edit')).toBeAttached();
    });

    test('stays where it is', async ({ page }) => {
      await expect.poll(() => treeRequests.length).toBe(2);
      await expect.poll(() => nodeRequests[CHILD.id]).toBe(2);
      const state = await readPage(page);
      expect(state.feedsShown).toBe(false);
      expect(state.viewId).toBe(CHILD.id);
      expect(state.path).toBe(`/${CHILD.id}`);
    });
  });

  test.describe('a logout', () => {
    test.beforeEach(async ({ page }) => {
      await mockCallouts(page);
      await page.route('**/api/1.0/auth/logout', (route) =>
        route.fulfill({ json: { success: true } })
      );
      await withSession(page, ['read', 'edit']);
    });

    /** Signs off with the button in the settings. */
    async function logOut(page) {
      await page.locator('#button-settings_open').click();
      await page.locator('custom-login-module #button-logout').click();
    }

    test('loads the tree again without the token, the draft is gone', async ({
      page,
    }) => {
      await page.goto(`/${CHILD.id}`);
      await expect.poll(() => treeNames(page)).toContain('Draft');

      await logOut(page);

      await expect.poll(() => treeRequests.length).toBe(2);
      expect(treeRequests).toEqual([{ withToken: true }, { withToken: false }]);
      await expect.poll(() => treeNames(page)).not.toContain('Draft');
    });

    test('shows the start page', async ({ page }) => {
      await page.goto(`/${CHILD.id}`);
      await expect
        .poll(async () => (await readPage(page)).viewId)
        .toBe(CHILD.id);

      await logOut(page);

      await expect
        .poll(async () => (await readPage(page)).feedsShown)
        .toBe(true);
      expect((await readPage(page)).path).toBe('/');
    });

    test('loads the feeds again without the token', async ({ page }) => {
      await page.goto('/');
      await expect.poll(() => feedRootRequests.length).toBe(1);

      await logOut(page);

      await expect.poll(() => feedRootRequests.length).toBe(2);
      expect(feedRootRequests).toEqual([
        { withToken: true },
        { withToken: false },
      ]);
    });
  });

  // The access token has run out and the server refuses the refresh: the
  // session is gone without a logout. The first request for the tree never
  // went out — it had no token left — so without the reload the navigation
  // stayed empty.
  test.describe('a session that ran out', () => {
    test.beforeEach(async ({ page }) => {
      await mockCallouts(page);
      await page.route('**/api/1.0/auth/refresh', (route) =>
        route.fulfill({ status: 401, body: 'Unauthorized' })
      );
      await page.addInitScript(
        ([sessionKey, token]) => {
          sessionStorage.setItem(
            sessionKey,
            JSON.stringify({
              authenticationResult: {
                access: { access_token: token, scopes: ['read', 'edit'] },
              },
            })
          );
          localStorage.setItem('refresh_token', 'refresh-token-1');
        },
        [SESSION_KEY, fakeJwt(-60)]
      );
      await page.goto(`/${CHILD.id}`);
    });

    test('loads the tree without the token', async ({ page }) => {
      await expect
        .poll(() => treeNames(page))
        .toEqual(MOCK_CONTENTS.result.map((node) => node.name));
      expect(treeRequests).toEqual([{ withToken: false }]);
    });

    test('shows the start page', async ({ page }) => {
      await expect
        .poll(async () => (await readPage(page)).feedsShown)
        .toBe(true);
      expect((await readPage(page)).path).toBe('/');
    });
  });
});
