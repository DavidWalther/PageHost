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

## B — Entry points and deep links

## C — Reading and navigating

## D — Settings

## E — Signing in

## F — Writing nodes

## G — Writing contents

## H — Visibility (cross-cutting)
