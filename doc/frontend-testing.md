# Frontend-/UI-Tests (Playwright)

UI-Tests für das Frontend laufen mit **Playwright** und sind bewusst von der
Jest-Backend-Suite getrennt.

## Verzeichnis & Namen

- Tests liegen in **`ui-tests/`**, Dateiendung **`*.spec.js`**.
- Hilfsmodule unter `ui-tests/support/`.
- Jest ignoriert `ui-tests/` (`jest.config.js` → `testPathIgnorePatterns`),
  damit `*.spec.js` nicht versehentlich von Jest eingesammelt wird.

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
`baseURL: http://localhost:3000`).

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
const { mockBookstoreCallouts } = require('./support/mock-callouts');

test.beforeEach(async ({ page }) => {
  await mockBookstoreCallouts(page); // vor page.goto registrieren
});
```

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
