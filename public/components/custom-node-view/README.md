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

| Attribute | Property | Type   | Description                                                              |
| :-------- | :------- | :----- | :----------------------------------------------------------------------- |
| `id`      | `id`     | String | Id of the node. Setting it fetches the node (`query`, `object: 'node'`). |

## Methods

| Method              | Description                                                                      |
| :------------------ | :------------------------------------------------------------------------------- |
| `adoptNode(record)` | Takes a record already loaded instead of fetching it; sets `id` as an attribute. |
| `reload()`          | Fetches the node again under the same id. Without an id nothing happens.         |

## Events

| Event    | `detail`                          | When                                                      |
| :------- | :-------------------------------- | :-------------------------------------------------------- |
| `query`  | `{ payload: { object: 'node' } }` | The component fetches its node (answered by `index.js`).  |
| `loaded` | `{ nodeData }`                    | The node is there — fetched, or handed in by `adoptNode`. |

All bubble and are composed. `adoptNode` reports `loaded` at once: a listener
has to hang before the call.
