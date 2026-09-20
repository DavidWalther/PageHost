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

/**
 * Gedrehter Schirm — flach und breit.
 *
 * Dort passt der Editor **nicht** mehr in den Inhaltsbereich des Modals, und
 * genau daran ist er zerbrochen: Das Textfeld hielt an seiner Mindesthöhe fest,
 * sein Glied schrumpfte auf fast nichts, und die Entwurfs-Leiste wurde direkt
 * dahinter gesetzt — quer über das überlaufende Feld.
 *
 * Die Zusage lautet deshalb nicht "alles passt", sondern: **nichts überlagert
 * sich, und alles bleibt erreichbar.** Was nicht hineinpasst, wird gescrollt —
 * der Inhaltsbereich des Modals ist dafür da.
 */
test.describe('custom-content-edit: gedrehter Schirm', () => {
  const QUERFORMATE = [
    { name: 'Telefon quer', width: 800, height: 400 },
    { name: 'flaches Fenster', width: 740, height: 360 },
  ];

  /** Lage von Textfeld und Entwurfs-Leiste zueinander. */
  function stacking(page) {
    return page.evaluate(() => {
      const app = document.querySelector('app-bookstore');
      const node = app.shadowRoot.querySelector(
        'custom-node[data-role="content"]'
      );
      const root = node.shadowRoot
        .querySelector('custom-paragraph')
        .shadowRoot.querySelector('custom-content-edit').shadowRoot;
      const rect = (selector) =>
        root.querySelector(selector).getBoundingClientRect();
      const scroller = root
        .querySelector('slds-modal')
        .shadowRoot.querySelector('.slds-modal__content');

      return {
        textareaBottom: Math.round(rect('#content-input').bottom),
        draftBarTop: Math.round(rect('.slds-border_top').top),
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
      };
    });
  }

  for (const format of QUERFORMATE) {
    test(`${format.name}: die Entwurfs-Leiste liegt unter dem Textfeld`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: format.width,
        height: format.height,
      });
      await openTheEditor(page);

      const lage = await stacking(page);
      expect(lage.draftBarTop).toBeGreaterThanOrEqual(lage.textareaBottom);
    });

    test(`${format.name}: was nicht hineinpasst, wird gescrollt`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: format.width,
        height: format.height,
      });
      await openTheEditor(page);

      const lage = await stacking(page);
      // Kein stiller Überlauf: Der Inhaltsbereich weiß, dass mehr da ist.
      expect(lage.scrollHeight).toBeGreaterThan(lage.clientHeight);

      // Und unten angekommen ist die Entwurfs-Leiste wirklich zu sehen.
      await page.evaluate(() => {
        const app = document.querySelector('app-bookstore');
        const node = app.shadowRoot.querySelector(
          'custom-node[data-role="content"]'
        );
        const scroller = node.shadowRoot
          .querySelector('custom-paragraph')
          .shadowRoot.querySelector('custom-content-edit')
          .shadowRoot.querySelector('slds-modal')
          .shadowRoot.querySelector('.slds-modal__content');
        scroller.scrollTop = scroller.scrollHeight;
      });

      await expect(
        paragraph(page).locator('custom-content-edit button', {
          hasText: 'Entwurf anlegen',
        })
      ).toBeInViewport();
    });
  }
});
