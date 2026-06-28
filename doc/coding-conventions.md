# Coding Conventions

Aus dem bestehenden Code abgeleitete, verbindliche Code-Konventionen. Wo der
Code uneinheitlich war, wurde der Standard bewusst festgelegt (siehe
**Bekannte Abweichungen** unten) — Abweichungen sind Altlasten, die bei
Berührung anzugleichen sind.

Reine **Formatierung** (Quotes, Semikolons, Einrückung, Trailing Commas)
regelt Prettier (`.prettierrc`: `singleQuote`, `semi`, `tabWidth: 2`,
`trailingComma: es5`) und ist hier nicht wiederholt.

## Backend (Node.js)

- **Module:** CommonJS. Import per `require(...)`, Export ausschließlich als
  Sammelobjekt am Dateiende: `module.exports = { ClassName };`. Kein ESM
  (`import`/`export`), kein `exports.x =` / `module.exports.x =`.
- **Struktur:** klassenbasiert — eine Hauptklasse pro Datei, Dateiname =
  Klassenname (`DataFacade.js` → `class DataFacade`).
- **Bindungen:** `const`-first. `let` nur, wenn die Variable tatsächlich neu
  zugewiesen wird. `var` ist verboten.
  ```js
  const cache = new DataCache2(this.environment); // nie neu zugewiesen → const
  let product = await cache.get(recordId);         // wird unten neu gesetzt → let
  if (!product) product = await dataStorage.query(recordId);
  ```
- **Async:** `async`/`await` ist der Standard. `.then()`-Ketten nur in Altcode;
  in einer Datei **nicht** `.then` und `await` mischen.
- **Logging:** über `Logging.debugMessage(...)` aus `private/modules/logging.js`.
  Pro Methode eine `const LOCATION = 'Klasse.methode'` definieren und mit
  `severity`, `location: LOCATION`, `message` loggen.
  ```js
  const LOCATION = 'DataFacadeSync.getStory';
  Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: '…' });
  ```
- **Naming:** `camelCase` für Variablen/Methoden, `PascalCase` für Klassen.

## Tests

- **Framework:** Jest (+ Supertest für Endpoint-Integrationstests).
- **Ort:** Testdateien liegen in `__tests__/`-Ordnern neben dem Code.
- **Dateiname:** `<name>.tests.js` (Plural-`tests`).
- **Block-Keyword:** `it(...)` innerhalb von `describe(...)`. Kein `test(...)`.
- **Mocking-Tiefe:** Integrationstests so wenig wie möglich (nur externe I/O:
  DataStorage, DataCache, Logging, OpenIdConnectClient); Unit-Tests dürfen
  stark mocken. Reihenfolge/Workflow: `.github/instructions/epc.instructions.md`.

## Frontend

- Komponenten-Muster (Lit-first, Legacy-Markup-Caching), Ordner- und
  Tag-Präfixe: **`doc/conventions.md`** (kanonisch).
- **Event-Namen:** `kebab-case`, möglichst sprechend/qualifiziert
  (`chapter-select`, `chapter-updated`) statt nackter Einwörter (`select`).

## Bekannte Abweichungen (Migrations-Backlog)

Diese Stellen entsprechen dem oben festgelegten Standard noch **nicht**. Beim
Anfassen angleichen; eine gesammelte Migration ist optional.

- **Test-Dateiname `*.test.js`** (Standard: `*.tests.js`):
  - `private/modules/oAuth2/__tests__/OpenIdConnectClient.test.js`
  - `private/database2/DataCache/__tests__/RedisConnector.test.js`
  - `private/database2/DataMocks/__tests__/DataMock.test.js`
  - `private/database2/DataStorage/__tests__/sanitizer.test.js`
- **`test()` statt `it()`:** 2 Testdateien (bei nächster Berührung umstellen).
- **`.then`/`await` gemischt** in einer Datei:
  - `private/database2/DataFacade.js`
  - `private/database2/DataCache/DataCache.js`
  - `private/modules/oAuth2/OpenIdConnectClient.js`
- **`let` ohne Reassignment:** verbreitet (z. B. `let cache = new DataCache2()`);
  bei Berührung auf `const` ziehen.
- **Frontend Legacy-Muster:** 9 ältere `slds-*`-Komponenten nutzen noch natives
  Markup-Caching statt Lit (Details in `doc/conventions.md`).
