## Overview

This document describes how the `DataFacade`, `DataMock`, `DataCache`, and `DataStorage` classes work together to provide a seamless data retrieval and caching mechanism for the application.

### DataFacade
- Acts as the main entry point for data retrieval.
- Determines whether to return a promise or synchronous data based on the `parameterObject`.
- Checks if mock data is enabled and uses `DataMock` if true.
- Otherwise, it uses `DataCache` and `DataStorage` to fetch and cache data.

### DataMock
- Provides mock data for testing purposes.
- When mock data is enabled, `DataFacade` uses `DataMock` to create and return mock configurations.

### DataCache
- Manages caching of data to improve performance and reduce database load.
- Uses `RedisConnector` to interact with a Redis cache.
- Generates cache keys using `CacheKeyGeneratorFactory` and its associated key generator classes.
- Retrieves data from the cache if available; otherwise, it fetches data from `DataStorage` and caches it.

### DataStorage
- Interacts with the database to fetch data.
- Contains methods to query different types of data (e.g., paragraphs, configurations, stories, chapters).
- Uses `ActionGet` to execute database queries and `DataCleaner` to clean up the data before returning it.

### Example Workflow
1. **Data Request**:
   - A request for data is made through `DataFacade.getData(parameterObject)`.

2. **Mock Data Check**:
   - `DataFacade` checks if mock data is enabled using `DataFacade.isDataMockEnabled()`.
   - If enabled, `DataMock.createConfiguration()` is called to return mock data.

3. **Cache Check**:
   - If mock data is not enabled, `DataFacade` uses `DataCache2` to check if the requested data is available in the cache.
   - `DataCache2.get(key)` generates the cache key and retrieves data from Redis.

4. **Database Query**:
   - If the data is not in the cache, `DataStorage` is used to query the database.
   - `DataStorage` methods (e.g., `queryConfiguration`, `queryParagraphs`) fetch data from the database.

5. **Cache Update**:
   - The fetched data is then cached using `DataCache2.set(key, value)` for future requests.

6. **Data Return**:
   - The data is returned to the caller, either from the cache or directly from the database.
