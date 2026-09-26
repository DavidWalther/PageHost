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

**A missing scope removes the trigger from the screen.** The frontend does not
render a disabled control — the action is absent, and so is the element that
would hold it. Cases say _not rendered_, never _disabled_.

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

## F — Writing nodes

## G — Writing contents

## H — Visibility (cross-cutting)
