# EXPLORE — Backend-DataMock-Altlast entfernen

## Anforderung

Das vorübergehend implementierte Backend-Daten-Mocking (gesteuert über
`MOCK_DATA_ENABLE`) soll ersatzlos entfernt werden. Es ist überflüssig geworden,
weil eine lokale Testdatenbank existiert und UI-Verhalten über Playwright-Tests
abgesichert wird.

## Zwei getrennte „Mockings" — nur eines ist betroffen

- **A) Backend-DataMock (ZU ENTFERNEN):** `MOCK_DATA_ENABLE` → `DataFacade`
  liefert statt Cache/Postgres statische Fixtures aus `DataMock`.
- **B) Playwright-UI-Test-Mocking (BLEIBT):** mockt auf HTTP-Ebene per
  `page.route()` in `ui-tests/`. Nutzt `MOCK_DATA_ENABLE` nicht, importiert
  `DataMock` nicht. Referenziert `tables/mocks/` nur in Kommentaren.

## Betroffene Schichten

- Backend Datenschicht: `private/database2/`
- Backend Endpoints: `private/endpoints/api/1.0/environmetVariables.js`
- Konfiguration: `.env`
- Tests: `private/**/__tests__/`
- Doku: `doc/`, diverse README.md, `files/CoPilotSetups/`

## Findings (Dateien + Zeilen)

### Kern-Implementierung (löschen)
- `private/database2/DataMocks/DataMock.js` — Klasse `DataMock`, liest Fixtures
  aus `../tables/mocks/*.json`. Toter Code: Import `DataMockBuilder`, `Environment`,
  `LOREM_IPSUM_ARRAY` ungenutzt.
- `private/database2/DataMocks/DataMockBuilder.js` — nirgends produktiv genutzt.
- `private/database2/DataMocks/__tests__/DataMock.test.js` — einziger Test, der
  `DataMock` direkt importiert.
- Fixtures `private/database2/tables/mocks/{configuration,story,chapter,paragraph}.json`
  — nur von `DataMock.js`/`DataMock.test.js` per Code importiert.

### Verdrahtung `private/database2/DataFacade.js`
- Z. 2: `require('../modules/environment.js')` — nach Entfernung ungenutzt
  (`new Environment()` nur in Z. 727).
- Z. 4: `require('./DataMocks/DataMock.js')`.
- Z. 726–729: `static isDataMockEnabled()`.
- ~9 frühe `if (DataFacade.isDataMockEnabled()) return new DataMock()…`-Zweige
  (Z. 287, 321, 357, 391, 421, 476, 512, 553, 589).
- Z. 199–223: Create-Sonderfall `if/else` — `else`-Zweig behalten.

### Env-Flag-Exposure
- `private/endpoints/api/1.0/environmetVariables.js:8–11` — `system.isMock`.
  Frontend liest `isMock` nirgends (`public/` ohne Treffer).

### Konfiguration
- `.env:15` — `MOCK_DATA_ENABLE='false'`.

### Tests
- `private/database2/__tests__/DataFacade.tests.js` — `describe('isDataMockEnabled')`,
  Mock-Config-Test, `MOCK_DATA_ENABLE`-Env-Zeilen.
- `private/endpoints/api/1.0/__tests__/environmetVariables.tests.js:37,57` —
  `system: expect.any(Object)`.
- `MOCK_DATA_ENABLE:'false'` in: `buildContentsTree.connection.tests.js:20`,
  `endpointIntegration.tests.js:29,1046`, `publishEndpoint.tests.js:25`,
  `unpublishEndpoint.tests.js:27`.

### Doku
- `doc/architecture.md:61,67`, `private/database2/README.md` (DataMock-Abschnitt),
  `private/endpoints/api/1.0/contents/README.md:84–85`, `doc/coding-conventions.md:62`,
  `doc/frontend-testing.md:44`, `ui-tests/support/mock-callouts.js:9,24`,
  `files/CoPilotSetups/documentation_database.md`, `Endpoint-Architecture-Implementation-Guide.md`.

## Test-Lücken

Der echte (Nicht-Mock-)Pfad ist bereits durch Integrationstests abgedeckt
(`endpointIntegration.tests.js` läuft mit `MOCK_DATA_ENABLE:'false'`). Keine neuen
Integrationstests nötig; Sicherheitsnetz ist die grüne Bestandssuite je Schritt.
