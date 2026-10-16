# `custom-node-view`

Shows **the node itself**, above its contents. The page shows a node in two
components that always refer to the same node: this one for the node,
`custom-node-contents` below for its `content_node`s.

It knows no tree. The host works out the path and the siblings from the
content tree and hands them in; every way to another node is one event,
`node-view-navigate`, and what follows is the host's decision.

## Usage

```html
<script
  type="module"
  src="/components/custom-node-view/custom-node-view.js"
></script>

<custom-node-view id="000n00000000000002"></custom-node-view>
```

## Attributes and properties

| Attribute | Property   | Type   | Description                                                                                |
| :-------- | :--------- | :----- | :----------------------------------------------------------------------------------------- |
| `id`      | `id`       | String | Id of the node. Setting it fetches the node (`query`, `object: 'node'`).                   |
| —         | `siblings` | Object | `{ previous, next }`, each `{ id, name }` or `null`. Default: neither.                     |
| —         | `path`     | Array  | The ancestors from the root down, `[{ id, name }]`, without the node itself. Default `[]`. |

## The card

One `slds-card` with `no-footer no-header-title`. Its header holds the
breadcrumbs on the left (slot `header`) and the actions on the right (slot
`actions`), in one row; it is no heading — the breadcrumbs are no title, and
the name stands below. The body holds the name between its arrows, then the
combobox of the children. A root has no breadcrumbs: its header holds only
the actions, on the right.

## The breadcrumbs

In the header, on the left, the way up: the ancestors from the root down, each a link
(`slds-breadcrumbs` with `no-current-item` and `last-item-as-link`). The node
itself is not among them — its name stands below. A root has no breadcrumbs.
Each crumb carries the address of its node (`/<id>`); a click reports
`node-view-navigate` instead of following it.

## The arrows to the siblings

Left of the name an arrow to the previous sibling (`utility:chevronleft`),
right of it one to the next (`utility:chevronright`), at the height of the
name. Each carries the name of its sibling as tooltip and accessible name
(`slds-button-icon` with `label`). A missing sibling leaves its place empty:
both places keep their width, so the name never moves.

## The children

Below the name, the way down: a combobox of the children (`slds-combobox`),
from a single child on — never a row of buttons. Choosing one reports
`node-view-navigate` with its id. Without children there is no combobox.

## The actions on the node

In the header, on the right, in this order — each only under
its scope, and without its scope not even an empty element:

| Action  | Element                                            | Scope              |
| :------ | :------------------------------------------------- | :----------------- |
| publish | `custom-content-publish` with `object-name="node"` | `publish` + `edit` |
| edit    | `custom-chapter-edit`                              | `edit`             |
| share   | button, copies `/<id>`, toast `Link kopiert`       | always             |
| move    | `custom-node-move` (marks the node)                | `edit`             |
| delete  | `custom-node-delete`                               | `delete`           |

Creating a child is **not** among them — that is the "+" tile of the
navigation modal. Adding a content belongs to the list below
(`custom-node-contents`). A name changed in the edit dialog is taken over at
once (`chapter-updated`).

## Methods

| Method              | Description                                                                      |
| :------------------ | :------------------------------------------------------------------------------- |
| `adoptNode(record)` | Takes a record already loaded instead of fetching it; sets `id` as an attribute. |
| `reload()`          | Fetches the node again under the same id. Without an id nothing happens.         |

## Events

| Event                | `detail`                          | When                                                                |
| :------------------- | :-------------------------------- | :------------------------------------------------------------------ |
| `query`              | `{ payload: { object: 'node' } }` | The component fetches its node (answered by `index.js`).            |
| `loaded`             | `{ nodeData }`                    | The node is there — fetched, or handed in by `adoptNode`.           |
| `toast`              | `{ message, variant }`            | The link was copied.                                                |
| `node-view-navigate` | `{ id }`                          | A way to another node was taken: an arrow, a breadcrumb or a child. |

All bubble and are composed. `adoptNode` reports `loaded` at once: a listener
has to hang before the call.
