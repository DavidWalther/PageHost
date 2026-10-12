## Overview

This document describes how the `DataFacade`, `DataCache`, and `DataStorage` classes work together to provide a seamless data retrieval and caching mechanism for the application.

### DataFacade

- Acts as the main entry point for data retrieval.
- Determines whether to return a promise or synchronous data based on the `parameterObject`.
- Uses `DataCache` and `DataStorage` to fetch and cache data.

#### The content tree and the publish filter

`getData({ request: { table: 'contents' } })` returns the content tree. The
cache holds it **in full** — every level, published and unpublished nodes
alike — so one cached source can serve every consumer (navigation, sitemap,
later a title search). The facade runs the `ContentVisibilityFilter` on the
way out, **after** the cache, and hands out the **published** tree by default.
The full tree only comes out through `setIncludeUnpublished(true)`, which the
contents endpoint sets for the `edit` scope. A consumer therefore cannot leak
unpublished nodes by forgetting a filter call: it would have to ask for them.

Every write to a **node** — create, update (including a new parent), publish,
unpublish, delete — drops the cached tree, whether or not the write skips the
cache (`invalidateContentsTreeAfterWrite`, `clearCacheFor`). Content writes
leave it alone; contents are not part of the tree.

A cached **node** carries its children and its contents. A write that changes
them clears that node's entry as well, under both ids and regardless of
`skipCache` (`clearNodeEntries`, fed by the repository's `getTouchedNodes`):
creating or deleting a child clears its parent, creating or deleting a content
its node.

#### Moving a node

An update of a node that sends a `parent_node_id` **different** from the stored
one is a move. `NodeContentRepository.updateRecord` checks it inside the write
transaction, before anything is written:

- It reads the chain of the node and of the new parent (a recursive CTE with
  `UNION`, which ends on a loop already in the data) and hands both to
  `private/modules/NodeMoveRule.js`. The rule rejects a new parent that is the
  node itself or one of its descendants, and any move out of or into the feeds
  (the feed root and everything below it). The rejection, `NodeMoveRejected`,
  becomes a 400 in the `UpsertEndpoint`.
- The feed root comes from the configuration (`feedRootNodeId`): the facade
  reads it only for updates that send a parent and hands it over with
  `setFeedRootId`.
- A node moved to the top level gets an `include` row for its own application,
  as `createNode` adds for a new root — without it a node that inherits its
  visibility would vanish together with everything below it.
- An unchanged parent — the edit dialog sends the current one on every save —
  is no move and is not checked.

A cached node carries its children. After a move the repository names the
node, its old and its new parent (`getTouchedNodes`), and the facade clears
their entries under both ids (`clearNodeEntries`), regardless of `skipCache`;
the tree is dropped as for every node write.

### DataCache

- Manages caching of data to improve performance and reduce database load.
- Uses `RedisConnector` to interact with a Redis cache.
- Generates cache keys using `CacheKeyGeneratorFactory` and its associated key generator classes.
- Retrieves data from the cache if available; otherwise, it fetches data from `DataStorage` and caches it.

### DataStorage

- Interacts with the database to fetch data.
- Interacts with the database for everything that is **not** content:
  `configuration` and `identity`. Content is read and written through
  `repositories/NodeContentRepository`, which `DataFacade` selects via
  `ContentRepository.owns()`.
- Uses `ActionGet` to execute database queries and `DataCleaner` to clean up the data before returning it.
- **Values are bound, never concatenated** (`$1`, `$2`, …). What may be bound is
  defined in `actions/bindableValue.js`: scalars, `null`, arrays and plain
  objects. For a `json`/`jsonb` column pass the **object** — the driver
  serializes it. Passing its JSON text encodes it twice and stores a JSON
  string, which `->>` cannot read a field from (see `doc/authentication.md`,
  „Writing this column").

### Example Workflow

1. **Data Request**:
   - A request for data is made through `DataFacade.getData(parameterObject)`.

2. **Cache Check**:
   - `DataFacade` uses `DataCache2` to check if the requested data is available in the cache.
   - `DataCache2.get(key)` generates the cache key and retrieves data from Redis.

3. **Database Query**:
   - If the data is not in the cache, `DataStorage` is used to query the database.
   - For content, `NodeContentRepository` queries `node` / `content_node` /
     `content_item`; for `configuration` and `identity`, `DataStorage` does.

4. **Cache Update**:
   - The fetched data is then cached using `DataCache2.set(key, value)` for future requests.

5. **Data Return**:
   - The data is returned to the caller, either from the cache or directly from the database.
