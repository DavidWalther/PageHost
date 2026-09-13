const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Aufbau der Actions-Leiste von `custom-node`.
 *
 * Die Leiste im Kopf der Karte hält je Aktion ein eigenes Grid-Element. Jedes
 * ist nur so breit wie sein Inhalt plus Gutter — die Elemente wachsen nicht,
 * sonst verteilten sich die Buttons über die ganze Kartenbreite.
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

const ROLES = {
  navigation: 'Mock Story 1',
  content: 'Mock Chapter 1 for Story 1',
};

const nodeByRole = (page, role) =>
  page.locator(`custom-node[data-role="${role}"]`);

// Einstieg über einen Kind-Knoten: beide Instanzen haben Aktionen.
const ENTRY = '/000c00000000000001';

// Die IDs der Aktionen — stabil, egal wie das Grid darum gebaut ist.
const ACTION_IDS = [
  'node-create-child',
  'node-edit',
  'button-share',
  'button-create-content',
  'button-delete',
];

// Gutter der Leiste: 2px je Seite.
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
    for (const [role, name] of Object.entries(ROLES)) {
      await expect(nodeByRole(page, role).locator('#node-name')).toHaveText(
        name
      );
    }
  });

  for (const role of Object.keys(ROLES)) {
    test(`${role}: die Leiste ist ein umbrechender Flex-Container`, async ({
      page,
    }) => {
      const actions = await readActions(nodeByRole(page, role));
      expect(actions.display).toBe('flex');
      expect(actions.flexWrap).toBe('wrap');
    });

    test(`${role}: jede Aktion steht in einem eigenen Element`, async ({
      page,
    }) => {
      const actions = await readActions(nodeByRole(page, role));
      const placed = actions.items.flatMap((item) => item.ids);

      expect(actions.items.every((item) => item.ids.length <= 1)).toBe(true);
      expect([...placed].sort()).toEqual([...actions.present].sort());
    });

    test(`${role}: kein Element ist breiter als sein Inhalt plus Gutter`, async ({
      page,
    }) => {
      const actions = await readActions(nodeByRole(page, role));
      expect(actions.items.length).toBeGreaterThan(0);
      for (const item of actions.items) {
        expect(item.width).toBeLessThanOrEqual(
          item.contentWidth + GUTTER + 0.5
        );
      }
    });
  }
});
