# custom-node-delete

**The one action that deletes a node.** Every trigger that deletes a node runs
it: the delete button of `custom-node-view` (and of `custom-node`) and the
delete tile of the navigation modal. Triggers may move or multiply; the action
stays here.

The backend deletes a node **with everything below it** — its contents, the
nodes below it and their contents. Nothing is left behind without its node.
So the action asks first, and it asks again when more than this one node goes.

## Flow of `requestDelete()`

1. Without `node-id` or without the `delete` scope: nothing happens.
2. Loads the node (`query` with `object: 'node'`) and the content tree (`query`
   with `object: 'contents'`) through the usual `query` events. The node tells
   how many **contents** go along, the tree how many **nodes** — the node
   itself knows only its direct children. A failed lookup ends in a toast;
   nothing is asked and nothing is sent.
3. First prompt: "Diesen Knoten wirklich löschen?", with contents
   "Diesen Knoten samt 3 Inhalten wirklich löschen?".
4. Only when there are nodes below it, a second prompt naming **all** of them,
   grandchildren included. The contents of those nodes are not counted — the
   tree does not carry contents — so the prompt says "samt ihren Inhalten".
5. Declining either prompt sends **no** request.
6. `GET /api/1.0/data/delete?object=node&id=…` (`delete-node.api.js`).
7. Success: toast "Knoten gelöscht" and the event `node-deleted`. Failure: a
   toast with the message of the backend, no event.

Resolves to `true` when the node was deleted, otherwise `false`.

## Usage

With its own button:

```html
<custom-node-delete node-id="${this.id}"></custom-node-delete>
```

As the action behind a trigger of the host:

```html
<custom-node-delete no-trigger></custom-node-delete>
```

```js
const action = this.shadowRoot.querySelector('custom-node-delete');
if (action.canDelete()) {
  action.nodeId = currentId;
  await action.updateComplete;
  await action.requestDelete();
}
```

## Properties

| Attribute    | Property    | Type    | Meaning                                                 |
| ------------ | ----------- | ------- | ------------------------------------------------------- |
| `node-id`    | `nodeId`    | String  | Id of the node to delete.                               |
| `no-trigger` | `noTrigger` | Boolean | No button of its own; the host calls `requestDelete()`. |

## Methods

| Method            | Returns            | Meaning                                      |
| ----------------- | ------------------ | -------------------------------------------- |
| `canDelete()`     | `boolean`          | Does the session carry the `delete` scope?   |
| `requestDelete()` | `Promise<boolean>` | The action: ask, delete, report (see above). |

## Events

| Event          | Detail                  | Meaning                                                                                      |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `query`        | `{ payload, callback }` | Asks the application for the node and the tree.                                              |
| `toast`        | `{ message, variant }`  | Success or failure.                                                                          |
| `node-deleted` | `{ nodeId, nodeIds }`   | `nodeIds` is the node and every node below it. A consumer showing any of them lets go of it. |

All bubble and are composed.

## Known limits

- Nodes hidden from this application (an `app_node` exclusion, or a node
  shown only in another application) are not in its tree. They are neither
  counted nor named in `nodeIds`, but the backend deletes them along. This can
  only come from data set by hand; the application itself never writes it.
- The prompts are `confirm()` dialogs, as before.
