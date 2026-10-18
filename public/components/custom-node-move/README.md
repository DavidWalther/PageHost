# custom-node-move

**The one action that moves a node.** Every trigger that moves a node runs it:
the button in the action bar of `custom-node-view` — of the node shown, roots
included —, which marks, and the
paste tile of the navigation modal, which moves the mark there. Triggers may
move or multiply; the action stays here.

Moving takes two steps in two places, because the node and its new parent are
never on screen together:

1. **Mark.** The button stands at the node and reports `node-mark-change`. The
   consumer keeps the mark and hands it back as `marked` — the action holds
   no state of its own. The mark lives only as long as the page: a reload
   drops it. There is one mark at a time; a new one replaces the old.
2. **Move.** Where the new parent is chosen, the host calls
   `requestMove(node, targetId)`.

## Flow of `requestMove(node, targetId)`

1. Without `node.id` or without the `edit` scope: nothing happens.
2. `POST /api/1.0/data/change/` with
   `{ object: 'node', payload: { id, parent_node_id: targetId, sortnumber: null } }`
   (`move-node.api.js`). `targetId` `null` moves the node to the top level.
3. **No sort number:** the node stands at the end of its new siblings. The
   nodes below it keep theirs.
4. Success: toast "Knoten verschoben" and the event `node-moved`. Failure: a
   toast with the message of the backend, no event.

Resolves to `true` when the node moved, otherwise `false`.

The backend refuses a move below the node itself or one of its descendants,
and any move out of or into the feeds (the feed root and everything below
it) — with 400 and the reason, which the toast shows as it comes. A node moved
to the top level gets an `include` row for its own application, like a new
root; otherwise it would vanish together with everything below it. The way
back is not symmetric: a root moved below another node keeps that row.

## Usage

As the marking button, at the node:

```html
<custom-node-move
  node-id="${this.id}"
  node-name="${name}"
  parent-id="${parentId}"
  .marked="${isMarked}"
></custom-node-move>
```

As the action behind a trigger of the host:

```html
<custom-node-move no-trigger></custom-node-move>
```

```js
const action = this.shadowRoot.querySelector('custom-node-move');
if (action.canMove()) {
  await action.requestMove(markedNode, currentId);
}
```

## Properties

| Attribute    | Property    | Type    | Meaning                                               |
| ------------ | ----------- | ------- | ----------------------------------------------------- |
| `node-id`    | `nodeId`    | String  | Id of the node the button marks.                      |
| `node-name`  | `nodeName`  | String  | Its name, carried in the mark for the host to show.   |
| `parent-id`  | `parentId`  | String  | Its current parent; empty for a root.                 |
| —            | `marked`    | Boolean | Is this node the marked one? Set by the consumer.     |
| `no-trigger` | `noTrigger` | Boolean | No button of its own; the host calls `requestMove()`. |

The button shows `utility:cut` ("Zum Verschieben markieren") and, when
`marked`, `utility:clear` ("Markierung aufheben").

## Methods

| Method                        | Returns            | Meaning                                   |
| ----------------------------- | ------------------ | ----------------------------------------- |
| `canMove()`                   | `boolean`          | Does the session carry the `edit` scope?  |
| `requestMove(node, targetId)` | `Promise<boolean>` | The move (see above). `node` is the mark. |

## Events

| Event              | Detail                                     | Meaning                                                                    |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| `node-mark-change` | `{ marked, node: { id, name, parentId } }` | The wish to mark (`marked: true`) or unmark this node.                     |
| `toast`            | `{ message, variant }`                     | Success or failure of a move.                                              |
| `node-moved`       | `{ nodeId, fromParentId, toParentId }`     | The node moved; `null` stands for the top level. Parents changed children. |

All bubble and are composed.
