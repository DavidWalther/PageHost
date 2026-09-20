const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  editTrigger,
  triggerDelete,
} = require('../../support/paragraph-editor');

/**
 * Der Knoten räumt auf, wenn ein Inhalt gelöscht wird.
 *
 * Vorher nahm sich der Absatz nur selbst aus dem Dokument. Der umgebende
 * `div.content-container` blieb als leere Hülle stehen — samt seiner Abstände —
 * und die Inhaltsliste des Knotens kannte den Inhalt weiter. Beim eigenen
 * Löschen macht der Knoten es längst anders (`node-deleted`).
 *
 * Maßgeblich ist die **Liste**, nicht das DOM: Der Knoten nimmt den Inhalt aus
 * seinen Daten, und das Rendering folgt. Ein Container, den man von Hand aus dem
 * DOM schneidet, käme beim nächsten Rendern zurück.
 */

/** Der untere Knoten — der mit den Inhalten. */
function contentNode(page) {
  return page.locator('custom-node[data-role="content"]');
}

test.describe('custom-node: gelöschter Inhalt', () => {
  test('der leere Container verschwindet mit dem Absatz', async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });

    const knoten = contentNode(page);
    await expect(knoten.locator('.content-container')).toHaveCount(1);

    await page.route('**/api/1.0/data/delete**', (route) =>
      route.fulfill({ json: { success: true } })
    );
    page.on('dialog', (dialog) => dialog.accept());

    await triggerDelete(paragraph(page));

    await expect(knoten.locator('custom-paragraph')).toHaveCount(0);
    await expect(knoten.locator('.content-container')).toHaveCount(0);
  });

  test('ohne Inhalte sagt der Knoten es auch', async ({ page }) => {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });

    await page.route('**/api/1.0/data/delete**', (route) =>
      route.fulfill({ json: { success: true } })
    );
    page.on('dialog', (dialog) => dialog.accept());

    await triggerDelete(paragraph(page));

    // Der Mock-Knoten hat keine Kinder — bleibt kein Inhalt, ist der Hinweis
    // die einzig richtige Aussage.
    await expect(knotenHinweis(page)).toBeVisible();
  });
});

function knotenHinweis(page) {
  return contentNode(page).locator('#no-contents');
}

/**
 * Löschen **mitten in einer Liste**.
 *
 * Die gemeinsame Fixture hält genau einen Inhalt — damit sieht jeder Weg gut
 * aus, denn nach dem Löschen ist die Liste leer. Erst mit mehreren Inhalten
 * zeigt sich, ob die **übrigen** danach noch stimmen. Dieser Spec stellt dafür
 * eigene Antworten zu (die Fixture selbst bleibt unangetastet: die Smoke-Spec
 * prüft ihre Inhalts-Ids exakt).
 *
 * Zwei Dinge gingen hier schief, und beide sieht man nur mit mehr als einem
 * Inhalt:
 *
 * 1. Der Absatz nahm sich mit `remove()` selbst aus einer Liste, die **Lit**
 *    rendert. Danach stimmte deren Buchführung nicht mehr, und beim nächsten
 *    Rendern verschwand ein unbeteiligter Nachbar gleich mit.
 * 2. Lit setzt Listen ohne Schlüssel über den **Index** zusammen: Beim Löschen
 *    in der Mitte werden die vorhandenen Elemente neu zugeteilt, statt
 *    verschoben zu werden. Wer darauf nicht reagiert, zeigt weiter den Text
 *    seines Vorgängers — und sein Editor arbeitet auf einem Datensatz, der
 *    nicht mehr in der Liste steht.
 */
test.describe('custom-node: gelöschter Inhalt in einer Liste', () => {
  const IDS = [
    '00cn00000000000001',
    '00cn00000000000002',
    '00cn00000000000003',
  ];

  /** Drei Inhalte am Kapitel-Knoten, je mit eigenem Text. */
  async function dreiInhalte(page) {
    await page.route('**/data/query/node**', (route) =>
      route.fulfill({
        json: {
          id: '000n00000000000001',
          legacy_id: '000c00000000000001',
          name: 'Kapitel',
          sortnumber: 1,
          reversed: null,
          parent_node_id: '000n00000000000011',
          cover_node_id: null,
          published_date: '2022-01-01 00:00:00',
          nodes: [],
          contents: IDS.map((id, index) => ({
            id,
            name: 'Absatz ' + (index + 1),
            sortnumber: index + 1,
            published_date: '2022-01-01 00:00:00',
          })),
        },
      })
    );
    await page.route('**/data/query/content**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const nummer = IDS.indexOf(id) + 1;
      return route.fulfill({
        json: {
          id,
          name: 'Absatz ' + nummer,
          sortnumber: nummer,
          published_date: '2022-01-01 00:00:00',
          node_id: '000n00000000000001',
          active_type: 'text',
          items: [
            {
              id: 'item' + nummer,
              type: 'text',
              content: 'Inhalt von Absatz ' + nummer,
            },
          ],
        },
      });
    });
  }

  /** Was der Knoten zeigt: je Absatz seine Id und sein Text. */
  function angezeigt(page) {
    return page.evaluate(() => {
      const app = document.querySelector('app-bookstore');
      const node = app.shadowRoot.querySelector(
        'custom-node[data-role="content"]'
      );
      return [...node.shadowRoot.querySelectorAll('custom-paragraph')].map(
        (element) => ({
          id: element.getAttribute('id'),
          text: (
            element.shadowRoot.querySelector('#content')?.textContent || ''
          )
            .replace(/\s+/g, ' ')
            .trim(),
        })
      );
    });
  }

  async function oeffneMitDreiInhalten(page) {
    await openBookstore(page, { scopes: ['read', 'edit', 'delete'] });
    await dreiInhalte(page);
    await page.reload();
    await expect.poll(() => angezeigt(page).then((l) => l.length)).toBe(3);

    await page.route('**/api/1.0/data/delete**', (route) =>
      route.fulfill({ json: { success: true } })
    );
    page.on('dialog', (dialog) => dialog.accept());
  }

  const FAELLE = [
    { name: 'der erste', index: 0, bleibt: [2, 3] },
    { name: 'der mittlere', index: 1, bleibt: [1, 3] },
    { name: 'der letzte', index: 2, bleibt: [1, 2] },
  ];

  for (const fall of FAELLE) {
    test(`${fall.name} Absatz geht, die übrigen bleiben sie selbst`, async ({
      page,
    }) => {
      await oeffneMitDreiInhalten(page);

      await triggerDelete(paragraph(page, IDS[fall.index]));

      await expect
        .poll(() => angezeigt(page))
        .toEqual(
          fall.bleibt.map((nummer) => ({
            id: IDS[nummer - 1],
            text: 'Absatz ' + nummer + ' Inhalt von Absatz ' + nummer,
          }))
        );
    });
  }

  test('für den gelöschten Inhalt lässt sich kein Editor mehr öffnen', async ({
    page,
  }) => {
    await oeffneMitDreiInhalten(page);

    await triggerDelete(paragraph(page, IDS[1]));

    // Genau das ging vorher: Der Absatz stand noch da, sein Editor ließ sich
    // öffnen, und das Speichern lief beim Backend auf einen Datensatz, den es
    // nicht mehr gibt.
    await expect(paragraph(page, IDS[1])).toHaveCount(0);
    await expect(editTrigger(paragraph(page, IDS[1]))).toHaveCount(0);
  });
});
