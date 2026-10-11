# custom-navigation-modal

A Web Component (LitElement) that renders the application's **navigation modal**. It
wraps [`slds-modal`](../../slds-components/slds-modal/slds-modal.js) and lists the
content tree as tiles, **one level at a time, in any depth**: the roots first, then
the children of whichever tile was opened. The host (`app-bookstore`) turns the
modal's events into page changes.

---

## Import

```html
<script
  type="module"
  src="/components/custom-navigation-modal/custom-navigation-modal.js"
></script>
```

The component depends on `slds-modal`, `slds-layout` and `slds-layout-item` being
registered, imports `/modules/content-tree.mjs` for path lookups and embeds
`custom-chapter-edit` as its create dialog and `custom-node-delete` as its delete
action. On connect it
loads the content tree by dispatching a `query` event (`{ object: 'contents' }`)
which the host wires to the backend.

---

## Usage

Place the element once (e.g. inside the application shell) and open it
programmatically:

```html
<custom-navigation-modal
  current-location="000n00000000000002"
  @navigation-level-open="${this.handleNavigationLevelOpen}"
  @navigation-node-select="${this.handleNavigationNodeSelect}"
></custom-navigation-modal>
```

```javascript
const nav = document.querySelector('custom-navigation-modal');
nav.show(); // open the modal
nav.hide(); // close the modal
```

---

## Attributes

| Attribute          | Property          | Type     | Description                                  |
| ------------------ | ----------------- | -------- | -------------------------------------------- |
| `current-location` | `currentLocation` | `String` | Id of the node the page currently stands on. |

### `current-location`

Holds the **record id** of the current node — the id the content tree carries, never
a `legacy_id`. The host is the single source of truth and updates it whenever the page
changes; the modal never writes it back.

It drives two behaviors:

- **Marking** — every tile on the path from the root down to the location carries
  `.tile_current`, not only the location itself.
- **Positioning** — `show()` opens the level that lists the location among its
  siblings: a root (or no location) opens the top level; a node on level 4 opens the
  children of its parent on level 3. If `show()` runs before the tree has loaded, the
  positioning is applied once the tree arrives.

The open level is internal state: while the modal is open, clicks move it;
`current-location` only sets the level on open.

---

## Behavior

| Click on…                   | Effect                                                                            |
| --------------------------- | --------------------------------------------------------------------------------- |
| a tile **with** children    | opens that tile's level and reports `navigation-level-open`; the modal stays open |
| a tile **without** children | reports `navigation-node-select`; the host closes the modal                       |
| `< zurück`                  | goes up exactly one level (shown on every level below the top)                    |

A tile **with** children looks like a stack of cards (`.tile_stack`); the look is
one CSS rule of the component. A tile carries only its name.

An empty level reads „Keine Inhalte vorhanden.“

### Opening a tile as a level

A plain click on a leaf selects it, so a leaf's level could never be opened — and
its first child never be created, nor the leaf be deleted. With the `create` or the
`delete` scope a **modified click** opens
any tile as a level and never selects:

| Platform        | Gesture                                      |
| --------------- | -------------------------------------------- |
| Windows, Linux  | Ctrl + click, Ctrl + Enter on a focused tile |
| macOS           | Cmd + click, Cmd + Enter on a focused tile   |
| touch (and any) | hold the tile for 500 ms                     |

A leaf then shows its empty level with the „+“ tile, which creates its first child,
and the delete tile, which deletes the leaf (each only with its scope);
the page behind does **not** follow (no event). On a tile with children the gesture
does what a plain click does. Without either scope a modified click is a plain click.

- The keyboard gesture is handled on `keydown`: Cmd + Enter does not click a button
  on macOS.
- A hold is cancelled by moving more than 10 px or leaving the tile; the click that
  ends a hold is dropped, and no system menu, callout or text selection appears.

### Creating nodes

The modal always lists the children of the **current element** — the top level, or
the node whose level is open. With the `create` scope (checked by the embedded
`custom-chapter-edit`, not copied here) every level ends in a **„+“ tile**
(`.tile_add`): it creates one more child of the current element, on the top level a
new root. An empty level shows the hint and the „+“ tile.

The tile opens the create dialog of `custom-chapter-edit` (`no-trigger`,
`openCreate()`) over the open modal, proposing the highest `sortnumber` of the
siblings plus one. After creating, the host reloads the tree and the modal stays on
its level, where the new tile appears. Escape in the dialog closes only the dialog.

The tile is only the trigger; the action is the dialog's.

### Deleting nodes

With the `delete` scope (checked by the embedded `custom-node-delete`, not copied
here) every **opened** level ends in a **delete tile** (`.tile_delete`). It deletes
the **current element** — the node whose children are listed, not one of them. The
top level has no current element and no delete tile. A leaf is reached with the
modified click above.

The tile runs the delete action (`no-trigger`, `requestDelete()`): a prompt for the
node and its contents, a second one naming every node below it, and nothing is sent
when either is declined. After deleting, the host reloads the tree and the modal
stays open on what is left of its path — one level higher.

The tile is only the trigger; the action is `custom-node-delete`'s.

---

## Events

| Event                    | `detail`                | Description                                                                |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------- |
| `navigation-level-open`  | `{ id }`                | A tile with children was opened. The page behind may follow (cover node).  |
| `navigation-node-select` | `{ id, parentId }`      | A tile without children was chosen. `parentId` is `null` on the top level. |
| `query`                  | `{ payload, callback }` | Internal: requests the content tree (`{ object: 'contents' }`).            |

All events bubble and are composed.

---

## Methods

| Method     | Description                                                                            |
| ---------- | -------------------------------------------------------------------------------------- |
| `show()`   | Opens the modal and positions it from `current-location` (see above).                  |
| `hide()`   | Closes the modal (delegates to `slds-modal`).                                          |
| `reload()` | Loads the content tree again; an open modal keeps its level as far as it still exists. |

The host calls `reload()` whenever a node was created, changed, deleted, published or
unpublished (`app-bookstore` listens for `chapter-created`, `chapter-updated`,
`node-deleted`, `published`, `unpublished`; a published **content** does not reload).

The modal can also be closed via the ESC key, the close button, or a backdrop
click — these are handled by the underlying `slds-modal`.

---

## Notes

- Tile shape is rectangular (`aspect-ratio: 2 / 1`); the brand-style marking reuses
  SLDS brand blue (`#0176d3`).
- The content tree only holds what the reader may see: the backend filters
  unpublished nodes before delivery. The modal does no filtering of its own.
