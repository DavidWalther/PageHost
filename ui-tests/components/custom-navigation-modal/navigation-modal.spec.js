const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * UI tests for the navigation modal (`custom-navigation-modal`).
 *
 * The modal loads the content tree on app start (`contents` callout, mocked)
 * and lists the roots as tiles. A tile with children opens its level and
 * reports `navigation-level-open`; one without children reports
 * `navigation-node-select` and the modal closes. „< zurück" goes up one level.
 *
 * Runs anonymously — every data callout is mocked via `page.route()`, no
 * Postgres or Redis involved.
 */
// A deep link to the root: the location is the root itself, so the modal
// opens on the top level. (The start page stands on the root's cover node.)
const ROOT = '/000s00000000000011';

test.describe('Navigation modal', () => {
  const tiles = (page) => page.locator('custom-navigation-modal button.tile');
  // A tile is found by its name, not by its whole text (which may carry more).
  const tileByText = (page, text) =>
    page
      .locator('custom-navigation-modal button.tile')
      .filter({ has: page.locator('.tile__name', { hasText: text }) });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto(ROOT);
    await expect(page.locator('app-bookstore')).toBeAttached();
  });

  async function openModal(page) {
    // Öffnen-Button liegt in der Kopfzeile der Bookstore-App.
    await page.locator('#button-navigation_open').click();
  }

  test('öffnet und listet alle Stories', async ({ page }) => {
    await openModal(page);

    // slds-modal rendert seinen Inhalt erst im offenen Zustand — vorher gibt es
    // keine sichtbaren Kacheln. Die Assertion wartet, bis der (gemockte) Baum da ist.
    await expect(tiles(page).first()).toBeVisible();
    await expect(tiles(page)).toHaveCount(2);
    await expect(tileByText(page, 'Mock Story 1')).toBeVisible();
    await expect(tileByText(page, 'Mock Story 2')).toBeVisible();
  });

  test('Drilldown in die Kapitel und zurück zur Story-Ebene', async ({
    page,
  }) => {
    await openModal(page);
    await tileByText(page, 'Mock Story 1').click();

    // Kapitel-Ebene von Story 1: beide Kapitel sichtbar, Story 2 nicht mehr.
    await expect(tileByText(page, 'Mock Chapter 1 for Story 1')).toBeVisible();
    await expect(tileByText(page, 'Mock Chapter 2 for Story 1')).toBeVisible();
    await expect(tiles(page)).toHaveCount(2);
    await expect(tileByText(page, 'Mock Story 2')).toHaveCount(0);

    // „< zurück" führt wieder auf die Story-Ebene mit beiden Stories.
    await page.locator('custom-navigation-modal .back-button').click();
    await expect(tileByText(page, 'Mock Story 1')).toBeVisible();
    await expect(tileByText(page, 'Mock Story 2')).toBeVisible();
  });

  /** Records the detail of the next `name` event on document. */
  function recordNext(page, name) {
    return page.evaluate((eventName) => {
      window.__recorded = null;
      // composed + bubbles: the event leaves the shadow DOM up to document.
      document.addEventListener(
        eventName,
        (event) => {
          window.__recorded = event.detail;
        },
        { once: true }
      );
    }, name);
  }
  const recorded = (page) => page.evaluate(() => window.__recorded);

  test('a tile with children reports navigation-level-open with its id', async ({
    page,
  }) => {
    await openModal(page);
    await recordNext(page, 'navigation-level-open');

    await tileByText(page, 'Mock Story 1').click();

    await expect
      .poll(() => recorded(page))
      .toEqual({ id: '000n00000000000011' });
  });

  test('a tile without children reports navigation-node-select with id and parent', async ({
    page,
  }) => {
    await openModal(page);
    await tileByText(page, 'Mock Story 1').click();
    await recordNext(page, 'navigation-node-select');

    await tileByText(page, 'Mock Chapter 2 for Story 1').click();

    await expect
      .poll(() => recorded(page))
      .toEqual({
        id: '000n00000000000002',
        parentId: '000n00000000000011',
      });
  });

  test('opens on the top level and marks the entry node', async ({ page }) => {
    await openModal(page);

    await expect(tileByText(page, 'Mock Story 1')).toHaveClass(/tile_current/);
    await expect(tileByText(page, 'Mock Story 2')).not.toHaveClass(
      /tile_current/
    );
  });

  test('reopens on the level of a chosen child and marks the path', async ({
    page,
  }) => {
    await openModal(page);
    await tileByText(page, 'Mock Story 1').click();
    await tileByText(page, 'Mock Chapter 2 for Story 1').click();
    await expect(tiles(page).first()).toBeHidden();

    await openModal(page);

    // Opens straight on the child level, the chosen child is marked …
    await expect(tileByText(page, 'Mock Chapter 2 for Story 1')).toHaveClass(
      /tile_current/
    );
    await expect(
      tileByText(page, 'Mock Chapter 1 for Story 1')
    ).not.toHaveClass(/tile_current/);

    // … and one level up its parent is marked as well.
    await page.locator('custom-navigation-modal .back-button').click();
    await expect(tileByText(page, 'Mock Story 1')).toHaveClass(/tile_current/);
  });

  test('closing with Escape changes nothing behind the modal', async ({
    page,
  }) => {
    const readNodes = () =>
      page.evaluate(() =>
        document
          .querySelector('app-bookstore')
          .shadowRoot.querySelector('custom-node')
          .getAttribute('id')
      );
    await openModal(page);
    await expect(tiles(page).first()).toBeVisible();
    const before = await readNodes();

    await page.keyboard.press('Escape');

    await expect(tiles(page).first()).toBeHidden();
    expect(await readNodes()).toEqual(before);
  });
});

/** A node of a content tree by id, on any level. */
function findDeep(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const below = findDeep(node.childnodes || [], id);
    if (below) return below;
  }
  return null;
}

test.describe('Navigation modal in any depth', () => {
  // Spec-local tree with four levels; the shared MOCK_CONTENTS stays as it is
  // because other specs rely on it.
  const DEEP_TREE = {
    result: [
      {
        id: 'd-root',
        label: 'Deep Root',
        name: 'Deep Root',
        childnodes: [
          {
            id: 'd-2',
            label: 'Deep Level 2',
            name: 'Deep Level 2',
            childnodes: [
              {
                id: 'd-3',
                label: 'Deep Level 3',
                name: 'Deep Level 3',
                childnodes: [
                  {
                    id: 'd-4',
                    label: 'Deep Level 4',
                    name: 'Deep Level 4',
                    childnodes: [],
                  },
                  {
                    id: 'd-4-b',
                    label: 'Deep Level 4 B',
                    name: 'Deep Level 4 B',
                    childnodes: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'd-other',
        label: 'Other Root',
        name: 'Other Root',
        childnodes: [],
      },
    ],
  };

  const tiles = (page) => page.locator('custom-navigation-modal button.tile');
  const tileNames = (page) =>
    page.locator('custom-navigation-modal button.tile .tile__name');
  const tile = (page, text) =>
    page.locator('custom-navigation-modal button.tile').filter({
      has: page.locator('.tile__name', {
        hasText: new RegExp(`^\\s*${text}\\s*$`),
      }),
    });
  const modal = (page) => page.locator('custom-navigation-modal slds-modal');
  const back = (page) => page.locator('custom-navigation-modal .back-button');
  const openModal = (page) => page.locator('#button-navigation_open').click();

  // A missing tile fails the click quickly instead of running into the
  // test timeout, so a broken level reports where it broke.
  test.use({ actionTimeout: 5000 });

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await page.route('**/api/1.0/contents/**', (route) =>
      route.fulfill({ json: DEEP_TREE })
    );
    // The page shows a chosen node only once its record arrives: answer every
    // node of the deep tree with a minimal record.
    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const node = findDeep(DEEP_TREE.result, id);
      return node
        ? route.fulfill({
            json: {
              id: node.id,
              name: node.name,
              parent_node_id: null,
              cover_node_id: null,
              nodes: node.childnodes,
              contents: [],
            },
          })
        : route.fallback();
    });
    await cacheLitBundle(page);
    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();
  });

  test('drills down to the fourth level', async ({ page }) => {
    await openModal(page);
    await tile(page, 'Deep Root').click();
    await tile(page, 'Deep Level 2').click();
    await tile(page, 'Deep Level 3').click();

    await expect(tileNames(page)).toHaveText([
      'Deep Level 4',
      'Deep Level 4 B',
    ]);
  });

  test('goes up exactly one level with back', async ({ page }) => {
    await openModal(page);
    await tile(page, 'Deep Root').click();
    await tile(page, 'Deep Level 2').click();
    await tile(page, 'Deep Level 3').click();

    await back(page).click();

    await expect(tileNames(page)).toHaveText(['Deep Level 3']);
  });

  test('a tile without children selects the node and closes', async ({
    page,
  }) => {
    await openModal(page);
    await tile(page, 'Deep Root').click();
    await tile(page, 'Deep Level 2').click();
    await tile(page, 'Deep Level 3').click();

    await tile(page, 'Deep Level 4 B').click();

    await expect(modal(page)).not.toHaveAttribute('open');
  });

  test('reopens on the level of a deep location and marks the whole path', async ({
    page,
  }) => {
    await openModal(page);
    await tile(page, 'Deep Root').click();
    await tile(page, 'Deep Level 2').click();
    await tile(page, 'Deep Level 3').click();
    await tile(page, 'Deep Level 4 B').click();
    await expect(modal(page)).not.toHaveAttribute('open');

    await openModal(page);

    await expect(tileNames(page)).toHaveText([
      'Deep Level 4',
      'Deep Level 4 B',
    ]);
    await expect(tile(page, 'Deep Level 4 B')).toHaveClass(/tile_current/);
    await back(page).click();
    await expect(tile(page, 'Deep Level 3')).toHaveClass(/tile_current/);
    await back(page).click();
    await expect(tile(page, 'Deep Level 2')).toHaveClass(/tile_current/);
    await back(page).click();
    await expect(tile(page, 'Deep Root')).toHaveClass(/tile_current/);
    await expect(tile(page, 'Other Root')).not.toHaveClass(/tile_current/);
  });

  test('a root without children selects the node and closes', async ({
    page,
  }) => {
    await openModal(page);

    await tile(page, 'Other Root').click();

    await expect(modal(page)).not.toHaveAttribute('open');
  });
});

test.describe('Navigation modal child marker', () => {
  test.use({ actionTimeout: 5000 });

  const tile = (page, text) =>
    page
      .locator('custom-navigation-modal button.tile')
      .filter({ has: page.locator('.tile__name', { hasText: text }) });

  /** What a tile shows next to its name. */
  function readMarker(page, text) {
    return tile(page, text).evaluate((button) => {
      const marker = button.querySelector('.tile__children');
      if (!marker) {
        return null;
      }
      const use = marker.querySelector('svg use');
      return {
        count: marker.querySelector('.tile__count')?.textContent.trim() ?? null,
        // The resolved reference, not the attribute string (doc/conventions.md).
        iconHref: use ? use.href.baseVal : null,
        iconHidden: use?.parentElement.getAttribute('aria-hidden') ?? null,
        assistive:
          marker.querySelector('.slds-assistive-text')?.textContent.trim() ??
          null,
      };
    });
  }

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto(ROOT);
    await expect(page.locator('app-bookstore')).toBeAttached();
    await page.locator('#button-navigation_open').click();
    await expect(tile(page, 'Mock Story 1')).toBeVisible();
  });

  test('a tile with children shows their number and a chevron', async ({
    page,
  }) => {
    const marker = await readMarker(page, 'Mock Story 1');

    expect(marker.count).toBe('2');
    expect(marker.iconHref).toBe(
      '/assets/icons/utility-sprite/svg/symbols.svg#chevronright'
    );
    expect(marker.iconHidden).toBe('true');
  });

  test('screen readers hear the number as words', async ({ page }) => {
    expect((await readMarker(page, 'Mock Story 1')).assistive).toBe(
      '2 Einträge'
    );
    expect((await readMarker(page, 'Mock Story 2')).assistive).toBe(
      '1 Eintrag'
    );
  });

  test('a tile without children shows no marker', async ({ page }) => {
    await tile(page, 'Mock Story 1').click();

    expect(await readMarker(page, 'Mock Chapter 1 for Story 1')).toBeNull();
  });
});
