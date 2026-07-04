# PLAN — Backend-DataMock-Altlast entfernen

Reine Entfernung. Der Nicht-Mock-Pfad ist bereits durch Integrationstests
abgedeckt → kein separater „Integrationstests neu"-Schritt; Sicherheitsnetz ist
die grüne Bestandssuite nach jedem Schritt.

Entscheidungen des Benutzers: `system`-Block im env-variables-Endpoint komplett
entfernen; Doku-Bereinigung inkl. Legacy-Guides unter `files/CoPilotSetups/`.

- [x] Schritt 0 — Baseline (kein Branch): `npm run test` grün bestätigen (331 Backend + 4 Playwright grün)
- [x] Schritt 1 — DataFacade + DataMock-Kern entfernen — Sub-Branch `step/remove-datamock-core` (gemergt, 321 Backend-Tests grün)
  - [x] `DataFacade.tests.js` anpassen: `isDataMockEnabled`-Suite + Mock-Config-Test + Mock-Env-Zeilen entfernt
  - [x] `DataFacade.js`: beide `require`, `static isDataMockEnabled()`, alle Mock-Zweige entfernt; Create-Pfad auf reinen Storage-Pfad reduziert
  - [x] Ordner `private/database2/DataMocks/` und `private/database2/tables/mocks/*.json` gelöscht
  - [x] Prettier; `npm run test` grün
  - [x] Merge-Commit in Feature-Branch, Sub-Branch gelöscht
- [x] Schritt 2 — Env-Flag-Exposure + Config bereinigen — Sub-Branch `step/remove-mock-env` (gemergt, 321 Backend + 4 Playwright grün)
  - [x] `environmetVariables.js`: `system`-Block entfernt → Response `{ auth: {…} }`
  - [x] `environmetVariables.tests.js`: `system`-Erwartung aus beiden Tests entfernt
  - [x] `.env`: `MOCK_DATA_ENABLE`-Zeile entfernt (Datei gitignored → nur lokal)
  - [x] `MOCK_DATA_ENABLE:'false'` aus den 4 Testdateien entfernt; `endpointIntegration.tests.js` `system.isMock`-Assertion entfernt
  - [x] `ui-tests/support/mock-callouts.js`: `isMock: true` aus `MOCK_ENV_VARIABLES` entfernt
  - [x] Prettier; `npm run test` + Playwright grün
  - [x] Merge-Commit in Feature-Branch, Sub-Branch gelöscht
- [ ] Schritt 3 — Dokumentation bereinigen — Sub-Branch `step/remove-mock-docs`
  - [ ] Kern-Doku: `doc/architecture.md`, `private/database2/README.md`, `private/endpoints/api/1.0/contents/README.md`, `doc/coding-conventions.md`, `doc/frontend-testing.md`, Kommentar `ui-tests/support/mock-callouts.js:9`
  - [ ] Legacy-Guides: `files/CoPilotSetups/documentation_database.md`, `Endpoint-Architecture-Implementation-Guide.md`
  - [ ] Prettier auf geänderte Dateien; abschließender `npm run test`-Lauf grün
  - [ ] Merge-Commit in Feature-Branch, Sub-Branch löschen
