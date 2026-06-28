# Architektur-Überblick

Karte des Projekts für einen schnellen Einstieg: Tech-Stack, Verzeichnis,
Request-Flow und die Schichten. Detail-Dokus sind verlinkt — diese Datei
dupliziert sie bewusst nicht.

## Tech-Stack

- **Backend**: Node.js / Express (`server.js`), PostgreSQL (`postgres`-Treiber),
  Redis (`redis`) als Cache.
- **Frontend**: Lit-Webkomponenten via CDN (kein Bundler), Salesforce Lightning
  Design System (SLDS v1, selbstgehostet über `@salesforce-ux/design-system`).
- **Auth**: OpenID Connect / OAuth2 mit JWTs (`jsonwebtoken`).
- **Tests**: Jest + Supertest (`npm run test`).
- **Hosting**: Heroku Dyno, Auslieferung durch den Express-Server (`Procfile`).

## Verzeichnis

```
server.js                     Express-App: Routen -> Endpoint-Logik
private/                      Backend (nie an den Client ausgeliefert)
  endpoints/                  Endpoint-Logik-Klassen + Factories
  database2/                  Datenschicht (DataFacade / Cache / Storage)
  modules/                    Querschnitt: Logging, Environment, Auth, Filter
  scripts/                    CLI-Skripte (chapter:*, story:*, cache:* …)
public/                       Frontend (statisch ausgeliefert)
  components/                 App-Komponenten,   HTML-Tag-Präfix custom-*
  slds-components/            Wiederverwendbare SLDS-Bausteine, Präfix slds-*
  modules/                    Frontend-Util (global-styles, authTokenManager …)
  applications/               Einstiegsseiten (z. B. bookstore)
doc/                          Dokumentation (diese Datei, authentication.md …)
```

## Datenmodell

`story` (Buch) → enthält `chapter` (Kapitel) → enthält `paragraph` (Abschnitt,
Text oder HTML). Dazu `configuration` (App-Metadaten) und `identity` (Nutzer).
Tabellen-Definitionen: `private/database2/tables/`.

Alle Daten sind pro App über `APPLICATION_APPLICATION_KEY` getrennt; derselbe
Key trennt zusätzlich Cache-Bereiche über `CACHE_KEY_PREFIX`.

## Backend-Request-Flow

1. **`server.js`** definiert die Routen und delegiert an eine **Endpoint-Logik**.
   Die wichtigsten Routen:
   - `GET /data/query/*` → `DataQueryLogicFactory` → `ChapterEndpoint`,
     `ParagraphEndpoint`, `SingleStoryEndpoint`, `FallbackEndpoint`
   - `GET /metadata` → `MetadataEndpointLogicFactory`
   - `GET /api/1.0/contents/*` → Inhaltsbaum (siehe ContentVisibilityFilter)
   - `POST /api/1.0/data/change/*`, `GET /api/1.0/data/delete` → Schreibpfade
   - `GET|POST /api/1.0/oAuth2/*`, `/api/1.0/auth/*` → Auth (siehe unten)
   - `GET /*` → Wildcard/SSR-Fallback (`WildcardLogicFactory`)
2. **Endpoint-Logik** (`private/endpoints/`, Basisklasse `EndpointLogic`) baut ein
   `parameterObject` (`request.table`, `request.id`, ggf. `publishDate`) und ruft
   die `DataFacade`. Scopes aus dem JWT (z. B. `edit`) steuern hier das
   Cache-/Publish-Verhalten.
3. **`DataFacade`** (`private/database2/DataFacade.js`) ist der einzige Einstieg
   in die Datenschicht. Sie entscheidet je `table`:
   - Mock aktiv (`MOCK_DATA_ENABLE=true`) → `DataMock`
   - sonst zuerst **`DataCache`** (Redis), bei Cache-Miss **`DataStorage`**
     (Postgres) und Rückschreiben in den Cache.
   - `edit`-Scope bzw. `skipCache` umgehen den Cache und liefern ungefilterte
     (auch unveröffentlichte) Daten.

   → Vollständige Beschreibung der Zusammenarbeit von Facade/Cache/Storage/Mock:
   **`private/database2/README.md`**.

### Cache & Publish-Filter

- Der **Inhaltsbaum** (`contents`) wird **vollständig** (veröffentlicht *und*
  unveröffentlicht) im Cache gehalten; der Publish-Filter läuft erst bei der
  Auslieferung als eigenes Modul (`private/modules/ContentVisibilityFilter.js`),
  damit dieselbe Baum-Quelle z. B. auch für `sitemap.xml` nutzbar ist.
- Cache-Konzept, Key-Präfixe und Env-Vars: **`README.md`** (Abschnitt „Cache")
  und **`private/database2/DataCache/README.md`**.

## Auth (OAuth2 / OIDC)

Login per OpenID-Connect-Code-Exchange; der Server stellt JWTs aus, deren
**Scopes** (z. B. `edit`) Lese-/Schreibrechte und das Cache-/Publish-Verhalten
steuern. Frontend-Token-Handling in `public/modules/authTokenManager.js`,
Server-Module in `private/modules/oAuth2/`. → Details: **`doc/authentication.md`**.

## Frontend-Schichten

- **`public/slds-components/`** — generische, wiederverwendbare SLDS-Bausteine,
  HTML-Tag-Präfix `slds-`.
- **`public/components/`** — anwendungsspezifische Komponenten, Tag-Präfix
  `custom-`. Holen Daten über Events, die im Wildcard-/SSR-Pfad an die Backend-
  Endpoints gebunden werden.

> **Zwei Komponenten-Generationen** (wichtig!): Neue Komponenten und alle
> `custom-*` nutzen **Lit (CDN)** + `global-styles.mjs`. Ältere `slds-*`
> nutzen noch ein natives Muster mit Markup-Caching. Verbindliche Regeln,
> inklusive welches Muster für Neues gilt: **`doc/conventions.md`**.

## Tests

- Jest, Testdateien `*.tests.js` in `__tests__/`-Ordnern.
- **Integrationstests**: so wenig Mocking wie möglich (nur externe I/O:
  DataStorage, DataCache, Logging, OpenIdConnectClient).
- **Unit-Tests**: starkes Mocking erlaubt, um die Einheit zu isolieren.
- Frontend wird nicht automatisch getestet.
- Ablauf/Reihenfolge der Test- und Implementierungsschritte:
  **`.github/instructions/epc.instructions.md`**.

## Umgebung & Deployment

- Konfiguration über `.env*`-Dateien (`dotenv`). Variablen-Referenz: **`README.md`**.
- Start lokal: `npm start` (`node server.js`). Deployment: Heroku (`Procfile`).
- Nützliche Skripte: `npm run cache:flush`, `npm run chapter:read`, u. a.
  (siehe `scripts` in `package.json`).
