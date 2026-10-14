const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Going back: one button in the footer of the modal.
 *
 * It is labelled with where it leads — the name of the level above, for the
 * top level "Navigation" — and a long name is cut short. The top level has no
 * way back and so no footer at all: the missing footer says that this is the
 * top of the tree.
 *
 * Going back reports `navigation-level-back` with the level now open (`id`)
 * and the one left (`childId`), so the page behind can show both. Back onto
 * the top level reports nothing: there is no node to show.
 */

const node = (id, name, childnodes = []) => ({
  id,
  label: name,
  name,
  sortnumber: 1,
  childnodes,
});

const LONG_NAME =
  'A very long name of a node that does not fit into a single button ' +
  'however wide the modal may be, and that therefore has to be cut short';

const TREE = {
  result: [
    node('book', 'Book', [node('part', 'Part', [node('section', 'Section')])]),
    node('long', LONG_NAME, [node('mid', 'Mid', [node('leaf', 'Leaf')])]),
  ],
};

async function open(page) {
  await mockBookstoreCallouts(page);
  await page.route('**/api/1.0/contents/**', (route) =>
    route.fulfill({ json: TREE })
  );
  await cacheLitBundle(page);
  await page.addInitScript(() => {
    window.__reported = [];
    for (const name of ['navigation-level-open', 'navigation-level-back']) {
      document.addEventListener(name, (event) =>
        window.__reported.push({ name, ...event.detail })
      );
    }
  });
  // The start page: no location, the modal opens on the top level.
  await page.goto('/');
  await expect(page.locator('app-bookstore')).toBeAttached();
  await page.locator('#button-navigation_open').click();
  await expect(tile(page, 'Book')).toBeVisible();
}

const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile').filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const footer = (page) =>
  page.locator('custom-navigation-modal #modal-navigation .slds-modal__footer');
const back = (page) => page.locator('custom-navigation-modal #button-back');
const reported = (page) => page.evaluate(() => window.__reported);

test.describe('Navigation modal: back in the footer', () => {
  test.use({ actionTimeout: 5000 });

  test('the top level has no footer and no way back', async ({ page }) => {
    await open(page);
    // Reached again from below, to tell "gone" from "never rendered".
    await tile(page, 'Book').click();
    await expect(tile(page, 'Part')).toBeVisible();
    await back(page).click();

    await expect(tile(page, 'Book')).toBeVisible();
    await expect(footer(page)).toHaveCount(0);
    await expect(back(page)).toHaveCount(0);
  });

  test('one level deep the button leads to "Navigation"', async ({ page }) => {
    await open(page);

    await tile(page, 'Book').click();

    await expect(footer(page)).toBeVisible();
    await expect(back(page)).toBeVisible();
    await expect(back(page)).toHaveText('Navigation');
    await expect(back(page)).toHaveAttribute(
      'aria-label',
      'Zurück zu Navigation'
    );
    await expect(back(page)).toHaveAttribute('title', 'Zurück zu Navigation');
  });

  test('deeper it is labelled with the name of the level above', async ({
    page,
  }) => {
    await open(page);
    await tile(page, 'Book').click();

    await tile(page, 'Part').click();

    await expect(tile(page, 'Section')).toBeVisible();
    await expect(back(page)).toHaveText('Book');
    await expect(back(page)).toHaveAttribute('aria-label', 'Zurück zu Book');
  });

  test('it is a neutral SLDS button with a resolving icon', async ({
    page,
  }) => {
    await open(page);

    await tile(page, 'Book').click();

    await expect(back(page)).toHaveClass(/slds-button_neutral/);
    const icon = await back(page)
      .locator('svg use')
      .evaluate((use) => use.href.baseVal);
    expect(icon).toMatch(/utility-sprite\/svg\/symbols\.svg#chevronleft$/);
  });

  test('a long name is cut short and stays inside the footer', async ({
    page,
  }) => {
    await open(page);
    await tile(page, LONG_NAME).click();

    await tile(page, 'Mid').click();

    await expect(tile(page, 'Leaf')).toBeVisible();
    const sizes = await back(page).evaluate((button) => {
      const label = button.querySelector('.slds-truncate');
      // Whatever wraps the button, the outermost element sits in the slot.
      const slotted = button.closest('[slot="footer"]');
      const footer = slotted.assignedSlot.parentElement;
      return {
        cut: label.scrollWidth > label.clientWidth,
        buttonRight: button.getBoundingClientRect().right,
        buttonLeft: button.getBoundingClientRect().left,
        footerRight: footer.getBoundingClientRect().right,
        footerLeft: footer.getBoundingClientRect().left,
      };
    });
    expect(sizes.cut).toBe(true);
    expect(sizes.buttonLeft).toBeGreaterThanOrEqual(sizes.footerLeft);
    expect(sizes.buttonRight).toBeLessThanOrEqual(sizes.footerRight);
  });

  test('a click goes up exactly one level', async ({ page }) => {
    await open(page);
    await tile(page, 'Book').click();
    await tile(page, 'Part').click();
    await expect(tile(page, 'Section')).toBeVisible();

    await back(page).click();

    await expect(tile(page, 'Part')).toBeVisible();
    await expect(tile(page, 'Book')).toHaveCount(0);
  });

  test('going back reports the level now open and the one left', async ({
    page,
  }) => {
    await open(page);
    await tile(page, 'Book').click();
    await tile(page, 'Part').click();
    await expect(tile(page, 'Section')).toBeVisible();

    await back(page).click();

    await expect(tile(page, 'Part')).toBeVisible();
    expect(await reported(page)).toEqual([
      { name: 'navigation-level-open', id: 'book' },
      { name: 'navigation-level-open', id: 'part' },
      { name: 'navigation-level-back', id: 'book', childId: 'part' },
    ]);
  });

  test('going back onto the top level reports nothing', async ({ page }) => {
    await open(page);
    await tile(page, 'Book').click();
    await expect(tile(page, 'Part')).toBeVisible();

    await back(page).click();

    await expect(tile(page, 'Book')).toBeVisible();
    expect(await reported(page)).toEqual([
      { name: 'navigation-level-open', id: 'book' },
    ]);
  });
});
