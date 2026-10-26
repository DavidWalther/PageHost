const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * How the application asks for the content tree.
 *
 * The `contents` query is turned into a request in `public/index.js`. The
 * backend delivers the tree in full depth unless `?depth=N` trims it, so the
 * request must not carry a depth: the navigation modal lists the tree in any
 * depth, and a node on level 2 with a trimmed tree would arrive without its
 * children — it would look like a leaf, and a child created below it would
 * never show.
 *
 * The other specs answer every `contents` request with a fixed tree and so
 * cannot see the query. Here the mock trims like the backend does.
 */

const TREE = [
  {
    id: 'level-1',
    label: 'Level 1',
    name: 'Level 1',
    sortnumber: 1,
    childnodes: [
      {
        id: 'level-2',
        label: 'Level 2',
        name: 'Level 2',
        sortnumber: 1,
        childnodes: [
          {
            id: 'level-3',
            label: 'Level 3',
            name: 'Level 3',
            sortnumber: 1,
            childnodes: [],
          },
        ],
      },
    ],
  },
];

/** Trims the tree to `depth` levels, as `ContentsEndpoint` does. */
function trim(nodes, depth) {
  return nodes.map((node) => ({
    ...node,
    childnodes: depth > 1 ? trim(node.childnodes, depth - 1) : [],
  }));
}

let requestedUrls;

test.describe('Content tree request', () => {
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    requestedUrls = [];
    await mockBookstoreCallouts(page);
    await page.route('**/api/1.0/contents/**', (route) => {
      const url = new URL(route.request().url());
      requestedUrls.push(url);
      const depth = Number(url.searchParams.get('depth'));
      route.fulfill({
        json: { result: depth >= 1 ? trim(TREE, depth) : TREE },
      });
    });
    await cacheLitBundle(page);
    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();
  });

  test('asks for the whole tree, without a depth', async () => {
    await expect.poll(() => requestedUrls.length).toBeGreaterThan(0);

    for (const url of requestedUrls) {
      expect(url.pathname).toBe('/api/1.0/contents/all');
      expect(url.searchParams.has('depth')).toBe(false);
    }
  });

  test('the navigation modal reaches the third level', async ({ page }) => {
    const tile = (text) =>
      page.locator('custom-navigation-modal button.tile').filter({
        has: page.locator('.tile__name', { hasText: text }),
      });

    await page.locator('#button-navigation_open').click();
    await tile('Level 1').click();
    await tile('Level 2').click();

    await expect(tile('Level 3')).toBeVisible();
  });

  // One tree serves the whole page — the navigation modal and, above the
  // node, the arrows to the siblings. It is asked for
  // once, and once more after every change to a node.
  test('asks once when the page starts, and once more after a node changed', async ({
    page,
  }) => {
    await expect.poll(() => requestedUrls.length).toBe(1);
    // Give a second, unwanted request the time to go out.
    await page.waitForTimeout(500);
    expect(requestedUrls).toHaveLength(1);

    await page.locator('app-bookstore').evaluate((host) =>
      host.dispatchEvent(
        new CustomEvent('chapter-updated', {
          detail: { chapterData: { id: 'level-1', name: 'Level 1' } },
        })
      )
    );

    await expect.poll(() => requestedUrls.length).toBe(2);
    await page.waitForTimeout(500);
    expect(requestedUrls).toHaveLength(2);
  });
});

// Requests for the tree overlap — the one at the start with the one after a
// change, later the one after a login. Whichever answers last, the tree of
// the last request stays.
test.describe('Content tree request, overlapping', () => {
  test.use({ actionTimeout: 5000 });

  const named = (name) => [{ ...TREE[0], name, label: name }];

  test('an older answer arriving late does not replace a newer one', async ({
    page,
  }) => {
    let releaseFirst;
    const firstHeld = new Promise((resolve) => (releaseFirst = resolve));
    let calls = 0;
    await mockBookstoreCallouts(page);
    await page.route('**/api/1.0/contents/**', async (route) => {
      calls += 1;
      if (calls === 1) {
        await firstHeld;
        return route.fulfill({ json: { result: named('Old') } });
      }
      return route.fulfill({ json: { result: named('New') } });
    });
    await cacheLitBundle(page);
    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();
    await expect.poll(() => calls).toBe(1);

    await page.locator('app-bookstore').evaluate((host) =>
      host.dispatchEvent(
        new CustomEvent('chapter-updated', {
          detail: { chapterData: { id: 'level-1', name: 'New' } },
        })
      )
    );
    const tileNames = () =>
      page
        .locator('custom-navigation-modal')
        .evaluate((modal) => modal.tree.map((node) => node.name));
    await expect.poll(tileNames).toEqual(['New']);

    releaseFirst();
    // Give the late answer the time to arrive.
    await page.waitForTimeout(500);

    expect(await tileNames()).toEqual(['New']);
  });
});
