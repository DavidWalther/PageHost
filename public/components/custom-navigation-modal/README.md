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
registered, and imports `/modules/content-tree.mjs` for path lookups. On connect it
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

An empty level reads „Keine Inhalte vorhanden.“

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
