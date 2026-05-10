# Explore: API Version 2.0 Implementation

## Goal
Implement a new API version (2.0) featuring a centralized Factory for endpoint logic and a new, organized directory structure.

## Requirements
- Implement a single Factory for creating instances of endpoint logic.
- Implement a clear directory structure:
    - `data`
        - `actions`
        - `metadata`
        - `authentication`
        - `others`

## Findings
- The current API versioning is handled via folder structure (e.g., `private/endpoints/api/1.0/`).
- `EndpointLogic.js` currently exists but needs to be refactored into a Factory pattern.
- The current data access layer relies heavily on `DataFacade` and `DataCache2`.
- `DataFacade` acts as an orchestrator, handling logic for different table types (`configuration`, `paragraph`, `story`, `chapter`, `identity`) and managing the switch between cached and non-cached data access.
- `DataCache2` provides an abstraction for Redis-based caching with specific key generation logic for different entity types.
- The existing `private/database2` structure is tightly coupled with the data access logic in `DataFacade`.

## Answers
1. **Coexistence:** Both versions (1.0 and 2.0) must stay functional.
2. **Factory Responsibility:** The new factory will only provide instances of `EndpointLogic`; the routing itself will be handled by `server.js`.
3. **Directory Root:** The new implementation of the new API must be done in `private/endpoints/api/2.0/`.
4. **Metadata Definition:** Contains information about the page/Webapp (e.g., `manifest.json`).
5. **Migration of Database Logic:** The content of `private/database2` must remain unaffected.
6. **Definition of 'Others':** Everything that does not fit the other categories (e.g., `NotFoundEndpointLogic.js` or `IndexHtmlEndpointLogic.js`).

## Affected Components
- `private/endpoints/EndpointLogic.js` (Refactoring to Factory)
- `private/endpoints/api/2.0/EndpointFactory.js` (New Factory)
- `server.js` (New routing for 2.0)
- `private/endpoints/api/1.0/auth/LogoutEndpoint.js` (Migration to 2.0)
- `private/database2/...` (Potential reorganization - though content remains unaffected)
