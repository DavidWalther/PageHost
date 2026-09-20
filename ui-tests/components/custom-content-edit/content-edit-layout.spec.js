const { test, expect } = require('@playwright/test');
const {
  openBookstore,
  paragraph,
  openEditor,
} = require('../../support/paragraph-editor');

/**
 * Platz und Umbruch im Textfeld des Editors.
 *
 * **App-Test, nicht Komponententest:** Geprüft wird Geometrie, und die entsteht
 * erst aus den SLDS-Regeln des Modals. Auf der leeren Komponentenseite stimmen
 * die Maße nicht — dort wäre das Ergebnis eine Zusage über nichts.
 *
 * Das Modal hat zwei Gestalten, und das Textfeld muss in beiden wachsen:
 * unterhalb von 30em ein Vollbild-Grid mit aufgelöster Höhe, darüber ein
 * Dialog, dessen Inhaltsbereich sich nach seinem Inhalt richtet.
 */

/** Maße des Textfelds und seiner Nachbarn im geöffneten Modal. */
function geometry(page) {
  return page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    const node = app.shadowRoot.querySelector(
      'custom-node[data-role="content"]'
    );
    const editor = node.shadowRoot
      .querySelector('custom-paragraph')
      .shadowRoot.querySelector('custom-content-edit');
    const root = editor.shadowRoot;
    const height = (selector, from = root) => {
      const element = from.querySelector(selector);
      return element ? Math.round(element.getBoundingClientRect().height) : 0;
    };
    const modalRoot = root.querySelector('slds-modal').shadowRoot;

    return {
      viewport: window.innerHeight,
      content: height('.slds-modal__content', modalRoot),
      editor: height('#editor'),
      // Die Formularzeile ist das erste Element der Spalte; sie trägt keinen
      // eigenen Namen, weil die Anordnung dem Layout-Baukasten gehört.
      fields: height('#editor > slds-layout-item'),
      draftBar: height('.draft-bar'),
      textarea: height('#content-input'),
    };
  });
}

/** Zustand des Textfelds: umbricht es, und muss es waagerecht scrollen? */
function wrapState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    const node = app.shadowRoot.querySelector(
      'custom-node[data-role="content"]'
    );
    const field = node.shadowRoot
      .querySelector('custom-paragraph')
      .shadowRoot.querySelector('custom-content-edit')
      .shadowRoot.querySelector('#content-input');

    return {
      whiteSpace: getComputedStyle(field).whiteSpace,
      scrollsSideways: field.scrollWidth > field.clientWidth,
      value: field.value,
    };
  });
}

/** Den Schalter umlegen — sein Input liegt im ShadowDOM von `slds-toggle`. */
function toggleWrap(page) {
  return page.evaluate(() => {
    const app = document.querySelector('app-bookstore');
    const node = app.shadowRoot.querySelector(
      'custom-node[data-role="content"]'
    );
    node.shadowRoot
      .querySelector('custom-paragraph')
      .shadowRoot.querySelector('custom-content-edit')
      .shadowRoot.querySelector('slds-toggle')
      .shadowRoot.querySelector('input[type="checkbox"]')
      .click();
  });
}

async function openTheEditor(page) {
  await openBookstore(page, { scopes: ['read', 'edit'] });
  await openEditor(paragraph(page));
  await expect(
    paragraph(page).locator('custom-content-edit .slds-modal')
  ).toBeVisible();
}

test.describe('custom-content-edit: Platz für den Text', () => {
  test('das Textfeld nimmt mindestens 40% der Fensterhöhe ein', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTheEditor(page);

    const maße = await geometry(page);
    // Oberhalb von 30em hat der Inhaltsbereich keine aufgelöste Höhe — ein
    // Prozentwert hätte dort nichts, worauf er sich bezieht. Die Mindesthöhe
    // ist deshalb am Fenster bemessen, nicht an einer Zeilenzahl.
    expect(maße.textarea).toBeGreaterThanOrEqual(
      Math.round(maße.viewport * 0.4) - 8
    );
  });

  test('das Textfeld bekommt mehr Platz als alles andere zusammen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTheEditor(page);

    const maße = await geometry(page);
    expect(maße.textarea).toBeGreaterThan(maße.fields + maße.draftBar);
  });

  test('im Vollbild füllt der Editor den Inhaltsbereich aus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await openTheEditor(page);

    const maße = await geometry(page);
    // Dort ist die Höhe aufgelöst: Die Spalte nimmt den Bereich ganz ein
    // (abzüglich der Innenabstände des Modals), statt Luft zu lassen.
    expect(maße.editor).toBeGreaterThan(maße.content - 48);
    expect(maße.textarea).toBeGreaterThan(maße.fields + maße.draftBar);
  });
});

test.describe('custom-content-edit: Zeilenumbruch abschalten', () => {
  const LANGE_ZEILE = 'X'.repeat(400);

  test('umbricht standardmäßig und scrollt nicht seitwärts', async ({
    page,
  }) => {
    await openTheEditor(page);
    await paragraph(page)
      .locator('custom-content-edit #content-input')
      .fill(LANGE_ZEILE);

    const zustand = await wrapState(page);
    expect(zustand.whiteSpace).not.toBe('pre');
    expect(zustand.scrollsSideways).toBe(false);
  });

  test('abgeschaltet läuft die Zeile weiter und wird gescrollt', async ({
    page,
  }) => {
    await openTheEditor(page);
    await paragraph(page)
      .locator('custom-content-edit #content-input')
      .fill(LANGE_ZEILE);

    await toggleWrap(page);

    const zustand = await wrapState(page);
    expect(zustand.whiteSpace).toBe('pre');
    expect(zustand.scrollsSideways).toBe(true);
  });

  test('der Schalter ändert die Ansicht, nicht den Text', async ({ page }) => {
    await openTheEditor(page);
    await paragraph(page)
      .locator('custom-content-edit #content-input')
      .fill(LANGE_ZEILE);

    await toggleWrap(page);
    expect((await wrapState(page)).value).toBe(LANGE_ZEILE);

    await toggleWrap(page);
    const zurück = await wrapState(page);
    expect(zurück.whiteSpace).not.toBe('pre');
    expect(zurück.scrollsSideways).toBe(false);
    expect(zurück.value).toBe(LANGE_ZEILE);
  });
});
