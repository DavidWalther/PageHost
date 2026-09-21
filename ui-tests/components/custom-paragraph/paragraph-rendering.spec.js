const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  respondWithContent,
  textContentRecord,
  CONTENT_ID,
} = require('../../support/paragraph-editor');

/**
 * Welche Fassung eines Inhalts angezeigt wird.
 *
 * Der Datensatz **benennt** sie (`active_type`, im Modell
 * `content_node.active_content_item`) — die alte Regel „html gewinnt, sobald
 * gefüllt" ist nur noch Rückfall für Datensätze ohne diesen Zeiger.
 *
 * Festgehalten wird hier der Unterschied im Ergebnis, nicht das Markup: Die
 * Text-Fassung zeigt den Namen als Überschrift und bricht an `\n` um, die
 * HTML-Fassung liefert das Markup des Datensatzes und **keinen** Namen.
 */

test.describe('custom-paragraph: angezeigte Fassung', () => {
  test('active_type "html" zeigt das Markup und keinen Namen', async ({
    page,
  }) => {
    await openBookstore(page);

    const content = paragraph(page, CONTENT_ID).locator('#content');
    await expect(content).toContainText('Lorem ipsum dolor sit amet');
    // Das <p> stammt aus dem HTML-Item, nicht aus dem Text-Renderer.
    await expect(content.locator('p')).toHaveCount(1);
    await expect(content.locator('b')).toHaveCount(0);
  });

  test('active_type "text" zeigt den Namen fett und bricht an \\n um', async ({
    page,
  }) => {
    await openBookstore(page);
    await respondWithContent(page, textContentRecord());
    await page.reload();

    const content = paragraph(page, CONTENT_ID).locator('#content');
    await expect(content.locator('b')).toHaveText(
      'Mock Paragraph 1 for Chapter 1 of Story 1'
    );
    await expect(content).toContainText('Erste Zeile');
    await expect(content).toContainText('Zweite Zeile');
    await expect(content.locator('br')).toHaveCount(3);
  });

  test('ohne active_type gewinnt die HTML-Fassung, solange sie gefüllt ist', async ({
    page,
  }) => {
    await openBookstore(page);
    await respondWithContent(page, {
      ...textContentRecord(),
      active_type: null,
      active_content_item: null,
      items: [
        { id: '00ci00000000000001', type: 'text', content: 'Nur Text' },
        {
          id: '00ci00000000000002',
          type: 'html',
          content: '<p>Aus der HTML-Fassung</p>',
        },
      ],
    });
    await page.reload();

    const content = paragraph(page, CONTENT_ID).locator('#content');
    await expect(content).toContainText('Aus der HTML-Fassung');
    await expect(content).not.toContainText('Nur Text');
  });
});
