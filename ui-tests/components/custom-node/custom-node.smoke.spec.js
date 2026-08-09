const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Smoke-Test der zusammengeführten Knoten-Darstellung.
 *
 * Geprüft wird der Weg durch den `bookstore`: Beide Rollen sind **dieselbe**
 * Komponente, der obere Knoten zeigt eine Auswahl, der untere die Inhalte des
 * gewählten Kindes, und ein Klick oben schaltet unten um. Bricht das, stünde
 * entweder eine leere Auswahlleiste da oder die Inhalte fehlten.
 *
 * **Nicht** geprüft wird hier die Trennung der Rollen. Dass der obere Knoten
 * keine Inhalte und der untere keine Auswahl rendert, folgt aus den Attributen,
 * die der `bookstore` setzt — nicht aus den Mockdaten, in denen ohnehin nur der
 * eine Kinder und nur der andere Inhalte hat. Was die Rollen unterscheidet,
 * hält `node-role-capabilities.spec.js` fest, mit Daten, die beides tragen.
 */

/** Liest den Zustand beider Knoten aus dem Shadow-DOM. */
async function readNodes(page) {
  return page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    const read = (role) => {
      const element = app.shadowRoot.querySelector(
        `custom-node[data-role="${role}"]`
      );
      if (!element) return null;
      const root = element.shadowRoot;
      return {
        recordId: element.getAttribute('id'),
        name: root.querySelector('#node-name')?.textContent?.trim() ?? null,
        childButtons: [
          ...root.querySelectorAll('#child-navigation button'),
        ].map((button) => button.textContent.trim()),
        hasNavigation: !!root.querySelector('#child-navigation'),
        contentIds: [...root.querySelectorAll('custom-paragraph')].map(
          (element) => element.id
        ),
      };
    };
    return { navigation: read('navigation'), content: read('content') };
  });
}

test.describe('custom-node', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();
  });

  test('der obere Knoten zeigt seine Kinder zur Auswahl', async ({ page }) => {
    await expect
      .poll(async () => (await readNodes(page)).navigation?.name)
      .toBe('Mock Story 1');

    const { navigation } = await readNodes(page);
    expect(navigation.childButtons).toEqual([
      'Mock Chapter 1 for Story 1',
      'Mock Chapter 2 for Story 1',
    ]);
    // Keine Inhalte oben — hier ohnehin doppelt abgesichert: Der Mock-Knoten
    // hat keine, und `no-contents` würde sie auch sonst nicht zeigen.
    expect(navigation.contentIds).toEqual([]);
  });

  test('der untere Knoten zeigt Inhalte und keine Auswahl', async ({
    page,
  }) => {
    // Er wird über `cover_node_id` des oberen Knotens gesetzt.
    await expect
      .poll(async () => (await readNodes(page)).content?.contentIds.length)
      .toBeGreaterThan(0);

    const { content } = await readNodes(page);
    expect(content.recordId).toBe('000n00000000000001');
    expect(content.contentIds).toEqual(['00cn00000000000001']);
    // Keine Auswahl unten. Der Mock-Knoten hat keine Kinder; dass sie auch
    // dann nicht erschiene, wenn er welche hätte, prüft die Rollen-Spec.
    expect(content.hasNavigation).toBe(false);
  });

  test('der Inhalt wird in seiner aktiven Fassung angezeigt', async ({
    page,
  }) => {
    // Der `content`-Endpunkt liefert alle Repräsentationen und den Zeiger auf
    // die aktive (hier `html`). Wird der Zeiger ignoriert, stünde hier der
    // reine Text.
    const paragraph = page.locator(
      'custom-node[data-role="content"] custom-paragraph'
    );

    await expect(paragraph.locator('#content p')).toHaveCount(1);
    await expect(paragraph.locator('#content')).toContainText(
      'Lorem ipsum dolor sit amet'
    );
  });

  test('ein Klick auf ein Kind schaltet den unteren Knoten um', async ({
    page,
  }) => {
    await expect
      .poll(async () => (await readNodes(page)).navigation?.childButtons.length)
      .toBe(2);

    await page.evaluate(() => {
      const app = document.querySelector('app-bookstore');
      const navigation = app.shadowRoot.querySelector(
        'custom-node[data-role="navigation"]'
      );
      navigation.shadowRoot
        .querySelector('button[data-node-id="000n00000000000002"]')
        .click();
    });

    // Der Consumer hört auf `navigation` mit `type: 'node'`.
    await expect
      .poll(async () => (await readNodes(page)).content?.recordId)
      .toBe('000n00000000000002');

    const { navigation, content } = await readNodes(page);
    expect(navigation.name).toBe('Mock Story 1');
    // Kapitel 2 hat im Mock keine Inhalte — der Hinweis tritt an ihre Stelle.
    expect(content.contentIds).toEqual([]);
  });
});
