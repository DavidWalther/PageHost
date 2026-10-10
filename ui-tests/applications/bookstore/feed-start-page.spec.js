const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_FEEDS,
  MOCK_FEED_ROOT,
  MOCK_ROOT_PATH,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * The start page of the application: the feeds.
 *
 * Without an id in the address — and with one that matches nothing — the
 * application shows the feeds below the feed root the metadata names. A feed
 * is an ordinary node, so a deep link to one works like any other, but it is
 * shown where feeds are shown: as a tab, not as a child in a selection. As
 * soon as a node is opened through the navigation, the feeds make way.
 */

const NEWS = MOCK_FEEDS.news;
const VERSIONS = MOCK_FEEDS.versions;

async function open(page, path) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await page.goto(path);
  await expect(page.locator('app-bookstore')).toBeAttached();
}

/** Records every data query. Has to be called before `open`. */
function recordQueries(page) {
  const urls = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/data/query/')) {
      urls.push(`${url.pathname}?id=${url.searchParams.get('id')}`);
    }
  });
  return urls;
}

function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const isShown = (element) => element.getClientRects().length > 0;
    const feed = root.querySelector('custom-feed');
    const tabset = feed.shadowRoot.querySelector('slds-tabset');
    const nodeOf = (role) =>
      root.querySelector(`custom-node[data-role="${role}"]`);
    return {
      feedsShown: isShown(root.querySelector('#feeds')),
      nodesShown: isShown(root.querySelector('#bookshelf')),
      tabs: tabset
        ? [...tabset.shadowRoot.querySelectorAll('a[role="tab"]')].map(
            (link) => ({
              label: link.textContent.trim(),
              selected: link.getAttribute('aria-selected') === 'true',
            })
          )
        : [],
      feedNodes: [...feed.shadowRoot.querySelectorAll('custom-node')].map(
        (element) => ({
          feed: element.dataset.feedId,
          id: element.getAttribute('id'),
          contentnumber: element.getAttribute('contentnumber'),
          contentIds: [
            ...element.shadowRoot.querySelectorAll('custom-paragraph'),
          ].map((paragraph) => paragraph.id),
        })
      ),
      navigationId: nodeOf('navigation').getAttribute('id'),
      contentId: nodeOf('content').getAttribute('id'),
      path: window.location.pathname,
    };
  });
}

const tabs = async (page) => (await readPage(page)).tabs;
const feedNode = async (page, feed) =>
  (await readPage(page)).feedNodes.find((entry) => entry.feed === feed.id);

const NEWS_OPEN = [
  { label: 'Mock News', selected: true },
  { label: 'Mock Versions', selected: false },
];
const VERSIONS_OPEN = [
  { label: 'Mock News', selected: false },
  { label: 'Mock Versions', selected: true },
];

test.describe('Feeds as the start page', () => {
  test('without an id the feeds are shown, the first one open', async ({
    page,
  }) => {
    await open(page, '/');

    await expect.poll(() => tabs(page)).toEqual(NEWS_OPEN);
    await expect
      .poll(async () => (await feedNode(page, NEWS))?.contentIds)
      .toEqual(NEWS.contents.map((content) => content.id));

    const state = await readPage(page);
    expect(state.feedsShown).toBe(true);
    expect(state.nodesShown).toBe(false);
    // No node stands in for a start page any more.
    expect(state.navigationId).toBeNull();
    expect(state.contentId).toBeNull();
    expect(state.path).toBe('/');
  });

  test('an unknown id falls back to the feeds', async ({ page }) => {
    await open(page, '/000x99999999999999');

    await expect.poll(() => tabs(page)).toEqual(NEWS_OPEN);
    expect((await readPage(page)).feedsShown).toBe(true);
  });

  test('a deep link to the feed root shows the feeds', async ({ page }) => {
    await open(page, `/${MOCK_FEED_ROOT.id}`);

    await expect.poll(() => tabs(page)).toEqual(NEWS_OPEN);
    const state = await readPage(page);
    expect(state.feedsShown).toBe(true);
    // The feed root is not a selection.
    expect(state.navigationId).toBeNull();
  });

  test('a deep link to a feed opens its tab', async ({ page }) => {
    await open(page, `/${VERSIONS.id}`);

    await expect.poll(() => tabs(page)).toEqual(VERSIONS_OPEN);
    await expect
      .poll(async () => (await feedNode(page, VERSIONS))?.contentIds)
      .toEqual(VERSIONS.contents.map((content) => content.id));

    const state = await readPage(page);
    expect(state.feedsShown).toBe(true);
    expect(state.nodesShown).toBe(false);
    // Its parent is the feed root — that does not become the selection.
    expect(state.navigationId).toBeNull();
    expect(state.contentId).toBeNull();
  });

  test('a deep link to a content of a feed opens the tab and jumps to it', async ({
    page,
  }) => {
    const target = NEWS.contents[1];
    await open(page, `/${target.id}`);

    await expect.poll(() => tabs(page)).toEqual(NEWS_OPEN);
    await expect
      .poll(async () => (await feedNode(page, NEWS))?.contentnumber)
      .toBe(String(target.sortnumber));
    expect((await readPage(page)).contentId).toBeNull();
  });

  test('opening another feed puts it into the address', async ({ page }) => {
    await open(page, '/');
    await expect.poll(() => tabs(page)).toEqual(NEWS_OPEN);

    await page
      .locator('custom-feed a[role="tab"]', { hasText: 'Mock Versions' })
      .click();

    await expect.poll(() => tabs(page)).toEqual(VERSIONS_OPEN);
    await expect
      .poll(async () => (await readPage(page)).path)
      .toBe(`/${VERSIONS.id}`);
  });

  test('the feeds make way when a node is opened in the navigation', async ({
    page,
  }) => {
    await open(page, '/');
    await expect.poll(() => tabs(page)).toEqual(NEWS_OPEN);

    await page.locator('#button-navigation_open').click();
    await page
      .locator('custom-navigation-modal button', { hasText: 'Mock Story 1' })
      .click();

    await expect.poll(async () => (await readPage(page)).nodesShown).toBe(true);
    const state = await readPage(page);
    expect(state.feedsShown).toBe(false);
    expect(state.navigationId).toBe('000n00000000000011');
  });

  test('the navigation does not list the feed root', async ({ page }) => {
    await open(page, '/');
    await page.locator('#button-navigation_open').click();

    const modal = page.locator('custom-navigation-modal');
    await expect(
      modal.locator('button', { hasText: 'Mock Story 1' })
    ).toBeVisible();
    await expect(
      modal.locator('button', { hasText: MOCK_FEED_ROOT.name })
    ).toHaveCount(0);
  });

  test('entering on a node shows no feeds and loads none', async ({ page }) => {
    const queries = recordQueries(page);
    await open(page, MOCK_ROOT_PATH);

    await expect
      .poll(async () => (await readPage(page)).contentId)
      .toBe('000n00000000000001');
    await page.waitForTimeout(300);

    const state = await readPage(page);
    expect(state.feedsShown).toBe(false);
    expect(state.nodesShown).toBe(true);
    expect(queries.join('\n')).not.toContain(MOCK_FEED_ROOT.id);
  });
});
