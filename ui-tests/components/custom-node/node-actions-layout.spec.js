const { test, expect } = require('@playwright/test');
const { MOCK_NODES } = require('../../support/mock-callouts');
const { mountNode } = require('../../support/node-mount');

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

/**
 * Two ways to set the node up — the attributes the page once gave its two
 * nodes, a selection above and a node with contents below. The node is
 * mounted on its own; the page now shows its node through custom-node-view.
 */
const ROLES = {
  navigation: {
    node: { ...MOCK_NODES.wurzel, contents: [] },
    attrs: {
      'child-buttons_number-max': 2,
      'can-create-child': true,
      'can-move-root': true,
      'no-contents': true,
    },
  },
  content: {
    node: MOCK_NODES.kind1,
    attrs: {
      'can-create-content': true,
      'can-delete': true,
      'can-move': true,
      'no-child-navigation': true,
    },
  },
};

const mountRole = (page, role, scopes) =>
  mountNode(page, { ...ROLES[role], scopes });

// Die IDs der Aktionen — stabil, egal wie das Grid darum gebaut ist.
const ACTION_IDS = [
  'node-publish',
  'node-create-child',
  'node-edit',
  'button-share',
  'button-create-content',
  'node-move',
  'node-delete',
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
  for (const role of Object.keys(ROLES)) {
    test(`${role}: die Leiste ist ein umbrechender Flex-Container`, async ({
      page,
    }) => {
      const actions = await readActions(
        await mountRole(page, role, SESSION_SCOPES)
      );
      expect(actions.display).toBe('flex');
      expect(actions.flexWrap).toBe('wrap');
    });

    test(`${role}: jede Aktion steht in einem eigenen Element`, async ({
      page,
    }) => {
      const actions = await readActions(
        await mountRole(page, role, SESSION_SCOPES)
      );
      const placed = actions.items.flatMap((item) => item.ids);

      expect(actions.items.every((item) => item.ids.length <= 1)).toBe(true);
      expect([...placed].sort()).toEqual([...actions.present].sort());
    });

    test(`${role}: jedes Element ist so breit wie seine Aktion plus 4px Gutter`, async ({
      page,
    }) => {
      const actions = await readActions(
        await mountRole(page, role, SESSION_SCOPES)
      );
      expect(actions.items.length).toBeGreaterThan(0);
      for (const item of actions.items) {
        expect(
          Math.abs(item.width - (item.contentWidth + GUTTER))
        ).toBeLessThanOrEqual(0.5);
      }
    });
  }
});

/**
 * Leere Elemente: Eine Aktion, deren Button wegen der Rolle oder eines fehlenden
 * Scopes nicht erscheint, bekommt auch kein Element — sonst bliebe ein leerer
 * Rahmen mit 4px Gutter als Lücke in der Leiste stehen.
 */
const ONLY_VISIBLE = [
  {
    name: 'ohne Sitzung',
    scopes: null,
    expected: { navigation: ['button-share'], content: ['button-share'] },
  },
  {
    name: 'nur Scope read',
    scopes: ['read'],
    expected: { navigation: ['button-share'], content: ['button-share'] },
  },
  {
    name: 'nur Scope edit',
    scopes: ['edit'],
    expected: {
      // The node above is a root here, so it offers the mark as well.
      navigation: ['node-edit', 'button-share', 'node-move'],
      content: ['node-edit', 'button-share', 'node-move'],
    },
  },
  {
    name: 'alle Scopes',
    scopes: SESSION_SCOPES,
    expected: {
      navigation: [
        'node-create-child',
        'node-edit',
        'button-share',
        'node-move',
      ],
      content: [
        'node-edit',
        'button-share',
        'button-create-content',
        'node-move',
        'node-delete',
      ],
    },
  },
];

test.describe('Knoten: Actions-Leiste ohne leere Elemente', () => {
  for (const scenario of ONLY_VISIBLE) {
    for (const role of Object.keys(ROLES)) {
      test(`${scenario.name}: ${role} hat nur Elemente mit sichtbarer Aktion`, async ({
        page,
      }) => {
        const actions = await readActions(
          await mountRole(page, role, scenario.scopes)
        );
        expect(actions.items.every((item) => item.contentWidth > 0)).toBe(true);
        expect(actions.items.map((item) => item.ids[0])).toEqual(
          scenario.expected[role]
        );
      });
    }
  }
});
