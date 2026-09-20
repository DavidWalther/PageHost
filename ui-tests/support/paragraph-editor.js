/**
 * Zugang zu einem Absatz (`custom-paragraph`) und zu seinem Editor.
 *
 * **Warum ein Helfer und nicht ein paar Selektoren je Spec:** Die Specs halten
 * das *Verhalten* des Absatzes fest — welcher Payload hinausgeht, was im
 * `localStorage` landet, welche Fassung gerendert wird. Der *Weg* dorthin ist
 * dagegen genau das, was der Umbau verändert hat: aus einem Button, der erst
 * bei `:hover` erschien und den Absatz an Ort und Stelle in ein Formular
 * verwandelte, wurde ein permanenter Icon-Button, der ein Modal öffnet. Weil
 * dieser Weg an einer Stelle liegt, kostete der Umbau **eine** Datei statt
 * sechs Specs.
 *
 * Die Funktionen unterhalb von „Der Weg zum Editor" sind deshalb die einzigen,
 * die dabei angefasst wurden.
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
  return paragraphLocator.locator('custom-content-edit slds-button-icon');
}

/** Die Schaltfläche, die den Absatz löscht. Fehlt ohne Scope `delete`. */
function deleteTrigger(paragraphLocator) {
  return paragraphLocator.locator('#button-delete');
}

/**
 * Die Schaltfläche, die das Veröffentlichen öffnet. Fehlt ohne `publish`+`edit`.
 */
function publishTrigger(paragraphLocator) {
  return paragraphLocator.locator('custom-content-publish slds-button-icon');
}

/** Öffnet den Editor. Der Auslöser ist permanent sichtbar. */
async function openEditor(paragraphLocator) {
  await editTrigger(paragraphLocator).click();
}

/** Löst das Löschen aus (der `confirm`-Dialog wird im Spec beantwortet). */
async function triggerDelete(paragraphLocator) {
  await deleteTrigger(paragraphLocator).click();
}

/** Bezeichnungen der Fassungen in der Auswahl. */
const VERSION_LABELS = { text: 'Text', html: 'HTML' };

/**
 * Die Felder und Schaltflächen des geöffneten Editors.
 *
 * Die Namen sagen die **Absicht**, nicht das Markup. Zwei Zuordnungen sind
 * deshalb nicht wörtlich:
 *
 * - `text` ist das **eine** Textfeld des Modals. Es zeigt die gerade gewählte
 *   Fassung; welche das ist, sagt `chooseVersion`.
 * - `draftApply` ist der Speichern-Knopf. Einen eigenen Knopf zum Übernehmen
 *   gibt es nicht mehr: Der Formularstand *ist* der Entwurf, also übernimmt ihn
 *   das Speichern und räumt ihn weg.
 */
function editor(paragraphLocator) {
  const modal = paragraphLocator.locator('custom-content-edit');
  const button = (label) => modal.locator('button', { hasText: label });
  const save = button('Speichern');

  return {
    name: modal.locator('#input-text'),
    sortnumber: modal.locator('#input-number'),
    text: modal.locator('#content-input'),
    /** Auf die Fassung umschalten, die bearbeitet werden soll. */
    async chooseVersion(type) {
      await modal.locator('slds-combobox .slds-combobox').click();
      await modal
        .locator('slds-combobox ul.slds-listbox li', {
          hasText: VERSION_LABELS[type],
        })
        .click();
    },
    save,
    cancel: button('Abbrechen'),
    draftEnable: button('Entwurf anlegen'),
    draftApply: save,
    draftDrop: button('Entwurf verwerfen'),
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
  publishTrigger,
  openEditor,
  triggerDelete,
  editor,
};
