const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_CONTENTS,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * The navigation modal reloads the content tree after a node changed.
 *
 * The tree is loaded once on connect. Without a reload the modal kept showing
 * the old state after creating, renaming, deleting, publishing or unpublishing
 * a node. The app listens for the events the editing components already send
 * and asks the modal to reload.
 *
 * The events are dispatched on the navigation node, the way the editing
 * components inside it send them (bubbling, composed). The contents callout
 * answers with a changed tree from the second call on.
 */

const CHANGED_TREE = {
  result: [
    { ...MOCK_CONTENTS.result[0], name: 'Mock Story 1 (changed)' },
    ...MOCK_CONTENTS.result.slice(1),
  ],
};

let contentsCalls;

async function open(page) {
  contentsCalls = 0;
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) => {
    contentsCalls += 1;
    route.fulfill({ json: contentsCalls === 1 ? MOCK_CONTENTS : CHANGED_TREE });
  });
  await cacheLitBundle(page);
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await expect.poll(() => contentsCalls).toBe(1);
}

/** Dispatches `name` from the navigation node, like an editing component. */
function dispatchFromNavigationNode(page, name, detail) {
  return page.evaluate(
    ({ eventName, eventDetail }) => {
      const node = document
        .querySelector('app-bookstore')
        .shadowRoot.querySelector('custom-node[data-role="navigation"]');
      node.dispatchEvent(
        new CustomEvent(eventName, {
          detail: eventDetail,
          bubbles: true,
          composed: true,
        })
      );
    },
    { eventName: name, eventDetail: detail }
  );
}

const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile', { hasText: text });
const openModal = (page) => page.locator('#button-navigation_open').click();

test.describe('Navigation modal reload', () => {
  const NODE_CHANGES = [
    ['chapter-created', { chapterData: { id: '000n00000000000099' } }],
    [
      'chapter-updated',
      { chapterData: { id: '000n00000000000002', name: 'Renamed' } },
    ],
    ['node-deleted', { nodeId: '000n00000000000099' }],
    ['published', { recordId: '000n00000000000002', objectName: 'node' }],
    ['unpublished', { recordId: '000n00000000000002', objectName: 'node' }],
  ];

  for (const [name, detail] of NODE_CHANGES) {
    test(`shows the new tree after ${name}`, async ({ page }) => {
      test.fail(true, 'the modal does not reload yet (#202)');
      await open(page);

      await dispatchFromNavigationNode(page, name, detail);
      await openModal(page);

      await expect(tile(page, 'Mock Story 1 (changed)')).toBeVisible();
    });
  }

  test('does not reload when a content was published', async ({ page }) => {
    await open(page);

    await dispatchFromNavigationNode(page, 'published', {
      recordId: '00cn00000000000001',
      objectName: 'content',
    });
    await openModal(page);

    await expect(tile(page, 'Mock Story 1')).toHaveText('Mock Story 1');
    expect(contentsCalls).toBe(1);
  });

  test('keeps the open level when it still exists after the reload', async ({
    page,
  }) => {
    test.fail(true, 'the modal does not reload yet (#202)');
    await open(page);
    await openModal(page);
    await tile(page, 'Mock Story 1').click();
    await expect(tile(page, 'Mock Chapter 2 for Story 1')).toBeVisible();

    await dispatchFromNavigationNode(page, 'chapter-created', {
      chapterData: { id: '000n00000000000099' },
    });

    await expect.poll(() => contentsCalls).toBe(2);
    await expect(tile(page, 'Mock Chapter 2 for Story 1')).toBeVisible();
  });

  test('falls back to the nearest level that still exists', async ({
    page,
  }) => {
    test.fail(true, 'the modal does not reload yet (#202)');
    await open(page);
    await page.unroute('**/api/1.0/contents/**');
    await page.route('**/api/1.0/contents/**', (route) => {
      contentsCalls += 1;
      // Story 1 is gone after the change.
      route.fulfill({ json: { result: MOCK_CONTENTS.result.slice(1) } });
    });
    await openModal(page);
    await tile(page, 'Mock Story 1').click();
    await expect(tile(page, 'Mock Chapter 2 for Story 1')).toBeVisible();

    await dispatchFromNavigationNode(page, 'node-deleted', {
      nodeId: '000n00000000000011',
    });

    await expect(tile(page, 'Mock Story 2')).toBeVisible();
    await expect(
      page.locator('custom-navigation-modal .back-button')
    ).toHaveCount(0);
  });
});
