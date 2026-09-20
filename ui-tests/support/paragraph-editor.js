/**
 * Zugang zu einem Absatz (`custom-paragraph`) und zu seinem Editor.
 *
 * **Warum ein Helfer und nicht ein paar Selektoren je Spec:** Die Specs halten
 * das *Verhalten* des Absatzes fest — welcher Payload hinausgeht, was im
 * `localStorage` landet, welche Fassung gerendert wird. Der *Weg* dorthin ist
 * dagegen genau das, was gerade umgebaut wird (heute ein Button, der erst bei
 * `:hover` erscheint; künftig ein permanenter Icon-Button, der ein Modal
 * öffnet). Liegt dieser Weg an einer Stelle, kostet der Umbau **eine** Datei
 * statt sechs Specs.
 *
 * Die Funktionen unterhalb von „Der Weg zum Editor" sind deshalb die einzigen,
 * die beim Umbau angefasst werden.
 */

const { mockBookstoreCallouts } = require('./mock-callouts');
const { cacheLitBundle } = require('./component-page');

/** Deep-Link auf den Knoten, der im Mock Inhalte trägt (alte Id, wie im Feld). */
const CHAPTER_URL = '/000c00000000000001';

/** Der eine Inhalt, den `MOCK_NODES.kind1` hält. */
const CONTENT_ID = '00cn00000000000001';

/**
 * Attrappen-JWT mit ferner Ablaufzeit: `authenticatedFetch` versucht dann keinen
 * Refresh. Geprüft wird das Token clientseitig ohnehin nicht.
 */
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

/**
 * Bootet die App auf dem Kapitel-Knoten.
 *
 * `scopes: []` (Vorgabe) heißt **keine Sitzung** — dann wird gar kein
 * `sessionStorage` gesetzt, und die App nutzt plain `fetch`.
 */
async function openBookstore(page, { scopes = [] } = {}) {
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);

  if (scopes.length > 0) {
    await page.addInitScript(
      ([token, grantedScopes]) => {
        sessionStorage.setItem(
          'code_exchange_response',
          JSON.stringify({
            authenticationResult: {
              access: { access_token: token, scopes: grantedScopes },
            },
          })
        );
      },
      [fakeJwt(), scopes]
    );
  }

  await page.goto(CHAPTER_URL);
  await page.locator('app-bookstore').waitFor({ state: 'attached' });
}

/** Der Absatz selbst. Playwright durchdringt die Shadow Roots auf dem Weg. */
function paragraph(page, id = CONTENT_ID) {
  return page.locator(`custom-paragraph[id="${id}"]`);
}

/**
 * Ersetzt die Antwort des `content`-Endpunkts für **diesen** Test.
 *
 * Muss sein: Die gemeinsame Fixture liefert genau einen Inhalt in der Fassung
 * `html`, und sie lässt sich nicht erweitern — `custom-node.smoke.spec.js` prüft
 * die Inhalts-Ids des Knotens exakt. Ein zweiter Inhalt dort bräche diesen Spec.
 */
async function respondWithContent(page, record) {
  await page.route('**/data/query/content**', (route) =>
    route.fulfill({ json: record })
  );
}

/** Ein Inhalt in der Fassung `text`, sonst wie die Fixture. */
function textContentRecord(overrides = {}) {
  return {
    id: CONTENT_ID,
    legacy_id: '000p00000000000001',
    name: 'Mock Paragraph 1 for Chapter 1 of Story 1',
    sortnumber: 1,
    published_date: '2022-01-01 00:00:00',
    node_id: '000n00000000000001',
    active_content_item: '00ci00000000000001',
    active_type: 'text',
    items: [
      {
        id: '00ci00000000000001',
        type: 'text',
        content: 'Erste Zeile\nZweite Zeile',
      },
    ],
    ...overrides,
  };
}

// ==================================================
// Der Weg zum Editor — beim Umbau die einzige Baustelle
// ==================================================

/** Die Schaltfläche, die den Editor öffnet. Fehlt ohne Scope `edit`. */
function editTrigger(paragraphLocator) {
  return paragraphLocator.locator('#content button', { hasText: 'Bearbeiten' });
}

/** Die Schaltfläche, die den Absatz löscht. Fehlt ohne Scope `delete`. */
function deleteTrigger(paragraphLocator) {
  return paragraphLocator.locator('#content button', { hasText: 'Löschen' });
}

/**
 * Öffnet den Editor.
 *
 * Das `hover()` ist kein Detail des Tests, sondern des heutigen UI: Die
 * Schaltflächen stehen auf `display: none` und erscheinen erst über
 * `#content.editable:hover`. Ohne das Überfahren wartet ein Klick vergeblich
 * auf ein sichtbares Element.
 */
async function openEditor(paragraphLocator) {
  await paragraphLocator.locator('#content').hover();
  await editTrigger(paragraphLocator).click();
}

/** Löst das Löschen aus (der `confirm`-Dialog wird im Spec beantwortet). */
async function triggerDelete(paragraphLocator) {
  await paragraphLocator.locator('#content').hover();
  await deleteTrigger(paragraphLocator).click();
}

/**
 * Die Felder und Schaltflächen des geöffneten Editors.
 *
 * Die Namen sagen die **Absicht**, nicht das Markup — nach dem Umbau zeigen
 * dieselben Namen auf die Felder im Modal.
 */
function editor(paragraphLocator) {
  const button = (label) =>
    paragraphLocator.locator('button', { hasText: label });

  return {
    name: paragraphLocator.locator('#edit-name'),
    sortnumber: paragraphLocator.locator('#edit-sortnumber'),
    text: paragraphLocator.locator('#edit-content'),
    html: paragraphLocator.locator('#edit-htmlcontent'),
    /** Auf die Fassung umschalten, die bearbeitet werden soll. */
    async chooseVersion(type) {
      await paragraphLocator.locator(`#${type}-tab-link`).click();
    },
    save: button('Save'),
    cancel: button('Cancel'),
    draftEnable: button('Enable Draft'),
    draftApply: button('Apply'),
    draftDrop: button('Drop'),
  };
}

module.exports = {
  CHAPTER_URL,
  CONTENT_ID,
  fakeJwt,
  openBookstore,
  paragraph,
  respondWithContent,
  textContentRecord,
  editTrigger,
  deleteTrigger,
  openEditor,
  triggerDelete,
  editor,
};
