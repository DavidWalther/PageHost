const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');

/**
 * Die Rolle einer `custom-node`-Instanz hat eine Wirkung.
 *
 * Der `bookstore` hält zwei Instanzen derselben Komponente und gibt ihnen über
 * `data-role` verschiedene Rollen. `data-role` ist dabei ein reiner Selektor für
 * den Consumer — **die Komponente liest es nicht**. Was sich unterscheidet, sind
 * ausdrückliche Attribute, die der Consumer je Instanz setzt:
 *
 *   Rendering (`no-…`, Voreinstellung an):  no-child-navigation, no-contents
 *   Aktionen  (`can-…`, Voreinstellung aus): can-create-child,
 *                                            can-create-content, can-delete
 *
 * Damit bleibt der Knoten typfrei: Die **Daten** sagen, was er hat, der
 * **Consumer** sagt, wofür diese Instanz da ist. Vor dieser Trennung rendeten
 * beide Instanzen dasselbe — unter anderem zwei optisch identische
 * `utility:add`-Buttons nebeneinander, einer für einen Kind-Knoten, einer für
 * einen Inhalt.
 *
 * Alle Zusicherungen laufen über den `bookstore`: Die Rollen entstehen erst
 * durch dessen Verdrahtung, eine isolierte Montage der Komponente würde genau
 * das nicht prüfen.
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

const navigationNode = (page) =>
  page.locator('custom-node[data-role="navigation"]');
const contentNode = (page) => page.locator('custom-node[data-role="content"]');

/** Wartet, bis beide Knoten geladen sind — sonst misst man den leeren Zustand. */
async function awaitBothNodes(page) {
  await expect(navigationNode(page).locator('#node-name')).toHaveText(
    'Mock Story 1'
  );
  await expect(contentNode(page).locator('#node-name')).toHaveText(
    'Mock Chapter 1 for Story 1'
  );
}

// Einstieg über einen Kind-Knoten: oben die Wurzel mit ihrer Auswahl, unten das
// Kind mit seinen Inhalten — die Aufteilung, um die es hier geht.
const ENTRY = '/000c00000000000001';

test.describe('Knoten-Rollen: Aktionen', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await withSession(page);
    await page.goto(ENTRY);
    await awaitBothNodes(page);
  });

  test('oben nur „Kind anlegen", nicht „Inhalt anlegen" oder „Löschen"', async ({
    page,
  }) => {
    await expect(
      navigationNode(page).locator('#node-create-child')
    ).toHaveCount(1);
    await expect(
      navigationNode(page).locator('#button-create-content')
    ).toHaveCount(0);
    // Löscht der obere Knoten sich selbst, kann der Consumer das nicht
    // auffangen: `_handleNodeDeleted` nimmt die Id aus der Kinderliste genau
    // dieses Knotens. Die Aktion gehört deshalb nicht an diese Stelle.
    await expect(navigationNode(page).locator('#button-delete')).toHaveCount(0);
  });

  test('unten nur „Inhalt anlegen" und „Löschen", nicht „Kind anlegen"', async ({
    page,
  }) => {
    await expect(contentNode(page).locator('#node-create-child')).toHaveCount(
      0
    );
    await expect(
      contentNode(page).locator('#button-create-content')
    ).toBeVisible();
    await expect(contentNode(page).locator('#button-delete')).toBeVisible();
  });

  test('je Instanz genau ein „+" — nicht zwei nebeneinander', async ({
    page,
  }) => {
    // Der eigentliche Befund: Vor der Trennung standen auf **beiden** Knoten
    // zwei `utility:add`-Buttons — einer aus `custom-chapter-edit` (Kind
    // anlegen), einer als `#button-create-content` (Inhalt anlegen). Für den
    // Nutzer waren sie nicht zu unterscheiden.
    const plus = 'slds-button-icon[icon="utility:add"]';
    await expect(navigationNode(page).locator(plus)).toHaveCount(1);
    await expect(contentNode(page).locator(plus)).toHaveCount(1);
  });

  test('„Bearbeiten" und „Teilen" bleiben auf beiden Knoten', async ({
    page,
  }) => {
    // Bewusst ohne Attribut: Beide Rollen haben sie, ein Attribut, das beide
    // setzen müssten, wäre nur Rauschen. Bricht diese Entscheidung, soll es
    // auffallen und nicht stillschweigend passieren.
    for (const node of [navigationNode(page), contentNode(page)]) {
      await expect(node.locator('#node-edit')).toHaveCount(1);
      await expect(node.locator('#button-share')).toHaveCount(1);
    }
  });
});

test.describe('Knoten-Rollen: Attribut und Scope gelten zusammen', () => {
  // Zweite Zeile der Wahrheitstabelle. Die erste (Sitzung vorhanden, Attribut
  // gesetzt bzw. nicht) steht oben; zusammen belegen beide, dass das Attribut
  // die Scope-Prüfung **ergänzt** und nicht ersetzt.
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.goto(ENTRY);
    await awaitBothNodes(page);
  });

  test('ohne Sitzung fehlen die Aktionen trotz gesetzter Attribute', async ({
    page,
  }) => {
    await expect(
      contentNode(page).locator('#button-create-content')
    ).toHaveCount(0);
    await expect(contentNode(page).locator('#button-delete')).toHaveCount(0);
  });

  test('ohne Sitzung bleibt auch „Kind anlegen" leer', async ({ page }) => {
    // Der Rahmen wird gerendert (`can-create-child` ist gesetzt), aber
    // `custom-chapter-edit` prüft seinerseits den `create`-Scope und zeigt
    // seinen Button nicht. Beide Tore greifen hintereinander.
    await expect(
      navigationNode(page).locator('#node-create-child')
    ).toHaveCount(1);
    await expect(
      navigationNode(page).locator('slds-button-icon[icon="utility:add"]')
    ).toHaveCount(0);
  });
});

test.describe('Knoten-Rollen: Rendering', () => {
  // Ein Knoten, der Kinder **und** Inhalte hat — im typfreien Modell erlaubt,
  // in den geteilten Mocks aber nicht vorgesehen. Nur hier überschrieben, damit
  // kein anderer Spec mitverschoben wird.
  const WURZEL_MIT_INHALT = {
    ...MOCK_NODES.wurzel,
    contents: [
      {
        id: '00cn00000000000090',
        name: 'Inhalt am Wurzelknoten',
        sortnumber: 1,
        published_date: '2022-01-01 00:00:00',
      },
    ],
  };

  const KIND_MIT_KIND = {
    ...MOCK_NODES.kind1,
    nodes: [
      {
        id: '000n00000000000090',
        name: 'Enkel-Knoten',
        description: null,
        sortnumber: 1,
        reversed: null,
        parent_node_id: MOCK_NODES.kind1.id,
        cover_node_id: null,
        published_date: '2022-01-01 00:00:00',
      },
    ],
  };

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const overrides = [WURZEL_MIT_INHALT, KIND_MIT_KIND];
      const match =
        overrides.find((node) => node.id === id || node.legacy_id === id) ??
        Object.values(MOCK_NODES).find(
          (node) => node.id === id || node.legacy_id === id
        );
      return route.fulfill({ json: match || {} });
    });
    await page.goto(ENTRY);
    await awaitBothNodes(page);
  });

  test('der obere Knoten zeigt die Auswahl, aber keine Inhalte', async ({
    page,
  }) => {
    await expect(navigationNode(page).locator('#child-navigation')).toHaveCount(
      1
    );
    // Obwohl der Knoten Inhalte **hat**: Sie gehören in den unteren Bereich.
    await expect(navigationNode(page).locator('custom-paragraph')).toHaveCount(
      0
    );
    // Und auch nicht der Hinweis — dieser Knoten ist für Inhalte nicht
    // zuständig, „keine vorhanden" wäre eine Aussage, die ihm nicht zusteht.
    await expect(navigationNode(page).locator('#no-contents')).toHaveCount(0);
  });

  test('der untere Knoten zeigt Inhalte, aber keine Auswahl', async ({
    page,
  }) => {
    await expect(contentNode(page).locator('custom-paragraph')).not.toHaveCount(
      0
    );
    // Obwohl der Knoten Kinder **hat**: Ein Klick darauf blieb hier wirkungslos
    // — `bookstore.handleNavigationEvent` wertet nur Meldungen des oberen
    // Knotens aus. Die Auswahl wird deshalb gar nicht erst angeboten.
    await expect(contentNode(page).locator('#child-navigation')).toHaveCount(0);
  });
});

test.describe('Knoten-Rollen: der Sprung zu einem Inhalt bleibt heil', () => {
  // Regressionsnetz für die Kehrseite von `no-contents`: Es legt im oberen
  // Knoten `setupContentObserving()` und `_buildPendingDisplaySet()` still.
  // Wird dabei zu viel abgeschaltet, bliebe der **untere** Knoten hinter
  // `?hidden=${this._scrollPending}` verborgen — der Fortschrittsbalken liefe
  // nie zu Ende, weil niemand mehr zählt.
  const INHALTE = [1, 2, 3, 4, 5].map((nummer) => ({
    id: `00cn0000000000009${nummer}`,
    name: `Absatz ${nummer}`,
    sortnumber: nummer,
    published_date: '2022-01-01 00:00:00',
  }));

  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    await page.route('**/data/query/node**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      const base = Object.values(MOCK_NODES).find(
        (node) => node.id === id || node.legacy_id === id
      );
      if (!base) return route.fulfill({ json: {} });
      // Beide Knoten bekommen Inhalte: der untere, um zu springen, der obere,
      // damit „rendert keine Inhalte" hier tatsächlich etwas zu bedeuten hat.
      return route.fulfill({ json: { ...base, contents: INHALTE } });
    });
    await page.route('**/data/query/content**', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
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
    await page.goto(`${ENTRY}?paragraphnumber=3`);
    await awaitBothNodes(page);
  });

  test('der Zielabsatz wird sichtbar und der Fortschritt läuft zu Ende', async ({
    page,
  }) => {
    const ziel = contentNode(page).locator(
      'custom-paragraph#00cn00000000000093'
    );
    await expect(ziel).toBeVisible();
    await expect(ziel).not.toHaveAttribute('no-display', /.*/);
    await expect(contentNode(page).locator('slds-progress-bar')).toHaveCount(0);
    await expect(contentNode(page).locator('custom-paragraph')).toHaveCount(5);
  });

  test('der obere Knoten bleibt aus der Inhalts-Mechanik heraus', async ({
    page,
  }) => {
    await expect(navigationNode(page).locator('custom-paragraph')).toHaveCount(
      0
    );
    await expect(navigationNode(page).locator('slds-progress-bar')).toHaveCount(
      0
    );
  });
});
