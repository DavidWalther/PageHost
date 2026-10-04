const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Aufbau der Actions-Leiste von `custom-node`.
 *
 * Die Leiste im Kopf der Karte hält je Aktion ein eigenes Grid-Element mit
 * `xxx-small`-Gutter (2px je Seite): Jedes Element ist genau so breit wie seine
 * Aktion plus 4px.
 *
 * Ob die Elemente wachsen dürften, prüft dieser Spec **nicht** — hier könnten
 * sie es gar nicht: `slds-card` legt den Actions-Slot in ein inhaltsbreites
 * `slds-no-flex`-Element, das Grid hat also keinen freien Platz.
 *
 * Die Zusicherungen sind bewusst **strukturneutral**: Sie greifen auf die Kinder
 * des `[slot="actions"]`-Elements und deren Rechtecke zu, nicht auf bestimmte
 * Tags oder Klassen. So gelten sie unabhängig davon, womit das Grid gebaut ist.
 */

const SESSION_SCOPES = ['read', 'edit', 'create', 'delete'];

/** Attrappen-JWT mit ferner Ablaufzeit — clientseitig wird er nicht geprüft. */
function fakeJwt() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

async function withSession(page, scopes = SESSION_SCOPES) {
  await page.addInitScript(
    ([token, sessionScopes]) => {
      sessionStorage.setItem(
        'code_exchange_response',
        JSON.stringify({
          authenticationResult: {
            access: { access_token: token, scopes: sessionScopes },
          },
        })
      );
    },
    [fakeJwt(), scopes]
  );
}

// The one node on the page carries every action.
const node = (page) => page.locator('app-bookstore custom-node');

const ENTRY = '/000c00000000000001';

// Die IDs der Aktionen — stabil, egal wie das Grid darum gebaut ist.
const ACTION_IDS = [
  'node-create-child',
  'node-edit',
  'button-share',
  'button-create-content',
  'button-delete',
];

// Gutter der Leiste: slds-gutters_xxx-small, 2px je Seite.
const GUTTER = 4;

function readActions(node) {
  return node.evaluate((host, ids) => {
    const actions = host.shadowRoot.querySelector('[slot="actions"]');
    const style = getComputedStyle(actions);
    const items = [...actions.children].map((item) => {
      const contained = [...item.querySelectorAll('[id]')].filter((el) =>
        ids.includes(el.id)
      );
      return {
        width: item.getBoundingClientRect().width,
        ids: contained.map((el) => el.id),
        contentWidth: Math.max(
          0,
          ...contained.map((el) => el.getBoundingClientRect().width)
        ),
      };
    });
    const present = ids.filter((id) => host.shadowRoot.getElementById(id));
    return { display: style.display, flexWrap: style.flexWrap, items, present };
  }, ACTION_IDS);
}

test.describe('Knoten: Aufbau der Actions-Leiste', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await withSession(page);
    await page.goto(ENTRY);
    await expect(node(page).locator('#node-name')).toHaveText(
      'Mock Chapter 1 for Story 1'
    );
  });

  test('the bar is a wrapping flex container', async ({ page }) => {
    const actions = await readActions(node(page));
    expect(actions.display).toBe('flex');
    expect(actions.flexWrap).toBe('wrap');
  });

  test('every action sits in its own element', async ({ page }) => {
    const actions = await readActions(node(page));
    const placed = actions.items.flatMap((item) => item.ids);

    expect(actions.items.every((item) => item.ids.length <= 1)).toBe(true);
    expect([...placed].sort()).toEqual([...actions.present].sort());
    // With every scope the one node offers every action except creating a
    // child, which waits for the "+" tile in the navigation modal (#187).
    expect([...actions.present].sort()).toEqual(
      ACTION_IDS.filter((id) => id !== 'node-create-child').sort()
    );
  });

  test('every element is as wide as its action plus the 4px gutter', async ({
    page,
  }) => {
    const actions = await readActions(node(page));
    expect(actions.items.length).toBeGreaterThan(0);
    for (const item of actions.items) {
      expect(
        Math.abs(item.width - (item.contentWidth + GUTTER))
      ).toBeLessThanOrEqual(0.5);
    }
  });
});
