# Frontend-/UI-Tests (Playwright)

UI-Tests für das Frontend laufen mit **Playwright** und sind bewusst von der
Jest-Backend-Suite getrennt.

## Verzeichnis & Namen

Tests liegen in **`ui-tests/`**, Dateiendung **`*.spec.js`**. `ui-tests/`
**spiegelt die Struktur von `public/`** — zu jedem Komponentenordner dort gehört
der gleichnamige Ordner hier:

```
ui-tests/
  support/                                 Hilfsmodule (flach, nicht gespiegelt)
  applications/
    bookstore/bookstore.smoke.spec.js
  components/
    custom-navigation-modal/navigation-modal.spec.js
    custom-node/custom-node.smoke.spec.js
    custom-node/node-child-combobox.spec.js
  slds-components/
    slds-layout/slds-layout.spec.js
    slds-layout/layout-classlist-contract.spec.js
    slds-modal/slds-modal.spec.js
    …
```

Die Specs liegen **nicht** in `public/`: Alles unterhalb von `public/` wird vom
Server statisch ausgeliefert (`server.js`, `express.static('public')`). Aus
`ui-tests/` heraus kann das nicht passieren — deshalb braucht es keinen Filter
und keine Guard-Middleware.

### Wo gehört ein neuer Spec hin?

**Nach Gegenstand, nicht nach Mechanismus.** Ein Spec liegt im Ordner der
Komponente, die er **prüft** — auch wenn er dafür die ganze App bootet.
`layout-classlist-contract.spec.js` navigiert auf `/` und läuft durch die
laufende App, prüft damit aber den classList-Contract von `slds-layout`: Er liegt
deshalb in `slds-components/slds-layout/`, nicht in einem App-Ordner.

**Ein Ordner darf mehrere Specs halten.** Der **Ordner** benennt den Gegenstand,
der **Dateiname** den Aspekt. `slds-layout/` enthält `slds-layout.spec.js` (die
Komponente selbst) und `layout-classlist-contract.spec.js` (ihr Contract gegenüber
Consumern). Aus demselben Grund liegen in `custom-node/` mehrere Specs: einer
für die Komponente selbst, einer für die Auswahl per Combobox, einer für die
Bearbeitungswege — der Ordner benennt den Gegenstand, der Dateiname den Aspekt.

### Support-Module

Hilfsmodule liegen flach unter `ui-tests/support/` und werden **nicht** gespiegelt.
Da jeder Spec drei Ebenen tief liegt, ist der Import überall gleich:

```js
const { gotoComponentPage } = require('../../support/component-page');
const { mockBookstoreCallouts } = require('../../support/mock-callouts');
```

### Abgrenzung zu Jest

Jest ignoriert `ui-tests/` (`jest.config.js` → `testPathIgnorePatterns`), damit
`*.spec.js` nicht versehentlich von Jest eingesammelt wird. Das Muster ist ein
Regex auf den vollen Pfad und greift deshalb auch für die Unterordner.

## Ausführen

```bash
npm run test:frontend   # nur Playwright (UI)
npm run test:backend    # nur Jest (Backend)
npm run test            # beide nacheinander (Backend, dann Frontend)
```

Einmalig vor dem ersten Lauf die Browser-Binary installieren:

```bash
npx playwright install chromium
```

Konfiguration: `playwright.config.js` (nur Chromium, `testDir: ui-tests`,
`baseURL: http://localhost:3000`). `testDir` wird **rekursiv** gescannt, das
Default-`testMatch` greift `**/*.spec.js` — die gespiegelte Ordnerstruktur
brauchte deshalb keine Config-Änderung. Die Helfer in `support/` matchen das
Muster nicht und werden nicht als Tests eingesammelt.

## Kein Backend nötig — Callout-Interception

Playwright startet den App-Server über die `webServer`-Option (`npm start`).
Die **SSR-Shell und statische Assets** werden auch **ohne Postgres/Redis**
ausgeliefert; die Readiness-Prüfung läuft über `/` (liefert 200), bewusst
nicht über `/metadata` (das ohne Redis hängt).

Alle **Datencallouts** der UI werden pro Test per `page.route()` abgefangen und
mit deterministischen Mock-Bodies beantwortet — der Server erreicht dadurch nie
die Datenschicht. Der zentrale Helper ist
[`ui-tests/support/mock-callouts.js`](../ui-tests/support/mock-callouts.js)
(`mockBookstoreCallouts(page)`); er deckt `/metadata`,
`/api/1.0/contents/**` und `/data/query/story|chapter|paragraph` ab. Die
Mock-Formen orientieren sich am echten Datenmodell (Story → Chapter → Paragraph).

```js
const { mockBookstoreCallouts } = require('../../support/mock-callouts');

test.beforeEach(async ({ page }) => {
  await mockBookstoreCallouts(page); // vor page.goto registrieren
});
```

## Zwei Testarten — und warum das wichtig ist

Diese Unterscheidung betrifft den **Mechanismus** (welche Seite der Test lädt),
**nicht** den Ablageort: Wo ein Spec liegt, entscheidet sein Gegenstand (siehe
„Wo gehört ein neuer Spec hin?"). Ein App-Test kann sehr wohl im Ordner einer
Komponente liegen.

| Art                  | Specs                                                                                        | Seite                                 |
| :------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------ |
| **App-Tests**        | `bookstore.smoke`, `navigation-modal`, `story-chapter-combobox`, `layout-classlist-contract` | echte App (`page.goto('/')`)          |
| **Komponententests** | die 13 `slds-<name>.spec.js`                                                                 | **leere Seite** (`gotoComponentPage`) |

Ein App-Test ist nötig, wenn der Gegenstand **nur im Zusammenspiel** existiert:
`layout-classlist-contract` prüft, dass kein Consumer Klassen an einem
Layout-Host ablegt — das ist ohne die Consumer nicht prüfbar.
`story-chapter-combobox` prüft einen Pfad, den erst der Consumer auslöst
(`custom-node` rendert die Combobox nur ab genügend Kind-Knoten).

Ein Komponententest mountet eine Webkomponente isoliert und prüft ihr Shadow-DOM.
Er braucht dafür **keine laufende App** — nur eine Seite auf demselben Origin, von
der aus sich `/slds-components/…` als Modul importieren lässt. Deshalb:

```js
const { gotoComponentPage } = require('../../support/component-page');

test.beforeEach(async ({ page }) => {
  await gotoComponentPage(page); // statt page.goto('/')
});
```

**Nicht** `page.goto('/')` in einem Komponententest verwenden. Das bootet die volle
Bookstore-App: rund 40 Requests pro Test, darunter echte Backend-Callouts
(`/metadata`, `/api/1.0/contents/all`, `/data/query/*` — je 600–900 ms) und zwei
Fahrten ins offene Internet (Lit vom jsDelivr-CDN, ein Logo von Wikimedia). Bei 100+
Tests auf mehreren Workern hing die Suite dadurch an fremder Netzwerklatenz und war
**unter Last flaky** — genau der Grund, warum es diesen Helper gibt.

[`ui-tests/support/component-page.js`](../ui-tests/support/component-page.js) liefert
zwei Funktionen:

- `gotoComponentPage(page)` — ersetzt das Dokument `/` durch eine leere Seite.
- `cacheLitBundle(page)` — holt das Lit-Bundle **einmal pro Worker** und beantwortet
  weitere Requests aus dem Speicher (es bleibt das echte Bundle). Auch die App-Tests
  nutzen das, weil jede Komponente Lit per CDN importiert.

## Authentifizierung

Der echte OIDC-/Google-Identity-Provider steht im Test nicht zur Verfügung und
wird umgangen:

- **Anonym (Standard, z. B. Smoke-Test)**: Ein frischer Browser-Context hat
  keine Session (`sessionStorage['code_exchange_response']`). Die App schaltet
  dann `useAuthFetch = false` und nutzt plain `fetch` statt `authenticatedFetch`
  — die IdP-Umleitung wird nur bei einem Login-Klick ausgelöst, der im Test nie
  passiert. Es ist also **kein** aktives Auth-Handling nötig.
- **Eingeloggt / Edit (Muster für spätere Tests)**: Vor App-Init
  `sessionStorage['code_exchange_response']` mit einem **Fake-JWT** seeden (via
  `context.addInitScript()`). Das Frontend verifiziert die Signatur nicht
  (`decodeJwtPayload` macht nur `atob`); ein handgebautes JWT mit `exp` in der
  Zukunft und passenden Scopes genügt. Die (weiterhin gemockten) Callouts tragen
  dann `Bearer <fake>`, der nie an einem echten Backend verifiziert wird.

## CI

Aktuell nur lokale Ausführung; keine GitHub-Actions-Pipeline.
