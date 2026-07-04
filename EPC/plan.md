# PLAN — Backend-DataMock-Altlast entfernen

Reine Entfernung. Der Nicht-Mock-Pfad ist bereits durch Integrationstests
abgedeckt → kein separater „Integrationstests neu"-Schritt; Sicherheitsnetz ist
die grüne Bestandssuite nach jedem Schritt.

Entscheidungen des Benutzers: `system`-Block im env-variables-Endpoint komplett
entfernen; Doku-Bereinigung inkl. Legacy-Guides unter `files/CoPilotSetups/`.

- [x] Schritt 0 — Baseline (kein Branch): `npm run test` grün bestätigen (331 Backend + 4 Playwright grün)
- [ ] Schritt 1 — DataFacade + DataMock-Kern entfernen — Sub-Branch `step/remove-datamock-core`
  - [ ] `DataFacade.tests.js` anpassen: `isDataMockEnabled`-Suite + Mock-Config-Test + Mock-Env-Zeilen entfernen
  - [ ] `DataFacade.js`: beide `require` (Z. 2 + 4), `static isDataMockEnabled()`, alle Mock-Zweige entfernen; Create-Pfad auf reinen Storage-Pfad reduzieren
  - [ ] Ordner `private/database2/DataMocks/` und `private/database2/tables/mocks/*.json` löschen
  - [ ] Prettier auf geänderte Dateien; `npm run test` grün
  - [ ] Merge-Commit in Feature-Branch, Sub-Branch löschen
- [ ] Schritt 2 — Env-Flag-Exposure + Config bereinigen — Sub-Branch `step/remove-mock-env`
  - [ ] `environmetVariables.js`: `system`-Block entfernen → Response `{ auth: {…} }`
  - [ ] `environmetVariables.tests.js`: `system`-Erwartung aus beiden Tests entfernen
  - [ ] `.env`: `MOCK_DATA_ENABLE`-Zeile entfernen
  - [ ] `MOCK_DATA_ENABLE:'false'` aus den 4 Testdateien entfernen; `endpointIntegration.tests.js` ggf. `system`/`isMock`-Assertions anpassen
  - [ ] `ui-tests/support/mock-callouts.js`: `isMock: true` aus `MOCK_ENV_VARIABLES` entfernen
  - [ ] Prettier auf geänderte Dateien; `npm run test` **und** `npm run test:frontend` grün
  - [ ] Merge-Commit in Feature-Branch, Sub-Branch löschen
- [ ] Schritt 3 — Dokumentation bereinigen — Sub-Branch `step/remove-mock-docs`
  - [ ] Kern-Doku: `doc/architecture.md`, `private/database2/README.md`, `private/endpoints/api/1.0/contents/README.md`, `doc/coding-conventions.md`, `doc/frontend-testing.md`, Kommentar `ui-tests/support/mock-callouts.js:9`
  - [ ] Legacy-Guides: `files/CoPilotSetups/documentation_database.md`, `Endpoint-Architecture-Implementation-Guide.md`
  - [ ] Prettier auf geänderte Dateien; abschließender `npm run test`-Lauf grün
  - [ ] Merge-Commit in Feature-Branch, Sub-Branch löschen
