## Overview

This document describes how the `DataFacade`, `DataCache`, and `DataStorage` classes work together to provide a seamless data retrieval and caching mechanism for the application.

### DataFacade

- Acts as the main entry point for data retrieval.
- Determines whether to return a promise or synchronous data based on the `parameterObject`.
- Uses `DataCache` and `DataStorage` to fetch and cache data.

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
