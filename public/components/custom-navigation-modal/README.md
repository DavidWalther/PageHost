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
action. It asks for no data itself: the host hands it the content tree
through the property `tree` — the page needs the same tree for the breadcrumbs
and the arrows to the siblings, and loads it once for everyone.

---

## Usage

Place the element once (e.g. inside the application shell) and open it
programmatically:

```html
<custom-navigation-modal
  .tree="${this._tree}"
  current-location="000n00000000000002"
  @navigation-level-open="${this.handleNavigationLevelOpen}"
  @navigation-level-back="${this.handleNavigationLevelBack}"
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

| Attribute          | Property          | Type     | Description                                                        |
| ------------------ | ----------------- | -------- | ------------------------------------------------------------------ |
| `current-location` | `currentLocation` | `String` | Id of the node the page currently stands on.                       |
| `hidden-ids`       | `hiddenIds`       | `Array`  | Ids of nodes left out, each with everything below it.              |
| —                  | `marked`          | `Object` | The node marked to be moved, `{ id, name, parentId }`, or `null`.  |
| —                  | `tree`            | `Array`  | The content tree as `/api/1.0/contents` delivers it. Default `[]`. |

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

### `hidden-ids`

A JSON list of record ids (as an attribute) or an array (as a property). Every node
named there is left out **together with everything below it**: no tile, and no level
that could be opened. A path that runs through a left-out node — on open, on a
reload, or when the list changes — ends just before it. Marking still follows the
full tree, so the modal opens next to a left-out location.

The host leaves out the node marked to be moved: neither it nor anything below it
can become its new parent.

---

## Behavior

| Click on…                   | Effect                                                                            |
| --------------------------- | --------------------------------------------------------------------------------- |
| a tile **with** children    | opens that tile's level and reports `navigation-level-open`; the modal stays open |
| a tile **without** children | reports `navigation-node-select`; the host closes the modal                       |
| the button in the footer    | goes up exactly one level and reports `navigation-level-back`                     |

A tile **with** children looks like a stack of cards (`.tile_stack`); the look is
one CSS rule of the component. A tile carries only its name.

An empty level reads „Keine Inhalte vorhanden.“

### Heading and footer

The **heading** names the current element — the node whose children the tiles list
and on which the last tiles of a level act (create below it, delete it, paste below
it). The top level has no current element; it is headed „Navigation“.

The **footer** holds the way back and nothing else: one button
(`#button-back`), labelled with where it leads — the name of the level above, for
the top level „Navigation“. A long name is cut short; `title` and `aria-label` read
„Zurück zu ‹name›“. The top level has no way back and therefore **no footer**: the
missing footer says that this is the top of the tree.

Going back reports `navigation-level-back` with the level now open (`id`), so the
page behind can show it — the node the heading names. Back onto the top level
reports nothing — there is no node to show.

### Opening a tile as a level

A plain click on a leaf selects it, so a leaf's level could never be opened — and
its first child never be created, nor the leaf be deleted or become a new parent.
With the `create` or the `delete` scope, or with a marked node and the `edit` scope,
a **modified click** opens any tile as a level and never selects:

| Platform        | Gesture                                      |
| --------------- | -------------------------------------------- |
| Windows, Linux  | Ctrl + click, Ctrl + Enter on a focused tile |
| macOS           | Cmd + click, Cmd + Enter on a focused tile   |
| touch (and any) | hold the tile for 500 ms                     |

A leaf then shows its empty level with the „+“ tile, which creates its first child,
the delete tile, which deletes the leaf, and — while a node is marked — the paste
tile, which moves the marked node below it (each only with its scope);
the page behind does **not** follow (no event). On a tile with children the gesture
does what a plain click does. Without any of these a modified click is a plain click.

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

### Moving nodes

A node is marked at the page (`custom-node-move` in the lower node, or in the upper
one for a root); the host hands
the mark over as `marked` and leaves the node out with `hidden-ids`. The modal then

- names the mark above the tiles on every level (`#marked-hint`, „‚Name‘ markiert“),
  with a ✕ that reports `node-mark-clear` — the host drops the mark;
- ends every level in a **paste tile** (`.tile_paste`, „Hier einfügen“) that moves the
  marked node below the **current element**, on the top level to the top level.

There is no paste tile on the level the marked node already hangs on (a root is not
pasted on the top level), and none without the `edit` scope (checked by the
embedded `custom-node-move`). A leaf becomes a new parent through its own level,
opened with the modified click above.

The tile runs the move action (`no-trigger`, `requestMove(marked, currentId)`); the
node goes to the end of its new siblings, and a move the backend refuses shows its
reason. The action reports `node-moved`; the host drops the mark and reloads the
tree.

The tile is only the trigger; the action is `custom-node-move`'s.

---

## Events

| Event                    | `detail`           | Description                                                                |
| ------------------------ | ------------------ | -------------------------------------------------------------------------- |
| `navigation-level-open`  | `{ id }`           | A tile with children was opened. The page behind may follow (cover node).  |
| `navigation-level-back`  | `{ id }`           | One level up: `id` is the level now open. Not on the top level.            |
| `navigation-node-select` | `{ id, parentId }` | A tile without children was chosen. `parentId` is `null` on the top level. |
| `node-mark-clear`        | `{ nodeId }`       | The ✕ of the hint: the host should drop the mark.                          |

All events bubble and are composed.

---

## Methods

| Method   | Description                                                           |
| -------- | --------------------------------------------------------------------- |
| `show()` | Opens the modal and positions it from `current-location` (see above). |
| `hide()` | Closes the modal (delegates to `slds-modal`).                         |

A new `tree` keeps an open modal on its level as far as that level still exists;
one that arrives after `show()` positions the modal then. The host loads the tree
again whenever a node was created, changed, deleted, moved, published or
unpublished (`app-bookstore` listens for `chapter-created`, `chapter-updated`,
`node-deleted`, `node-moved`, `published`, `unpublished`; a published **content** does
not reload).

The modal can also be closed via the ESC key, the close button, or a backdrop
click — these are handled by the underlying `slds-modal`.

---

## Notes

- Tile shape is rectangular (`aspect-ratio: 2 / 1`); the brand-style marking reuses
  SLDS brand blue (`#0176d3`).
- The content tree only holds what the reader may see: the backend filters
  unpublished nodes before delivery. The modal does no filtering of its own.
