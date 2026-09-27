# custom-chapter-edit

Creates and edits **a node** in a modal, and offers publishing it in a second
tab. The component owns both the triggering icon button **and** the modal — the
same shape as `custom-content-edit`, only with tabs.

> **The name comes from the retired data model.** There are no chapters any more;
> this component writes `object: 'node'`, and its attributes (`story-id`,
> `sort-number`) and events (`chapter-created`, `chapter-updated`) still carry the
> old words. The behaviour is current, the vocabulary is not. See
> **Known leftovers**.

## Two modes, decided by one attribute

There is no mode to set: **`chapter-id` decides.**

| `chapter-id` | Mode   | Trigger     | Modal title          | Confirm button |
| ------------ | ------ | ----------- | -------------------- | -------------- |
| set          | edit   | pencil icon | "Kapitel bearbeiten" | "Speichern"    |
| absent       | create | plus icon   | "Kapitel erstellen"  | "Erstellen"    |

`mode="create"` still exists as an attribute and is kept for backward
compatibility; it does not override `chapter-id`.

## Usage

Editing a node, as `custom-node` does it:

```html
<custom-chapter-edit
  chapter-id="00nd00000000000001"
  story-id="00nd00000000000000"
  name="Chapter one"
  sort-number="3"
  publish-date="2022-01-01 00:00:00"
  @chapter-updated="${this._handleNodeUpdated}"
></custom-chapter-edit>
```

Creating a child node — no `chapter-id`, and the existing children come along so
the next sort number can be proposed:

```html
<custom-chapter-edit
  story-id="00nd00000000000000"
  mode="create"
  .chapters="${this.childNodeList}"
  @chapter-created="${this._handleChildCreated}"
></custom-chapter-edit>
```

## Properties

| Attribute      | Property      | Type    | Meaning                                                                       |
| -------------- | ------------- | ------- | ----------------------------------------------------------------------------- |
| `chapter-id`   | `chapterId`   | String  | Id of the node to edit. **Absent means create.**                              |
| `story-id`     | `storyId`     | String  | Id of the parent node, written as `parent_node_id`.                           |
| `name`         | `name`        | String  | Name to start the form with.                                                  |
| `sort-number`  | `sortNumber`  | Number  | Sort number to start with.                                                    |
| `reversed`     | `reversed`    | Boolean | Whether the node's contents are shown against `sortnumber`.                   |
| `publish-date` | `publishDate` | String  | Current publication date, handed to the publish tab. Empty means unpublished. |
| `mode`         | `mode`        | String  | Legacy; `chapter-id` decides (see above).                                     |
| —              | `chapters`    | Array   | Existing siblings. Property only (`.chapters`).                               |
| —              | `chapterData` | Object  | The form state. Property only.                                                |

### What `chapters` is for

When the create dialog opens, the highest `sortnumber` among `chapters` plus one
is proposed, together with the name "Neues Kapitel". Without the list every new
node would start at 1 and land in front of its siblings.

## Permissions

Both checks read the session from `sessionStorage`:

| Trigger | Scope    | Without it          |
| ------- | -------- | ------------------- |
| pencil  | `edit`   | nothing is rendered |
| plus    | `create` | nothing is rendered |

No disabled buttons — the trigger is absent, and so is the element around it.
The publish tab inside the modal behaves differently: it holds
`custom-publishing`, which renders its toggle **disabled** without `publish` and
`edit`. → `../custom-publishing/README.md`

> Reading the session out of `sessionStorage` happens in several frontend
> components by now. That is known and will be cleaned up in one go.

## The modal

Two tabs, but only in edit mode:

1. **"Edits"** — name (required), sort number (at least 1) and a switch for the
   reverse order.
2. **"Veröffentlichen"** — `custom-publishing` for this node. **Create mode has
   no such tab**: there is no record yet that could be published.

The footer carries "Abbrechen" and the confirm button; the confirm button only
appears on the edit tab, since the publish toggle acts on its own.

## Validation

Checked before anything is dispatched, as a toast:

| Rule                   | Message                             |
| ---------------------- | ----------------------------------- |
| name must not be empty | "Kapitelname ist erforderlich"      |
| sort number at least 1 | "Sortierung muss mindestens 1 sein" |

A node therefore still needs a name — unlike a content, where an empty name is
allowed. The name rule speaks up as intended; the sort number rule cannot be
reached from the form (see **Known leftovers**).

## Events

All of them bubble and are composed.

| Event                 | `detail`                                | When                            |
| --------------------- | --------------------------------------- | ------------------------------- |
| `create`              | `{ object: 'node', payload, callback }` | Confirmed in create mode.       |
| `save`                | `{ object: 'node', payload, callback }` | Confirmed in edit mode.         |
| `chapter-created`     | `{ chapterData }`                       | The record was created.         |
| `chapter-updated`     | `{ chapterData }`                       | The record was saved.           |
| `chapter-edit-cancel` | —                                       | Cancelled.                      |
| `toast`               | `{ message, variant }`                  | Validation and callout results. |

`chapter-updated` is what a consumer refreshes on: `custom-node` hands the record
to its parent so the selection above shows the new name without a refetch.

### `parent_node_id` only when there is a parent

On save, `parent_node_id` goes out **only** if a parent id is known. For a root
node, sending `null` would be a statement ("detach it"), not a missing value — so
the field stays out of the payload.

## Methods

| Method   | Description       |
| -------- | ----------------- |
| `show()` | Opens the modal.  |
| `hide()` | Closes the modal. |

## Known leftovers

- **Names from the retired model everywhere.** `story-id` means the parent node,
  `chapter-id` the node itself, `chapters` its siblings; the events say
  `chapter-*`. The labels say "Kapitel" although a node can be anything in the
  tree. Renaming this touches every consumer and is its own task.
- `mode` is still an attribute although `chapter-id` decides.
- **A sort number below 1 cannot be entered.** `_handleSortNumberChange` reads
  `parseInt(input.value) || 1`, so an emptied field and a typed `0` both become
  `1` before the validation sees them — "Sortierung muss mindestens 1 sein" can
  therefore never appear. The invariant holds, the message is unreachable. The
  same shape used to hide the name check until `_handleNameChange` was changed
  from `||` to `??`.

## Styling

SLDS styles come into the shadow root through `addGlobalStylesToShadowRoot` from
`/modules/global-styles.mjs`.
