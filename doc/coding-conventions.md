# Coding Conventions

Aus dem bestehenden Code abgeleitete, verbindliche Code-Konventionen. Wo der
Code uneinheitlich war, wurde der Standard bewusst festgelegt (siehe
**Bekannte Abweichungen** unten) — Abweichungen sind Altlasten, die bei
Berührung anzugleichen sind.

Reine **Formatierung** (Quotes, Semikolons, Einrückung, Trailing Commas)
regelt Prettier (`.prettierrc`: `singleQuote`, `semi`, `tabWidth: 2`,
`trailingComma: es5`) und ist hier nicht wiederholt.

## Language

**English is the development language.** Documentation, code, comments, test
names and commit messages are written in English — it is the default language of
the trade, and a mixed repository forces every reader to switch.

**German is the language of the visitor-facing surface.** Every label a visitor
who is not signed in can read is German, and that is the product, not a
leftover: `Keine Inhalte vorhanden`, `Link kopiert`,
`Entschuldigung. Da war leider nichts zu finden.` These strings are **never**
translated.

**The operator surface fixes no language.** Behind the login only the operator
works, so the mix there (`Kapitelname ist erforderlich` next to `Login`) is not
a defect and no test asserts its wording.

### The boundary, in practice

| Written in English                                | Stays German                                   |
| :------------------------------------------------ | :--------------------------------------------- |
| `doc/`, `README.md`, component READMEs            | visitor-facing labels in `public/`             |
| code comments, `Logging` messages, variable names | those same labels **quoted in test selectors** |
| `describe(...)` / `it(...)` / `test(...)` titles  | —                                              |
| commit subjects and bodies                        | —                                              |

The second column is the one that bites: a Playwright spec matches on rendered
text (`hasText: 'Speichern'`, `'Keine Inhalte vorhanden'`). Translating such a
string turns a green test red without changing a single line of production code.
When a test title is translated, the **selector inside it is not**.

Which labels a use case relies on: **`doc/useCases.md`**.

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
  let product = await cache.get(recordId); // wird unten neu gesetzt → let
  if (!product) product = await dataStorage.query(recordId);
  ```
- **Async:** `async`/`await` ist der Standard. `.then()`-Ketten nur in Altcode;
  in einer Datei **nicht** `.then` und `await` mischen.
- **Logging:** über `Logging.debugMessage(...)` aus `private/modules/logging.js`.
  Pro Methode eine `const LOCATION = 'Klasse.methode'` definieren und mit
  `severity`, `location: LOCATION`, `message` loggen.
  ```js
  const LOCATION = 'DataFacadeSync.getStory';
  Logging.debugMessage({
    severity: 'FINEST',
    location: LOCATION,
    message: '…',
  });
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

- Komponenten-Muster (Lit), Ordner- und Tag-Präfixe:
  **`doc/conventions.md`** (kanonisch).
- **Event-Namen:** `kebab-case`, möglichst sprechend/qualifiziert
  (`chapter-select`, `chapter-updated`) statt nackter Einwörter (`select`).

## Bekannte Abweichungen (Migrations-Backlog)

Diese Stellen entsprechen dem oben festgelegten Standard noch **nicht**. Beim
Anfassen angleichen; eine gesammelte Migration ist optional.

- **Deutsche Entwicklungssprache im Bestand** (Standard: Englisch, siehe
  „Language"). Englisch sind `README.md`, `doc/authentication.md`,
  `doc/useCases.md` und alle `slds-*`-READMEs. Deutsch sind noch: diese Datei,
  `doc/architecture.md`, `doc/conventions.md`, `doc/frontend-testing.md`,
  `doc/datamodel-overhaul/*`, `.github/instructions/epc.instructions.md`, die
  meisten `custom-*`-READMEs, ein großer Teil der Code-Kommentare und 169 von
  280 Playwright-Testnamen (Stand 2026-09-26). Beim Anfassen angleichen; eine
  gesammelte Migration ist optional. **Oberflächentexte und ihre Zitate in
  Test-Selektoren sind davon ausgenommen** — sie bleiben deutsch.
- **Test-Dateiname `*.test.js`** (Standard: `*.tests.js`):
  - `private/modules/oAuth2/__tests__/OpenIdConnectClient.test.js`
  - `private/database2/DataCache/__tests__/RedisConnector.test.js`
  - `private/database2/DataStorage/__tests__/sanitizer.test.js`

- **Namen aus dem alten Datenmodell** in Komponenten, die es überlebt haben:
  `custom-chapter-edit` bearbeitet Knoten und meldet weiterhin
  `chapter-updated`; `custom-paragraph` stellt einen `content` dar. Beide
  funktionieren, tragen aber Begriffe, die es im Modell nicht mehr gibt.
- **`Sanitizer` beim Lesen:** geschrieben wird gebunden und ohne Sanitizer;
  `ActionGet` bildet beim Lesen weiterhin zurück, solange Bestandszeilen in
  `configuration`/`identity` verdoppelte Anführungszeichen enthalten. Fällt mit
  einer einmaligen Datenkorrektur.
- **`test()` statt `it()`:** 2 Testdateien (bei nächster Berührung umstellen).
- **`.then`/`await` gemischt** in einer Datei:
  - `private/database2/DataFacade.js`
  - `private/database2/DataCache/DataCache.js`
  - `private/modules/oAuth2/OpenIdConnectClient.js`
- **`let` ohne Reassignment:** verbreitet (z. B. `let cache = new DataCache2()`);
  bei Berührung auf `const` ziehen.
