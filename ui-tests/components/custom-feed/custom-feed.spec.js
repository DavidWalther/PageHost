const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Tests for `custom-feed`: the feeds of the start page as tabs.
 *
 * The component is mounted into the shadow root of the application: `index.js`
 * binds the callouts (the `query` event) to the `app-bookstore` element, so a
 * feed outside of it would never get an answer. The application around it is
 * not part of the test. The feed data
 * is this spec's own; the routes registered here take precedence over the
 * general mocks.
 */

const node = (id, name, extra = {}) => ({
  id,
  legacy_id: null,
  name,
  description: null,
  sortnumber: 1,
  reversed: null,
  parent_node_id: null,
  cover_node_id: null,
  published_date: '2022-01-01 00:00:00',
  ...extra,
});

const contentHead = (id, sortnumber) => ({
  id,
  legacy_id: null,
  name: `Content ${id}`,
  sortnumber,
  published_date: '2022-01-01 00:00:00',
});

const NEWS = node('feed-news', 'News', {
  parent_node_id: 'feed-root',
  nodes: [],
  contents: [contentHead('news-1', 1), contentHead('news-2', 2)],
});
const VERSIONS = node('feed-versions', 'Versionen', {
  parent_node_id: 'feed-root',
  sortnumber: 2,
  reversed: true,
  nodes: [],
  contents: [contentHead('version-1', 1), contentHead('version-2', 2)],
});
const head = ({ nodes, contents, ...fields }) => fields;

const ROOT_WITH_TWO = node('feed-root', 'Feeds', {
  nodes: [head(NEWS), head(VERSIONS)],
  contents: [],
});
const ROOT_WITH_ONE = node('feed-root', 'Feeds', {
  nodes: [head(NEWS)],
  contents: [],
});
const ROOT_WITHOUT = node('feed-root', 'Feeds', { nodes: [], contents: [] });

/** Mocks the node and content callouts and records which nodes were asked for. */
async function mockFeedCallouts(page, root) {
  const records = {
    'feed-root': root,
    'feed-news': NEWS,
    'feed-versions': VERSIONS,
  };
  const requestedNodes = [];
  await page.route('**/data/query/node**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    requestedNodes.push(id);
    route.fulfill({ json: records[id] ?? {} });
  });
  await page.route('**/data/query/content**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    route.fulfill({
      json: {
        ...contentHead(id, 1),
        node_id: 'feed-news',
        active_content_item: `${id}-text`,
        active_type: 'text',
        items: [{ id: `${id}-text`, type: 'text', content: `Text of ${id}` }],
      },
    });
  });
  return requestedNodes;
}

async function mountFeed(page, attributes = {}) {
  await page.locator('app-bookstore').waitFor({ state: 'attached' });
  await page.evaluate(async (attributes) => {
    await import('/components/custom-feed/custom-feed.js');
    window.feedSelections = [];
    const feed = document.createElement('custom-feed');
    // The application has a feed of its own; this one is the one under test.
    feed.id = 'feed-under-test';
    for (const [name, value] of Object.entries(attributes)) {
      feed.setAttribute(name, value);
    }
    feed.addEventListener('feed-select', (event) =>
      window.feedSelections.push(event.detail)
    );
    document.querySelector('app-bookstore').shadowRoot.appendChild(feed);
  }, attributes);
}

function readFeed(page) {
  return page.evaluate(() => {
    const feed = document
      .querySelector('app-bookstore')
      .shadowRoot.querySelector('#feed-under-test');
    const root = feed.shadowRoot;
    const tabset = root.querySelector('slds-tabset');
    const nodes = [...root.querySelectorAll('custom-node')];
    return {
      hasTabset: !!tabset,
      tabs: tabset
        ? [...tabset.shadowRoot.querySelectorAll('a[role="tab"]')].map(
            (link) => ({
              label: link.textContent.trim(),
              selected: link.getAttribute('aria-selected') === 'true',
            })
          )
        : [],
      nodes: nodes.map((element) => ({
        feed: element.dataset.feedId,
        id: element.getAttribute('id'),
        contentnumber: element.getAttribute('contentnumber'),
        visible: element.getClientRects().length > 0,
        hasChildNavigation:
          !!element.shadowRoot?.querySelector('#child-navigation'),
        contentIds: [
          ...(element.shadowRoot?.querySelectorAll('custom-paragraph') ?? []),
        ].map((paragraph) => paragraph.id),
        noChildNavigation: element.hasAttribute('no-child-navigation'),
        canCreateContent: element.hasAttribute('can-create-content'),
        canDelete: element.hasAttribute('can-delete'),
      })),
      hint: root.querySelector('#no-feeds')?.textContent.trim() ?? null,
      activeFeed: feed.activeFeed,
      selections: window.feedSelections,
    };
  });
}

const nodeOf = (state, feedId) =>
  state.nodes.find((entry) => entry.feed === feedId);

async function clickTab(page, label) {
  await page
    .locator('#feed-under-test slds-tabset a[role="tab"]', { hasText: label })
    .click();
}

test.describe('custom-feed', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
  });

  test.describe('with several feeds', () => {
    let requestedNodes;

    test.beforeEach(async ({ page }) => {
      requestedNodes = await mockFeedCallouts(page, ROOT_WITH_TWO);
      await page.goto('/');
    });

    test('shows one tab per feed, the first one open', async ({ page }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });

      await expect
        .poll(async () => (await readFeed(page)).tabs)
        .toEqual([
          { label: 'News', selected: true },
          { label: 'Versionen', selected: false },
        ]);
    });

    test('lists the contents of the open feed one below the other', async ({
      page,
    }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });

      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.contentIds)
        .toEqual(['news-1', 'news-2']);
      const news = nodeOf(await readFeed(page), 'feed-news');
      expect(news.visible).toBe(true);
      expect(news.hasChildNavigation).toBe(false);
    });

    test('loads a feed only when its tab is opened', async ({ page }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });
      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.id)
        .toBe('feed-news');

      expect(nodeOf(await readFeed(page), 'feed-versions').id).toBeNull();
      expect(requestedNodes).not.toContain('feed-versions');

      await clickTab(page, 'Versionen');

      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-versions')?.id)
        .toBe('feed-versions');
      expect(requestedNodes).toContain('feed-versions');
      const state = await readFeed(page);
      expect(nodeOf(state, 'feed-versions').visible).toBe(true);
      expect(nodeOf(state, 'feed-news').visible).toBe(false);
    });

    test('does not load a feed again when its tab is reopened', async ({
      page,
    }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });
      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.id)
        .toBe('feed-news');

      await clickTab(page, 'Versionen');
      await clickTab(page, 'News');
      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.visible)
        .toBe(true);

      expect(requestedNodes.filter((id) => id === 'feed-news')).toHaveLength(1);
    });

    test('shows a reversed feed in reverse order', async ({ page }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });
      await clickTab(page, 'Versionen');

      await expect
        .poll(
          async () => nodeOf(await readFeed(page), 'feed-versions')?.contentIds
        )
        .toEqual(['version-2', 'version-1']);
    });

    test('reports a tab the user opens, not the one shown on start', async ({
      page,
    }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });
      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.id)
        .toBe('feed-news');
      expect((await readFeed(page)).selections).toEqual([]);

      await clickTab(page, 'Versionen');

      await expect
        .poll(async () => (await readFeed(page)).selections)
        .toEqual([{ id: 'feed-versions', name: 'Versionen' }]);
      expect((await readFeed(page)).activeFeed).toBe('feed-versions');
    });

    test('reports a tab the user opens with the keyboard', async ({ page }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });
      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.id)
        .toBe('feed-news');

      await page
        .locator('#feed-under-test slds-tabset a[role="tab"]', {
          hasText: 'News',
        })
        .focus();
      await page.keyboard.press('ArrowRight');

      await expect
        .poll(async () => (await readFeed(page)).selections)
        .toEqual([{ id: 'feed-versions', name: 'Versionen' }]);
    });

    test('opens the feed named by active-feed and loads only that one', async ({
      page,
    }) => {
      await mountFeed(page, {
        'root-id': 'feed-root',
        'active-feed': 'feed-versions',
      });

      await expect
        .poll(async () => (await readFeed(page)).tabs)
        .toEqual([
          { label: 'News', selected: false },
          { label: 'Versionen', selected: true },
        ]);
      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-versions')?.id)
        .toBe('feed-versions');
      const state = await readFeed(page);
      expect(nodeOf(state, 'feed-news').id).toBeNull();
      expect(requestedNodes).not.toContain('feed-news');
      expect(state.selections).toEqual([]);
    });

    test('follows active-feed when it is set from outside, without reporting it', async ({
      page,
    }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });
      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.id)
        .toBe('feed-news');

      await page.evaluate(() =>
        document
          .querySelector('app-bookstore')
          .shadowRoot.querySelector('#feed-under-test')
          .setAttribute('active-feed', 'feed-versions')
      );

      await expect
        .poll(
          async () => nodeOf(await readFeed(page), 'feed-versions')?.visible
        )
        .toBe(true);
      expect((await readFeed(page)).selections).toEqual([]);
    });

    test('hands contentnumber to the feed that was asked for', async ({
      page,
    }) => {
      await mountFeed(page, {
        'root-id': 'feed-root',
        'active-feed': 'feed-versions',
        contentnumber: '2',
      });

      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-versions')?.id)
        .toBe('feed-versions');
      const state = await readFeed(page);
      expect(nodeOf(state, 'feed-versions').contentnumber).toBe('2');
      expect(nodeOf(state, 'feed-news').contentnumber).toBeNull();
    });

    test('lets contents be created in a feed, but not the feed be deleted', async ({
      page,
    }) => {
      await mountFeed(page, { 'root-id': 'feed-root' });
      await expect
        .poll(async () => (await readFeed(page)).nodes.length)
        .toBe(2);

      (await readFeed(page)).nodes.forEach((entry) => {
        expect(entry.noChildNavigation).toBe(true);
        expect(entry.canCreateContent).toBe(true);
        expect(entry.canDelete).toBe(false);
      });
    });
  });

  test.describe('with a single feed', () => {
    test('shows the feed without a tab bar', async ({ page }) => {
      await mockFeedCallouts(page, ROOT_WITH_ONE);
      await page.goto('/');
      await mountFeed(page, { 'root-id': 'feed-root' });

      await expect
        .poll(async () => nodeOf(await readFeed(page), 'feed-news')?.contentIds)
        .toEqual(['news-1', 'news-2']);
      const state = await readFeed(page);
      expect(state.hasTabset).toBe(false);
      expect(state.nodes).toHaveLength(1);
    });
  });

  test.describe('without feeds', () => {
    const HINT = 'Keine Inhalte vorhanden';

    test('says so when the feed root has no feeds', async ({ page }) => {
      await mockFeedCallouts(page, ROOT_WITHOUT);
      await page.goto('/');
      await mountFeed(page, { 'root-id': 'feed-root' });

      await expect.poll(async () => (await readFeed(page)).hint).toBe(HINT);
      expect((await readFeed(page)).hasTabset).toBe(false);
    });

    test('says so when the feed root is not delivered', async ({ page }) => {
      await mockFeedCallouts(page, ROOT_WITH_TWO);
      await page.goto('/');
      await mountFeed(page, { 'root-id': 'unknown-root' });

      await expect.poll(async () => (await readFeed(page)).hint).toBe(HINT);
    });

    test('says so when no feed root is given', async ({ page }) => {
      await mockFeedCallouts(page, ROOT_WITH_TWO);
      await page.goto('/');
      await mountFeed(page);

      await expect.poll(async () => (await readFeed(page)).hint).toBe(HINT);
    });
  });
});
