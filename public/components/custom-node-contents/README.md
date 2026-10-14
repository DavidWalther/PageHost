# `custom-node-contents`

Shows the **contents of one node**: its `content_node`s, one below the other,
each rendered by `custom-paragraph`. The one action on the list as a whole is
**adding** a content.

The page shows a node in two components that always refer to the same node:
`custom-node-view` above for the node itself, this one below for its contents.
`custom-node` embeds it as well, so the feeds use the very same mechanism.

## Usage

```html
<script
  type="module"
  src="/components/custom-node-contents/custom-node-contents.js"
></script>

<custom-node-contents can-create></custom-node-contents>
```

```js
// a record the consumer has already loaded …
contents.adoptNode(record);
// … or an id, and the component asks for the node itself
contents.setAttribute('id', nodeId);
```

## Attributes

| Attribute            | Property           | Type    | Description                                                                |
| :------------------- | :----------------- | :------ | :------------------------------------------------------------------------- |
| `id`                 | `id`               | String  | Id of the node. Setting it fetches the node (`query`, `object: 'node'`).   |
| `contentnumber`      | `contentnumber`    | Number  | `sortnumber` of a content to jump to once loaded. Set it before the data.  |
| `loading-chunk-size` | `loadingChunkSize` | Number  | How many contents load per step (default 10).                              |
| `can-create`         | `canCreate`        | Boolean | Offers adding a content — **on top of** the scope `create`, never instead. |

## When it shows

| Session                  | Contents | Shown                         |
| :----------------------- | :------- | :---------------------------- |
| any                      | some     | yes                           |
| scope `edit`             | none     | yes — an empty list to add to |
| no session, or no `edit` | none     | **no** — the host is `hidden` |

It is hidden only once the node is there: a list that is still loading is not
an empty one.

## Loading

Unchanged from `custom-node` (and `custom-chapter` before it):

- **Chunks.** The first `loading-chunk-size` contents load at once; the others
  carry `no-load`. An `IntersectionObserver` loads the next chunk when the
  reader gets near the end of the current one — at about 75 % of it, not at
  its last content.
- **Jump.** With `contentnumber` the list stays hidden behind a progress bar
  until every content **before** the target reported `loaded`; then it shows
  and scrolls to the target. The count belongs to the current node: a new
  node resets it.
- **Order.** A node with `reversed` shows its contents the other way round.

## Methods

| Method              | Description                                                                      |
| :------------------ | :------------------------------------------------------------------------------- |
| `adoptNode(record)` | Takes a record already loaded instead of fetching it; sets `id` as an attribute. |
| `reload()`          | Fetches the node again under the same id. Without an id nothing happens.         |
| `createContent()`   | Adds a content at the end. For a consumer with an add button of its own.         |

## Events

| Event             | `detail`                          | When                                                     |
| :---------------- | :-------------------------------- | :------------------------------------------------------- |
| `query`           | `{ payload: { object: 'node' } }` | The component fetches its node (answered by `index.js`). |
| `create`          | `{ object: 'content', payload }`  | A new content at this node.                              |
| `content-created` | `{ content }`                     | The new content has been added to the list.              |
| `toast`           | `{ message, variant }`            | Result of adding a content.                              |

All bubble and are composed. A deleted content (`content-deleted` from
`custom-paragraph`) leaves the **data**, not the DOM — its container would come
back on the next render otherwise.
