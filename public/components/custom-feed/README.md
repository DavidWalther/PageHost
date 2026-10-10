# `custom-feed`

Shows the **feeds** of the start page: one tab per feed, and in a tab the
feed's contents one below the other.

## A feed is not a type of node

Nodes carry no type. The **feed root** is an ordinary node, and its child nodes
are the feeds. Which node is the feed root is the consumer's business — the
application takes the id from the configuration (`feedRootNodeId`) and hands it
in as `root-id`. The component reads the root with the ordinary node query
(`GET /data/query/node?id=`), so the feeds it gets are already filtered by app
and publish date and sorted by `sortnumber`.

Each tab holds a `custom-node` without child navigation — a feed is a leaf, and
"contents one below the other" is exactly what that component does. Everything
a node can do for its contents works in a feed: loading in chunks, `reversed`
(set per feed, on the node), the jump to one content.

## API

| Attribute / property         | Type   | Description                                                                                            |
| :--------------------------- | :----- | :----------------------------------------------------------------------------------------------------- |
| `root-id` / `rootId`         | String | Id of the feed root. Without it — or when the node is not delivered — the component says so.           |
| `active-feed` / `activeFeed` | String | Id of the feed to open. Without it, or with an unknown id, the first feed is open. Follows the tabs.   |
| `contentnumber`              | Number | Jump to the content with this `sortnumber` in the feed named by `active-feed` (the first one without). |

### Event: `feed-select`

Fired when **the user** opens another feed, by click or keyboard:
`detail: { id, name }`, bubbles and is composed. It is **not** fired for the feed
shown on start and not when `active-feed` is set from outside — the consumer
already knows about those.

## What it shows

| Feeds of the root         | Display                                                    |
| :------------------------ | :--------------------------------------------------------- |
| several                   | `slds-tabset`, one tab per feed, the first (or asked) open |
| exactly one               | the feed itself, **no tab bar**                            |
| none / root not delivered | the hint „Keine Inhalte vorhanden"                         |

## Loading

A feed is loaded when its tab is shown **for the first time**: the
`custom-node` of a tab gets its `id` on the tab's `active` event, not before.
A tab that was open once stays loaded; reopening it asks for nothing.

## Writing

- **Contents can be created** in a feed (`can-create-content` on the node). A
  feed is not part of the navigation, so this is the only place for it. As
  everywhere, the action only appears with the matching scope.
- **A feed cannot be deleted** here (no `can-delete`): the action would delete
  the feed's node, and feeds cannot be created in the application.

## Tests

`ui-tests/components/custom-feed/custom-feed.spec.js`. The component is mounted
inside `app-bookstore`, because `index.js` binds the callouts to that element.
