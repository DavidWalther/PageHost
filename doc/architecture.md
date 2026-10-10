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
- **Tests**: Backend Jest + Supertest, Frontend Playwright-UI-Tests
  (`npm run test` = beides nacheinander).
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
                              custom-node stellt einen Knoten dar (Auswahl + Inhalte)
  slds-components/            Wiederverwendbare SLDS-Bausteine, Präfix slds-*
  modules/                    Frontend-Util (global-styles, content-tree, authTokenManager …)
  applications/               Einstiegsseiten (z. B. bookstore)
ui-tests/                     Playwright-UI-Tests — spiegelt public/
  components/                 Specs zu public/components/
  slds-components/            Specs zu public/slds-components/
  applications/               Specs zu public/applications/
  modules/                    Specs zu public/modules/
  support/                    Test-Helfer (Callout-Mocks, Seiten-Setup)
doc/                          Dokumentation (diese Datei, authentication.md …)
```

`ui-tests/` liegt bewusst **außerhalb** von `public/`: Alles unterhalb von
`public/` wird statisch ausgeliefert — Testdateien dort bräuchten einen Filter im
Server. Die Spiegelung erreicht dieselbe Nähe zur Komponente ohne dieses Risiko.

## Datenmodell

Inhalte liegen in einem **rekursiven, typfreien Baum**:

- **`node`** — ein Knoten. Trägt `parent_node_id` (Selbstbezug), `sortnumber`,
  `published_date` und `is_parent_controls_visibility`. **Keine** Typspalte: ob
  ein Knoten wie ein Buch oder wie ein Kapitel wirkt, ergibt sich aus seiner
  Position im Baum und daraus, ob er Kinder oder Inhalte hat.
- **`content_node`** — ein Inhalt, hängt an genau einem Knoten.
- **`content_item`** — eine Repräsentation dieses Inhalts (`text`, `html`, …).
  Welche gilt, sagt `content_node.active_content_item` — ausdrücklich, nicht
  implizit aus dem Inhalt abgeleitet.
- **`app`** / **`app_node`** — App-Zugehörigkeit als Zeilen statt als
  Substring-Spalte, mit `include`/`exclude` und Wildcard (`app_id IS NULL`).

Dazu `configuration` (App-Metadaten) und `identity` (Nutzer). Beide waren nie
Teil des Inhaltsmodells, tragen weiterhin `applicationincluded` und laufen
direkt über `DataStorage`. Tabellen-Definitionen: `private/database2/tables/`.

**Feeds** are not a type of node. The start page shows the children of one root
node, and which node that is says the configuration key **`feedRootNodeId`**
(table `configuration`, delivered with `GET /metadata`). The feed root and the
feeds are ordinary nodes with the ordinary visibility rules; only their role
comes from the configuration. Consequence: the feed root has to be visible in
every app that is to show feeds — the feeds are read as its children.

**Sichtbarkeit** ist eine Regel über die Knotenkette, kein Filter in der
Abfrage: sie wird in JavaScript aufgelöst (`private/modules/NodeVisibility.js`),
unmittelbar nach der Abfrage und noch vor dem Cache. `published_date` wirkt quer
dazu und wird erst bei der Auslieferung geprüft
(`private/modules/ContentVisibilityFilter.js`).

Die abgelösten Tabellen `story`/`chapter`/`paragraph` stehen noch in der
Datenbank, kommen im Code aber nicht mehr vor. Ihre alten Ids bleiben über die
Spalte `legacy_id` auflösbar, damit Deep-Links von früher funktionieren.
→ Modell, Begründungen und Migration: **`doc/datamodel-overhaul/`** und
**`private/scripts/migration/README.md`**.

Alle Daten sind pro App über `APPLICATION_APPLICATION_KEY` getrennt; derselbe
Key trennt zusätzlich Cache-Bereiche über `CACHE_KEY_PREFIX`.

## Backend-Request-Flow

1. **`server.js`** definiert die Routen und delegiert an eine **Endpoint-Logik**.
   Die wichtigsten Routen:
   - `GET /data/query/node?id=` und `GET /data/query/content?id=` →
     `DataQueryLogicFactory` → `TypeFreeQueryEndpoint` (sonst
     `FallbackEndpoint`). Antwortformen: `private/endpoints/data/query/README.md`
   - `GET /metadata` → `MetadataEndpointLogicFactory`
   - `GET /api/1.0/contents/*` → Inhaltsbaum (siehe ContentVisibilityFilter)
     — without the feed root and everything below it (`SubtreeExclusion`,
     applied at delivery; the cached tree and `sitemap.xml` keep the feeds).
     → `private/endpoints/api/1.0/contents/README.md`
   - `POST /api/1.0/data/change/*`, `GET /api/1.0/data/delete` → Schreibpfade
   - `GET|POST /api/1.0/oAuth2/*`, `/api/1.0/auth/*` → Auth (siehe unten)
   - `GET /*` → Wildcard/SSR-Fallback (`WildcardLogicFactory`)
2. **Endpoint-Logik** (`private/endpoints/`, Basisklasse `EndpointLogic`) baut ein
   `parameterObject` (`request.table`, `request.id`, ggf. `publishDate`) und ruft
   die `DataFacade`. Scopes aus dem JWT (z. B. `edit`) steuern hier das
   Cache-/Publish-Verhalten.
3. **`DataFacade`** (`private/database2/DataFacade.js`) ist der einzige Einstieg
   in die Datenschicht. Sie entscheidet je `table`:
   - **Inhalte** (`node`, `content`, `contents`) gehen an das
     `NodeContentRepository` (`private/database2/repositories/`); wer zuständig
     ist, sagt `ContentRepository.owns()`.
   - **`configuration` und `identity`** gehen direkt an `DataStorage`.
   - Davor liegt in beiden Fällen **`DataCache`** (Redis); bei einem Miss wird
     gelesen und zurückgeschrieben. `edit`-Scope bzw. `skipCache` umgehen den
     Cache und liefern auch Unveröffentlichtes.

   → Vollständige Beschreibung der Zusammenarbeit von Facade/Cache/Storage:
   **`private/database2/README.md`**.

### Cache & publish filter

- The **content tree** (`contents`) is cached **in full** — every level,
  published _and_ unpublished — so one cached source serves the navigation,
  `sitemap.xml` and later features of the site.
- The publish filter (`private/modules/ContentVisibilityFilter.js`) runs in
  the **`DataFacade`**, after the cache: every reader gets the published tree
  unless it asks for more with `setIncludeUnpublished(true)` (only the `edit`
  scope does). Consumers do not filter themselves.
- Cache concept, key prefixes and env vars: **`README.md`** (section „Cache“)
  and **`private/database2/DataCache/README.md`**.

## Auth (OAuth2 / OIDC)

Login per OpenID-Connect-Code-Exchange; der Server stellt JWTs aus, deren
**Scopes** (z. B. `edit`) Lese-/Schreibrechte und das Cache-/Publish-Verhalten
steuern. Frontend-Token-Handling in `public/modules/authTokenManager.js`,
Server-Module in `private/modules/oAuth2/`. → Details: **`doc/authentication.md`**.

## Frontend-Schichten

- **`public/slds-components/`** — generische, wiederverwendbare SLDS-Bausteine,
  HTML-Tag-Präfix `slds-`.
- **`public/components/`** — anwendungsspezifische Komponenten, Tag-Präfix
  `custom-`. Holen Daten über Events, die `public/index.js` an die
  Backend-Endpunkte bindet. Dieselbe Ebene bindet auch Events, die **kein**
  Backend meinen, sondern die Browser-Plattform: `service-worker-cache-clear`
  löscht dort alle Caches der Origin und deregistriert den Service Worker — den
  `index.js` auch registriert. Die Anwendung sagt nur, **dass** zurückgesetzt
  werden soll, und entscheidet anhand der Rückmeldung über Reload oder Toast.
  - **`custom-node`** stellt **einen Knoten** dar: seine Kind-Knoten als
    Auswahl, seine Inhalte als Text. Es gibt keinen Modus und keine
    Tiefenangabe — die Daten sagen, **was** ein Knoten hat. **Wofür** eine
    Instanz da ist, sagt der Consumer über Attribute (`no-…` fürs Rendering,
    `can-…` für Aktionen). Die App (`bookstore`) hält zwei davon: oben die
    Auswahl, unten den gewählten Knoten — dieselbe Komponente, verschieden
    beauftragt. → `public/components/custom-node/README.md`
  - **`custom-feed`** is the **start page**: it reads the feed root and shows
    each feed as a tab (`slds-tabset`), a single feed without a tab bar. A tab
    holds a `custom-node` without child navigation, so everything a node does
    for its contents works in a feed, and a feed loads when its tab is first
    shown. The `bookstore` shows **either** the feeds **or** its two nodes:
    without an id in the address, with an unknown one, and for the feed root,
    a feed or a content of a feed it shows the feeds; opening a node through
    the navigation hides them, the home button in the header brings them
    back. There is no hard-coded entry node any more.
    → `public/components/custom-feed/README.md`
  - **`custom-navigation-modal`** zeigt den Inhaltsbaum als Kacheln, **Ebene
    für Ebene in beliebiger Tiefe**. Eine Kachel mit Kindern öffnet ihre Ebene
    (die Seite dahinter folgt, ein Titel-Knoten lädt), eine ohne Kinder wählt
    aus. Der Ort ist die Datensatz-Id, wie sie der Baum trägt; markiert wird
    der ganze Pfad (`public/modules/content-tree.mjs`). Nach jeder Änderung an
    einem Knoten lädt der `bookstore` den Baum neu.
    → `public/components/custom-navigation-modal/README.md`
  - **`custom-paragraph`** stellt **einen Inhalt** dar und **zeigt** ihn nur.
    Bearbeiten und Veröffentlichen sind eigene Komponenten mit eigenem Modal:
    **`custom-content-edit`** (Name, Sortierung, Fassung, Inhalt) und
    **`custom-content-publish`**. Letzteres ist eine **Übergangslösung**, bis
    es eine einheitliche Komponente zum Veröffentlichen von Inhalten _und
    Listen von Inhalten_ gibt — es steht deshalb ausdrücklich **neben** dem
    Editor und nicht in ihm.
    → `public/components/custom-paragraph/README.md`
  - **Ids werden nicht mehr am Präfix typisiert.** Was hinter einer Id steckt,
    beantwortet das Backend (`bookstore.resolveEntryPoint`); alte Deep-Links
    bleiben über `legacy_id` gültig.

> **Einheitliches Komponenten-Muster:** **Alle** Komponenten (`slds-*` und
> `custom-*`) nutzen **Lit (CDN)** + `global-styles.mjs`. Das frühere native
> Muster mit Markup-Caching (`.html`-Dateien) ist vollständig abgelöst.
> Verbindliche Regeln: **`doc/conventions.md`**.

## Tests

- Jest, Testdateien `*.tests.js` in `__tests__/`-Ordnern.
- **Integrationstests**: so wenig Mocking wie möglich (nur externe I/O:
  DataStorage, DataCache, Logging, OpenIdConnectClient).
- **Unit-Tests**: starkes Mocking erlaubt, um die Einheit zu isolieren.
- **Frontend/UI**: Playwright-Tests in `ui-tests/**/*.spec.js` (`npm run test:frontend`),
  Callouts gemockt, kein echtes Postgres/Redis nötig. `ui-tests/` spiegelt die
  Struktur von `public/`. Details: **`doc/frontend-testing.md`**.
- Ablauf/Reihenfolge der Test- und Implementierungsschritte:
  **`.github/instructions/epc.instructions.md`**.
- **Was** zu prüfen ist — die fachlichen Use Cases der Anwendung, je Zeile ein
  prüfbarer Fall: **`doc/useCases.md`**. **Wer** welches Ziel hat, als Diagramm
  je Datei: **`doc/usecase-diagrams/`**.

## Umgebung & Deployment

- Konfiguration über `.env*`-Dateien (`dotenv`). Variablen-Referenz: **`README.md`**.
- Start lokal: `npm start` (`node server.js`). Deployment: Heroku (`Procfile`).
- SQL zur Migration: `private/scripts/migration/` (Reihenfolge und
  Voraussetzungen stehen in der README dort). Die früheren CLI-Skripte
  (`story:*`, `chapter:*`, `paragraph:*`, `cache:*`) sind entfernt — sie
  forderten ein Verzeichnis, das es nicht mehr gibt, und waren nicht ausführbar.
