# Use Cases

What this application does, one testable case per row. The list is the basis for
targeted testing — manual and automated.

## Purpose and how to read this

Every row is **one case**: an actor, a starting situation, one trigger, and an
observable result. Variants are not folded into prose — a missing scope, a
declined prompt or a rejected request each get their own row, so a row can be
turned into a test as it stands.

| Column            | Holds                                                                                      |
| :---------------- | :----------------------------------------------------------------------------------------- |
| `Id`              | Stable id, `UC-<section>-<number>`. A dropped case leaves a gap; ids are never renumbered. |
| `Use case`        | The action, in the imperative.                                                             |
| `Actor`           | Who acts, including the scope it takes (see below).                                        |
| `Precondition`    | What must hold before the trigger. `—` when nothing special does.                          |
| `Trigger`         | The concrete action or request.                                                            |
| `Expected result` | What must be observable afterwards.                                                        |

**Not in here:** test file names and coverage markers. Which case is covered by
which spec changes faster than this document; coverage is tracked outside of it.

## Actors

| Actor      | Who                                                                                                                       |
| :--------- | :------------------------------------------------------------------------------------------------------------------------ |
| `visitor`  | Not signed in. The default reader of the application.                                                                     |
| `operator` | Signed in. **There is no self-registration** — signing in only works for an identity that already exists in the database. |
| `crawler`  | A search engine or other machine reader (`robots.txt`, `sitemap.xml`).                                                    |
| `browser`  | The platform itself acting on the application's behalf: service worker, precache, PWA install.                            |

`operator + <scope>` names the scopes the session carries, e.g.
`operator + publish + edit`. A plain `operator` is signed in **without** the
scope the case is about — that is the interesting negative case, not an error.

## Two layers of permission

An action happens only when **both** layers allow it. They fail differently, and
telling them apart is what makes a permission test meaningful.

**1 — Scopes in the session (who is allowed).** The JWT carries `edit`, `create`,
`delete` and `publish`. They are checked **individually**:

| Action                    | Scopes required          | Rejected with                    |
| :------------------------ | :----------------------- | :------------------------------- |
| Create or change a record | `edit`                   | 401                              |
| Delete a record           | `delete`                 | 401                              |
| Publish or unpublish      | `publish` **and** `edit` | 401                              |
| Read unpublished records  | `edit`                   | published records only, no error |

Creating goes through the same endpoint as changing, so it needs `edit` on the
wire; the frontend additionally requires `create` before it offers the action at
all.

**2 — Actions enabled in the environment (what this deployment allows).**
`APPLICATION_ACTIVE_ACTIONS` lists the actions a deployment permits — `login`,
`create`, `edit`, `delete`, `publish`. An action that is missing there is
rejected with **403 `Permission denied`** even for a session that carries every
scope. A deployment can therefore be read-only without touching any identity.

**A missing scope usually removes the trigger from the screen.** The frontend
does not render a disabled control — the action is absent, and so is the element
that would hold it. Cases therefore say _not rendered_, not _disabled_.

**Two places differ, on purpose.** The publish toggle inside a node's edit dialog
is rendered without the scopes and only **disabled**; the same toggle is disabled
while its safety lock is still on. Where a case says _disabled_, it means one of
these two.

## UI language

The visitor-facing surface is **German** — that is intended, not a leftover.
Labels are therefore quoted **verbatim** in this document, inside an otherwise
English sentence: `shows "Keine Inhalte vorhanden"`. A translated quote would be
useless as a test criterion.

The operator surface mixes languages ("Kapitelname ist erforderlich" next to
"Login"). Its wording is not a requirement, so no case asserts it.

## A — Delivery and platform

How the application is delivered before any content is involved: the shell, the
files a machine asks for, the service worker, and what happens when a dependency
is gone.

| Id      | Use case                               | Actor   | Precondition                                                | Trigger                                                                                                       | Expected result                                                                                                                                           |
| :------ | :------------------------------------- | :------ | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-A-01 | Load the application shell             | visitor | —                                                           | `GET /` or any path that is not a known file                                                                  | HTML with an empty `<body onload="initializeApp()">`; the head links the SLDS stylesheet, `manifest.json` and the component modules                       |
| UC-A-02 | Load page metadata                     | visitor | a `configuration` row exists for the app                    | `GET /metadata`                                                                                               | JSON without `icon` and without the app columns; the app sets `document.title`, the `meta` tags and the header headline                                   |
| UC-A-03 | Load metadata that is not configured   | visitor | `configuration` has no `metaTitle`, no `pageHeaderHeadline` | open the app                                                                                                  | the placeholders `#config:metaTitle#` and `#config:pageHeaderHeadline#` are shown instead of blank text                                                   |
| UC-A-04 | Fetch the sitemap                      | crawler | published and unpublished nodes exist                       | `GET /sitemap.xml`                                                                                            | `application/xml` `<urlset>` with one `<loc>` per **published** node, parents before children; each URL is `<origin>/<nodeId>`, no type in the path       |
| UC-A-05 | Fetch the robots file                  | crawler | —                                                           | `GET /robots.txt`                                                                                             | 404 `404 Not Found` — the application ships no robots file                                                                                                |
| UC-A-06 | Read the web app manifest              | browser | `configuration.manifest` is filled                          | `GET /manifest.json`                                                                                          | `name`, `short_name`, `start_url` and `display` from the configuration, defaults where it is silent                                                       |
| UC-A-07 | Read the manifest without icons        | browser | `configuration.icon` is missing                             | `GET /manifest.json`                                                                                          | manifest without an `icons` array                                                                                                                         |
| UC-A-08 | Fetch the favicon                      | visitor | `configuration.icon.favicon` is set                         | `GET /favicon.svg`                                                                                            | the configured SVG as `image/svg+xml`; `/favicon.ico` returns the same body as `image/x-icon`                                                             |
| UC-A-09 | Fetch a favicon that is not configured | visitor | `configuration.icon` is missing                             | `GET /favicon.svg`                                                                                            | 404                                                                                                                                                       |
| UC-A-10 | Fetch an app icon                      | browser | `configuration.icon.icons` is set                           | `GET /icon-192.svg`                                                                                           | SVG with `${width}` and `${height}` replaced by 192; `/icon-512.svg` by 512                                                                               |
| UC-A-11 | Fetch the service worker               | browser | `APPLICATION_SERVICEWORKER_VERSION` is set                  | `GET /sw.js`                                                                                                  | the worker with the version substituted, sent with `Cache-Control: no-cache, no-store, must-revalidate`                                                   |
| UC-A-12 | Build the precache                     | browser | the worker was registered on first load                     | `install`                                                                                                     | the static file list is cached under `app-cache-v<version>`                                                                                               |
| UC-A-13 | Start the app offline                  | browser | the precache is built                                       | open the app without a network                                                                                | shell, modules and components are served from the cache                                                                                                   |
| UC-A-14 | Read data offline                      | browser | the precache is built                                       | open the app without a network                                                                                | requests to `/api/`, `/data/` and `/metadata` are never served from the cache — they fail                                                                 |
| UC-A-15 | Roll out a new worker version          | browser | a cache of an earlier version exists                        | change `APPLICATION_SERVICEWORKER_VERSION`, then visit twice                                                  | the new worker installs on the first visit and takes effect on the **second** (no `skipWaiting`); on activate it deletes the caches of all other versions |
| UC-A-16 | Compress a large response              | visitor | response is above `COMPRESSION_THRESHOLD_BYTES`             | request with `Accept-Encoding: br, gzip`                                                                      | Brotli                                                                                                                                                    |
| UC-A-17 | Compress for a client without Brotli   | visitor | response is above the threshold                             | request with `Accept-Encoding: gzip`                                                                          | gzip                                                                                                                                                      |
| UC-A-18 | Skip compression for a small response  | visitor | response is below the threshold                             | any request                                                                                                   | uncompressed                                                                                                                                              |
| UC-A-19 | Skip compression for binary content    | visitor | response has a binary content type                          | any request                                                                                                   | uncompressed                                                                                                                                              |
| UC-A-20 | Serve a static file                    | visitor | —                                                           | `GET /components/custom-node/custom-node.js`, `GET /assets/styles/salesforce-lightning-design-system.min.css` | served from `public/` and from the SLDS package                                                                                                           |
| UC-A-21 | Survive a database outage              | visitor | PostgreSQL is unreachable                                   | any request that needs data                                                                                   | the request ends in an error response and the server keeps serving; a rejected promise is logged, never fatal                                             |

## B — Entry points and deep links

The path decides where the application starts. **What an id stands for is
answered by the backend, not by the shape of the id** — there is no type prefix
any more. Ids of the retired model keep working because every lookup matches
`legacy_id` as well as `id`.

| Id      | Use case                                      | Actor   | Precondition                                      | Trigger                                         | Expected result                                                                                                            |
| :------ | :-------------------------------------------- | :------ | :------------------------------------------------ | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| UC-B-01 | Open the app without a deep link              | visitor | —                                                 | `GET /`                                         | the default entry node fills the selection; its cover node, where one is set, is loaded below                              |
| UC-B-02 | Open a deep link to a node                    | visitor | the node has a parent                             | `GET /<nodeId>`                                 | the parent fills the selection above, the node's contents below, and the node is marked as the selected child              |
| UC-B-03 | Open a deep link to a root node               | visitor | the node has no parent                            | `GET /<rootNodeId>`                             | the node itself fills the selection; its cover node, where one is set, is loaded below                                     |
| UC-B-04 | Open a deep link with a retired node id       | visitor | the node carries a `legacy_id`                    | `GET /000c00000000000042`                       | resolves to the same node as its current id — the lookup matches `legacy_id` or `id`                                       |
| UC-B-05 | Open a deep link to a content                 | visitor | the content exists                                | `GET /<contentId>`                              | the node the content hangs on is shown, and the view jumps to that content                                                 |
| UC-B-06 | Open a deep link with a retired content id    | visitor | the content carries a `legacy_id`                 | `GET /000p00000000000042`                       | same result as UC-B-05                                                                                                     |
| UC-B-07 | Jump to a numbered content                    | visitor | the node has more contents than one loading chunk | `GET /<nodeId>?paragraphnumber=7`               | the content with `sortnumber` 7 becomes visible; the contents before it load on the way, with progress shown               |
| UC-B-08 | Open an unknown id                            | visitor | neither a node nor a content matches              | `GET /doesnotexist`                             | silent fallback to the default entry node — no error and no empty screen                                                   |
| UC-B-09 | Resolve an entry point without fetching twice | visitor | —                                                 | `GET /<nodeId>`                                 | the already resolved record is handed to the node; the same id is not requested a second time                              |
| UC-B-10 | Know the current location after a deep link   | visitor | the content tree is loaded                        | `GET /<nodeId>`, then open the navigation modal | the modal opens on that node's level and marks it; it matches on the tree's ids, so a `legacy_id` is used where one exists |

## C — Reading and navigating

The application shows **two nodes** at once: the upper one offers its children as
a selection, the lower one shows the chosen node's contents. Both are the same
component — what a node can show follows from its data, what an instance is for
is set by the page.

| Id      | Use case                                     | Actor   | Precondition                                                      | Trigger                                              | Expected result                                                                |
| :------ | :------------------------------------------- | :------ | :---------------------------------------------------------------- | :--------------------------------------------------- | :----------------------------------------------------------------------------- |
| UC-C-01 | Wait for a node                              | visitor | the request is still open                                         | open a node                                          | a large spinner stands in place of the card                                    |
| UC-C-02 | Show a node's name                           | visitor | the node is loaded                                                | open a node                                          | the name stands in the card header                                             |
| UC-C-03 | Offer the children as buttons                | visitor | the node has children, at most `child-buttons_number-max` of them | open the node                                        | one button per child                                                           |
| UC-C-04 | Offer the children as a combobox             | visitor | the node has more children than the threshold                     | open the node                                        | a single combobox labelled "Auswahl" instead of the buttons                    |
| UC-C-05 | Mark the selected child                      | visitor | a child is selected                                               | —                                                    | its button carries the brand style and is disabled                             |
| UC-C-06 | Select a child by button                     | visitor | the node has children                                             | click a child button                                 | the lower node shows that child; the selection above stays put                 |
| UC-C-07 | Select a child from the combobox             | visitor | the combobox is shown                                             | pick an option                                       | same result as UC-C-06                                                         |
| UC-C-08 | Open a node that only leads further          | visitor | the node has children and no contents                             | open the node                                        | the selection is shown and **no** "Keine Inhalte vorhanden"                    |
| UC-C-09 | Open a node that leads nowhere               | visitor | the node has neither children nor contents                        | open the node                                        | shows "Keine Inhalte vorhanden"                                                |
| UC-C-10 | Read a text content                          | visitor | the content's active representation is `text`                     | open the node                                        | the name in bold, line breaks at `\n`                                          |
| UC-C-11 | Read an HTML content                         | visitor | the active representation is `html`                               | open the node                                        | the stored markup is rendered, without the name                                |
| UC-C-12 | Read a content with no active representation | visitor | `active_type` is missing and the HTML representation is filled    | open the node                                        | the HTML representation is shown                                               |
| UC-C-13 | Read contents in reverse order               | visitor | the node is marked `reversed`                                     | open the node                                        | the contents are ordered against `sortnumber`                                  |
| UC-C-14 | Load only the first chunk                    | visitor | the node has more contents than `loading-chunk-size` (default 10) | open the node                                        | only the first chunk is fetched; the rest stay placeholders that fetch nothing |
| UC-C-15 | Load the next chunk while reading            | visitor | placeholders are below the fold                                   | scroll down until one comes into view                | that chunk fetches and renders                                                 |
| UC-C-16 | Open the navigation modal                    | visitor | the content tree is loaded                                        | click the rows icon in the header                    | the modal lists the top level as tiles                                         |
| UC-C-17 | Drill into a tile                            | visitor | the modal is open                                                 | click a tile                                         | its children are listed and the modal stays open                               |
| UC-C-18 | Pick a child in the navigation modal         | visitor | a drill-down level is shown                                       | click a child tile                                   | the modal closes and both nodes switch to that child                           |
| UC-C-19 | Leave the navigation modal without choosing  | visitor | the modal is open                                                 | press Escape, click the close button or the backdrop | the modal closes and nothing else changes                                      |
| UC-C-20 | Copy a link to the current node              | visitor | —                                                                 | click the link icon                                  | `<origin>/<nodeId>` is in the clipboard; a toast says "Link kopiert"           |

## D — Settings

The settings modal is open to everyone; signing in is one block inside it. The
destructive actions sit in a separate, red-bordered zone.

| Id      | Use case                         | Actor    | Precondition                                       | Trigger                   | Expected result                                                                                                     |
| :------ | :------------------------------- | :------- | :------------------------------------------------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| UC-D-01 | Open the settings                | visitor  | —                                                  | click the gear icon       | the modal opens with the login block, the light switch and a red-bordered danger zone                               |
| UC-D-02 | Switch to light mode             | visitor  | the shell starts dark (`<html class="dark-mode">`) | turn the light switch on  | `dark-mode` is removed from `<html>`                                                                                |
| UC-D-03 | Switch back to dark mode         | visitor  | light mode is active                               | turn the light switch off | `dark-mode` is set on `<html>` again                                                                                |
| UC-D-04 | Reload after switching the light | visitor  | light mode is active                               | reload the page           | the app is dark again — the choice is not persisted                                                                 |
| UC-D-05 | Clear the login session          | operator | a session exists                                   | click "Session löschen"   | `code_exchange_response` is removed from `sessionStorage` and the page reloads, signed out                          |
| UC-D-06 | Clear the app cache              | visitor  | a precache exists                                  | click "Cache löschen"     | every cache of the origin is deleted, every worker is unregistered, and the page reloads so the precache is rebuilt |
| UC-D-07 | Fail to clear the app cache      | visitor  | Cache Storage is unavailable in this browser       | click "Cache löschen"     | a toast says "Cache konnte nicht gelöscht werden" and the page does **not** reload                                  |

## E — Signing in

Signing in goes through Google (OpenID Connect with PKCE); the server issues its
own JWTs afterwards. **There is no self-registration** — an identity row must
already exist, and it is that row which carries the scopes.

| Id      | Use case                                        | Actor    | Precondition                                                | Trigger                                                     | Expected result                                                                                                        |
| :------ | :---------------------------------------------- | :------- | :---------------------------------------------------------- | :---------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| UC-E-01 | Request an auth state                           | visitor  | `login` is active in `APPLICATION_ACTIVE_ACTIONS`           | `GET /api/1.0/oAuth2/requestAuthState`                      | a state is generated, kept in the cache and returned                                                                   |
| UC-E-02 | Request an auth state in a read-only deployment | visitor  | `login` is missing from `APPLICATION_ACTIVE_ACTIONS`        | same request                                                | 403 `Login not allowed`                                                                                                |
| UC-E-03 | Sign in with Google                             | visitor  | an identity row exists for the email; `login` is active     | grant consent, then `POST /api/1.0/oAuth2/codeexchange`     | access token (15 min) in `sessionStorage`, refresh token in `localStorage`, scopes taken from the identity row         |
| UC-E-04 | Exchange a code without the code                | visitor  | —                                                           | codeexchange without `auth_code`                            | 400 `Missing auth_code`                                                                                                |
| UC-E-05 | Exchange a code without a state                 | visitor  | —                                                           | codeexchange without `state`                                | 400 `Missing auth_state`                                                                                               |
| UC-E-06 | Exchange a code with an expired state           | visitor  | the state is no longer in the cache                         | codeexchange                                                | 400                                                                                                                    |
| UC-E-07 | Reuse an authorization code                     | visitor  | the code was already exchanged (used codes are kept 20 min) | codeexchange with the same code                             | 401 `Authentication code already used`                                                                                 |
| UC-E-08 | Sign in as an unknown user                      | visitor  | no identity row for the email                               | codeexchange                                                | 401 `No new users allowed`                                                                                             |
| UC-E-09 | Come back from a failed provider round-trip     | visitor  | the provider rejected the request                           | return to the app                                           | a toast says "Authentication failed" and the URL parameters are cleared                                                |
| UC-E-10 | Continue with an expiring access token          | operator | fewer than 30 s of lifetime left                            | any authenticated request                                   | the token is refreshed first, then the original request goes out                                                       |
| UC-E-11 | Continue after a 401                            | operator | the server answers 401                                      | any authenticated request                                   | one refresh, then the same request is retried once                                                                     |
| UC-E-12 | Fire two requests while the token expires       | operator | two authenticated requests start together                   | both requests                                               | one shared refresh, not two                                                                                            |
| UC-E-13 | Rotate the refresh token                        | operator | a refresh succeeded                                         | inspect `localStorage` and `identity.refreshtoken`          | both hold the new token; the previous one is rejected from then on                                                     |
| UC-E-14 | Refresh with an unknown token                   | operator | the token is not in any identity row                        | `POST /api/1.0/auth/refresh`                                | 401                                                                                                                    |
| UC-E-15 | Refresh without a token                         | visitor  | —                                                           | refresh without `refresh_token`                             | 400                                                                                                                    |
| UC-E-16 | Sign out                                        | operator | signed in                                                   | click "Logout"                                              | `identity.refreshtoken` is nulled, both stores are cleared, a toast says "Logout successful", the login button is back |
| UC-E-17 | Call a write endpoint without a token           | visitor  | —                                                           | `POST /api/1.0/data/change/` with no `Authorization` header | 401 `Unauthorized`                                                                                                     |
| UC-E-18 | Call a write endpoint with a broken token       | visitor  | the header is not a valid Bearer JWT                        | same request                                                | 401 `Unauthorized`                                                                                                     |

## F — Writing nodes

Which write actions a node instance offers is decided twice: the page grants them
per instance (`can-create-child`, `can-create-content`, `can-delete`), and the
session must carry the scope. Both are needed — the grant alone renders nothing.

| Id      | Use case                                      | Actor                             | Precondition                                          | Trigger                                                    | Expected result                                                                                                                                          |
| :------ | :-------------------------------------------- | :-------------------------------- | :---------------------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-F-01 | Create a child node                           | operator + create + edit          | the instance grants `can-create-child`                | open the dialog, enter name and sort number, confirm       | `create` with `object: node` and `parent_node_id`; toast "Kapitel erstellt"; the child appears in the selection                                          |
| UC-F-02 | Create a child node without a name            | operator + create + edit          | the dialog is open                                    | confirm with an empty name field                           | toast "Kapitelname ist erforderlich"; nothing is sent                                                                                                    |
| UC-F-03 | Create a child node with sort number 0        | operator + create + edit          | the dialog is open                                    | confirm with a sort number below 1                         | toast "Sortierung muss mindestens 1 sein"; nothing is sent                                                                                               |
| UC-F-04 | Look for the create trigger without the scope | operator                          | the instance grants `can-create-child`                | look at the action bar                                     | the trigger is not rendered, and the bar holds no empty slot where it would be                                                                           |
| UC-F-05 | Create a child in a read-only deployment      | operator + create + edit          | `create` is missing from `APPLICATION_ACTIVE_ACTIONS` | confirm the dialog                                         | 403 `Permission denied`; toast "Fehler beim Erstellen des Kapitels"                                                                                      |
| UC-F-06 | Edit a node                                   | operator + edit                   | the node is loaded                                    | change name, sort number or the reverse-order switch, save | the record is updated, toast "Kapitel gespeichert", and the selection above shows the new name without a reload                                          |
| UC-F-07 | Look for the edit trigger without the scope   | operator                          | the node is loaded                                    | look at the action bar                                     | the trigger is not rendered                                                                                                                              |
| UC-F-08 | Edit a node in a read-only deployment         | operator + edit                   | `edit` is missing from the active actions             | save                                                       | 403 `Permission denied`; toast "Fehler beim Speichern des Kapitels"                                                                                      |
| UC-F-09 | Delete a node                                 | operator + delete                 | the instance grants `can-delete`                      | click delete, confirm "Diesen Knoten wirklich löschen?"    | `GET /api/1.0/data/delete?object=node&id=…`; the whole subtree and its cache entries are removed; toast "Knoten gelöscht"; the node leaves the selection |
| UC-F-10 | Decline the delete prompt                     | operator + delete                 | the prompt is shown                                   | dismiss it                                                 | no request is sent and nothing is deleted                                                                                                                |
| UC-F-11 | Look for the delete trigger without the scope | operator                          | the instance grants `can-delete`                      | look at the action bar                                     | the trigger is not rendered                                                                                                                              |
| UC-F-12 | Delete in a read-only deployment              | operator + delete                 | `delete` is missing from the active actions           | confirm the prompt                                         | 403 `Permission denied`; toast "Fehler beim Löschen des Knotens"                                                                                         |
| UC-F-13 | Publish a node                                | operator + publish + edit         | the node is unpublished, the safety lock is off       | turn the publish toggle on                                 | `published_date` is set; visitors see the node                                                                                                           |
| UC-F-14 | Unpublish a node                              | operator + publish + edit         | the node is published, the safety lock is off         | turn the publish toggle off                                | `published_date` is nulled; visitors no longer see the node                                                                                              |
| UC-F-15 | Publish with the safety lock on               | operator + publish + edit         | the publish tab is open, the safety lock is on        | look at the publish toggle                                 | the toggle is disabled                                                                                                                                   |
| UC-F-16 | Publish a node that is already published      | operator + publish + edit         | the node is published                                 | `PATCH /api/1.0/actions/publish`                           | 400, nothing changes                                                                                                                                     |
| UC-F-17 | Unpublish a node that is already unpublished  | operator + publish + edit         | the node is unpublished                               | `PATCH /api/1.0/actions/unpublish`                         | 400, nothing changes                                                                                                                                     |
| UC-F-18 | Reach the publish toggle with `edit` only     | operator + edit                   | the node's edit dialog is open                        | open the publish tab                                       | the toggle is rendered but **disabled**; called directly, the endpoint answers 401                                                                       |
| UC-F-19 | Publish in a read-only deployment             | operator + publish + edit         | `publish` is missing from the active actions          | turn the publish toggle on                                 | 403 `Permission denied`                                                                                                                                  |
| UC-F-20 | See which actions each instance offers        | operator + create + edit + delete | both nodes are on screen                              | look at both action bars                                   | above only "create child", below only "create content" and "delete"; edit and share on both                                                              |

## G — Writing contents

A content is shown by one component and edited by another, each with its own
modal. A content holds **one representation per version** (`text`, `html`); which
one counts is stated by the record, not guessed from the data. Unsaved input can
live on as a local draft.

| Id      | Use case                                      | Actor                     | Precondition                                            | Trigger                                                 | Expected result                                                                                                                                 |
| :------ | :-------------------------------------------- | :------------------------ | :------------------------------------------------------ | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-G-01 | Create a content at a node                    | operator + create + edit  | the instance grants `can-create-content`                | click the add icon                                      | `create` with `object: content`, the node's id and a placeholder card; toast "Inhalt erstellt"; the content joins the list                      |
| UC-G-02 | Look for the add trigger without the scope    | operator                  | the instance grants `can-create-content`                | look at the action bar                                  | the trigger is not rendered                                                                                                                     |
| UC-G-03 | Create a content in a read-only deployment    | operator + create + edit  | `create` is missing from the active actions             | click the add icon                                      | 403 `Permission denied`; toast "Fehler beim Erstellen des Inhalts"                                                                              |
| UC-G-04 | Edit a content                                | operator + edit           | the content is loaded                                   | open the editor, change the text, save                  | `save` with `object: content`; the modal closes and the content shows the new state without a refetch                                           |
| UC-G-05 | Save a content without a name                 | operator + edit           | the editor is open                                      | clear the name field, save                              | the save goes out — an empty name is allowed                                                                                                    |
| UC-G-06 | Switch the version being edited               | operator + edit           | the content has a text and an HTML version              | pick the other version in the dropdown                  | the text area shows that version; the other version's text is kept                                                                              |
| UC-G-07 | Fill a version that did not exist             | operator + edit           | only one version exists                                 | pick the missing version, type, save                    | the new version is created and becomes the active one                                                                                           |
| UC-G-08 | Save a version that does not exist yet        | operator + edit           | the chosen version has no record and stays empty        | save                                                    | a warning toast; the active version stays as it was, and no empty representation is written                                                     |
| UC-G-09 | Turn line wrapping off                        | operator + edit           | the editor is open                                      | flip the wrap switch                                    | the text area scrolls sideways instead of wrapping; the stored text is unchanged                                                                |
| UC-G-10 | Fail to save                                  | operator + edit           | the endpoint answers an error                           | save                                                    | the modal stays open with the input intact                                                                                                      |
| UC-G-11 | Cancel the editor                             | operator + edit           | text was typed                                          | click cancel                                            | nothing is sent and the input is discarded                                                                                                      |
| UC-G-12 | Keep a draft                                  | operator + edit           | text was typed                                          | click create draft                                      | the draft is stored in `localStorage` under the content's id                                                                                    |
| UC-G-13 | Read a content that has a draft               | operator + edit           | a draft exists for that content                         | look at the content                                     | the draft is shown **instead of** the server state, marked as a draft                                                                           |
| UC-G-14 | Reopen the editor on a draft                  | operator + edit           | a draft exists                                          | open the editor                                         | the form starts from the draft, not from the server state                                                                                       |
| UC-G-15 | Discard a draft                               | operator + edit           | a draft exists                                          | click discard                                           | the draft is removed and the server state is shown again                                                                                        |
| UC-G-16 | Save a draft                                  | operator + edit           | a draft exists                                          | save                                                    | the draft's content is written and the draft is cleared                                                                                         |
| UC-G-17 | Delete a content                              | operator + delete         | the content is loaded                                   | click delete, confirm "Diesen Absatz wirklich löschen?" | `GET /api/1.0/data/delete?object=content&id=…`; toast "Absatz gelöscht"; the content leaves the list and the remaining ones keep their own text |
| UC-G-18 | Decline the delete prompt                     | operator + delete         | the prompt is shown                                     | dismiss it                                              | nothing is requested and nothing is deleted                                                                                                     |
| UC-G-19 | Delete the last content of a node             | operator + delete         | it is the node's only content and nothing leads further | confirm the prompt                                      | the content is gone and the node shows "Keine Inhalte vorhanden"                                                                                |
| UC-G-20 | Look for content actions without the scopes   | operator                  | the content is loaded                                   | look at the content's action bar                        | neither the edit nor the delete trigger is rendered; `delete` alone does not bring the editor                                                   |
| UC-G-21 | Publish a content                             | operator + publish + edit | the content is unpublished                              | open the publish modal, turn the toggle on              | `published_date` is set and the content refetches itself                                                                                        |
| UC-G-22 | Unpublish a content                           | operator + publish + edit | the content is published                                | turn the toggle off                                     | `published_date` is nulled and the content refetches itself                                                                                     |
| UC-G-23 | Look for the publish trigger with `edit` only | operator + edit           | the content is loaded                                   | look at the action bar                                  | the publish trigger is not rendered — this component needs both scopes before it renders anything                                               |

## H — Visibility (cross-cutting)
