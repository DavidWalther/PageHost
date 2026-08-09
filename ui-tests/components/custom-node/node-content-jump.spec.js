const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Der Sprung zu einem Inhalt — und was passiert, wenn er nicht fertig wird.
 *
 * `custom-node` versteckt seine Karte (`?hidden=${this._scrollPending}`),
 * solange die Inhalte **vor** dem Sprungziel noch laden: Sonst springt die
 * Seite ins Leere. Sichtbar wird sie wieder, wenn der letzte davon `loaded`
 * meldet und das Zählwerk auf null steht.
 *
 * Das Zählwerk gehört damit zum **aktuellen** Knoten. Bleibt ein Rest darin
 * stehen und wird der Knoten gewechselt, bliebe die Karte des **nächsten**
 * Knotens verborgen — ohne dass irgendetwas an ihm falsch wäre.
 */

const INHALTE = [1, 2, 3, 4, 5].map((nummer) => ({
  id: `00cn0000000000009${nummer}`,
  name: `Absatz ${nummer}`,
  sortnumber: nummer,
  published_date: '2022-01-01 00:00:00',
}));

/** Der erste Absatz antwortet nie — die Anfrage bleibt offen. */
const NIE_ANTWORTENDER_INHALT = INHALTE[0].id;

const navigationNode = (page) =>
  page.locator('custom-node[data-role="navigation"]');
const contentNode = (page) => page.locator('custom-node[data-role="content"]');

test.describe('Knoten: ein Sprung, der nicht fertig wird', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);

    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const base = Object.values(MOCK_NODES).find(
        (node) => node.id === id || node.legacy_id === id
      );
      if (!base) return route.fulfill({ json: {} });
      // Nur das erste Kind bekommt die lange Inhaltsliste; das zweite bleibt
      // leer, damit der Wechsel dorthin nichts nachladen muss.
      const contents =
        base.id === MOCK_NODES.kind1.id ? INHALTE : base.contents;
      return route.fulfill({ json: { ...base, contents } });
    });

    await page.route('**/data/query/content**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      // Bewusst weder erfüllt noch abgebrochen: Die Anfrage bleibt offen, der
      // Absatz meldet nie `loaded`, und das Zählwerk kommt nie auf null.
      if (id === NIE_ANTWORTENDER_INHALT) return;
      const match = INHALTE.find((inhalt) => inhalt.id === id);
      if (!match) return route.fulfill({ json: {} });
      return route.fulfill({
        json: {
          ...match,
          node_id: MOCK_NODES.kind1.id,
          active_type: 'text',
          items: [{ id: `${match.id}-t`, type: 'text', content: match.name }],
        },
      });
    });

    await page.goto('/000c00000000000001?paragraphnumber=3');
    await expect(navigationNode(page).locator('#node-name')).toHaveText(
      'Mock Story 1'
    );
  });

  test('der Knoten wartet, solange ein Inhalt davor fehlt', async ({
    page,
  }) => {
    // Ausgangslage des Tests unten: Der Sprung steht, weil ein Absatz vor dem
    // Ziel nie ankommt. Bricht diese Zusicherung, prüft der zweite Test nichts
    // mehr — dann wäre gar kein Rest da, der überdauern könnte.
    await expect(contentNode(page).locator('slds-progress-bar')).toHaveCount(1);
    await expect(contentNode(page).locator('slds-card')).toBeHidden();
  });

  test('nach dem Wechsel ist der nächste Knoten sichtbar', async ({ page }) => {
    await navigationNode(page)
      .locator('button[data-node-id="000n00000000000002"]')
      .click();

    await expect(contentNode(page).locator('#node-name')).toHaveText(
      'Mock Chapter 2 for Story 1'
    );
    // Der Zählstand des vorigen Knotens darf diesen hier nicht verstecken.
    await expect(contentNode(page).locator('slds-card')).toBeVisible();
    await expect(contentNode(page).locator('slds-progress-bar')).toHaveCount(0);
  });
});
