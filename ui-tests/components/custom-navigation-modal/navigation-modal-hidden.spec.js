const { test, expect } = require('@playwright/test');
const { MOCK_CONTENTS } = require('../../support/mock-callouts');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * Leaving nodes out of the navigation modal: `hidden-ids`.
 *
 * Every node named there is left out together with everything below it — no
 * tile, and no level that could be opened. That is what keeps a marked node
 * from becoming its own new parent. A level that runs through a left-out
 * node ends just before it.
 */

const [STORY_1, STORY_2] = MOCK_CONTENTS.result;
const [CHAPTER_1, CHAPTER_2] = STORY_1.childnodes;

/**
 * Mounts the modal on its own: in the application the host owns
 * `hidden-ids` and would set it back on its next render. The tree is handed
 * in here, as the application does.
 */
async function open(page, { location = null } = {}) {
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ location, tree }) => {
      await import('/slds-components/slds-modal/slds-modal.js');
      await import('/slds-components/slds-layout/slds-layout.js');
      await import('/slds-components/slds-layout/slds-layout-item.js');
      await import('/slds-components/slds-button-icon/slds-button-icon.js');
      await import('/components/custom-navigation-modal/custom-navigation-modal.js');
      const modal = document.createElement('custom-navigation-modal');
      modal.tree = tree;
      if (location) {
        modal.setAttribute('current-location', location);
      }
      document.body.appendChild(modal);
      await modal.updateComplete;
    },
    { location, tree: MOCK_CONTENTS.result }
  );
}

/** Sets hidden-ids on the modal, as an attribute holding a JSON list. */
const hide = (page, ids) =>
  page.evaluate(async (ids) => {
    const modal = document.querySelector('custom-navigation-modal');
    modal.setAttribute('hidden-ids', JSON.stringify(ids));
    await modal.updateComplete;
  }, ids);

const showModal = (page) =>
  page.evaluate(() => document.querySelector('custom-navigation-modal').show());

const tiles = (page) => page.locator('custom-navigation-modal button.tile');
const tile = (page, text) =>
  tiles(page).filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const back = (page) => page.locator('custom-navigation-modal #button-back');

test.describe('Navigation modal: hidden-ids', () => {
  test.use({ actionTimeout: 5000 });

  test('leaves out a node on the top level', async ({ page }) => {
    await open(page);
    await hide(page, [STORY_1.id]);

    await showModal(page);

    await expect(tile(page, STORY_2.name)).toBeVisible();
    await expect(tile(page, STORY_1.name)).toHaveCount(0);
  });

  test('leaves out a node on an opened level', async ({ page }) => {
    await open(page);
    await hide(page, [CHAPTER_1.id]);
    await showModal(page);

    await tile(page, STORY_1.name).click();

    await expect(tile(page, CHAPTER_2.name)).toBeVisible();
    await expect(tile(page, CHAPTER_1.name)).toHaveCount(0);
  });

  test('opens on the level before a left-out node', async ({ page }) => {
    // The location lies below the left-out node: its level cannot be opened.
    await open(page, { location: CHAPTER_1.id });
    await hide(page, [STORY_1.id]);

    await showModal(page);

    await expect(tile(page, STORY_2.name)).toBeVisible();
    await expect(back(page)).toHaveCount(0);
  });

  test('a left-out location still opens among its siblings', async ({
    page,
  }) => {
    // The marked node is usually the one shown: the modal opens next to it.
    await open(page, { location: CHAPTER_1.id });
    await hide(page, [CHAPTER_1.id]);

    await showModal(page);

    await expect(tile(page, CHAPTER_2.name)).toBeVisible();
    await expect(back(page)).toBeVisible();
  });

  test('without hidden-ids every node is shown', async ({ page }) => {
    await open(page);
    await hide(page, []);

    await showModal(page);

    await expect(tile(page, STORY_1.name)).toBeVisible();
    await expect(tile(page, STORY_2.name)).toBeVisible();
  });
});
