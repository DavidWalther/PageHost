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
registered, and imports `/modules/content-tree.mjs` for path lookups. It does **not**
load the content tree: the host owns it and hands it over as the `tree` property.

---

## Usage

Place the element once (e.g. inside the application shell) and open it
programmatically:

```html
<custom-navigation-modal
  current-location="000n00000000000002"
  .tree="${this._tree}"
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

| Attribute          | Property          | Type     | Description                                                           |
| ------------------ | ----------------- | -------- | --------------------------------------------------------------------- |
| `current-location` | `currentLocation` | `String` | Id of the node the page currently stands on.                          |
| —                  | `tree`            | `Array`  | The content tree as `/api/1.0/contents` delivers it; set by the host. |

### `tree`

The host loads the tree and passes it in (`app-bookstore` loads it once on start and
again after every change to a node, and shares it with the breadcrumbs). A new tree
positions a modal that was opened before the tree arrived; otherwise an open modal
keeps its level as far as that level still exists.

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

A tile **with** children shows how many there are and a chevron in its bottom right
corner (`2 ›`, icon `utility:chevronright`); screen readers hear „2 Einträge“ /
„1 Eintrag“ instead. The name sits in `.tile__name` — find a tile by it, not by
the tile's whole text.

### Creating nodes

With the `create` scope (checked by the embedded `custom-chapter-edit`):

- every level ends in a **„+“ tile** — a new node on that level, on the top level
  a new root;
- every tile **without** children carries a small **„+“** in its corner — the
  first child of that node (its level can never be opened: such a tile selects).

Both open the create dialog of `custom-chapter-edit` (`no-trigger`,
`openCreate()`) over the open modal, with the highest `sortnumber` of the
siblings plus one. After creating, the host reloads the tree and the modal stays
on its level. Escape in the dialog closes only the dialog.

An empty level reads „Keine Inhalte vorhanden.“

---

## Events

| Event                    | `detail`           | Description                                                                |
| ------------------------ | ------------------ | -------------------------------------------------------------------------- |
| `navigation-level-open`  | `{ id }`           | A tile with children was opened. The page behind may follow (cover node).  |
| `navigation-node-select` | `{ id, parentId }` | A tile without children was chosen. `parentId` is `null` on the top level. |

All events bubble and are composed.

---

## Methods

| Method   | Description                                                           |
| -------- | --------------------------------------------------------------------- |
| `show()` | Opens the modal and positions it from `current-location` (see above). |
| `hide()` | Closes the modal (delegates to `slds-modal`).                         |

The modal can also be closed via the ESC key, the close button, or a backdrop
click — these are handled by the underlying `slds-modal`.

---

## Notes

- Tile shape is rectangular (`aspect-ratio: 2 / 1`); the brand-style marking reuses
  SLDS brand blue (`#0176d3`).
- The content tree only holds what the reader may see: the backend filters
  unpublished nodes before delivery. The modal does no filtering of its own.
