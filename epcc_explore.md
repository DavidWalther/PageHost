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

## Questions (Unklarheiten)
1. **Coexistence:** Should the existing `1.0` endpoints remain functional alongside `2.0` (side-by-side), or is this a complete replacement/migration?
2. **Factory Responsibility:** Will the new Factory be responsible for routing (mapping a URL/request to an endpoint) or strictly for the instantiation of the endpoint classes?
3. **Directory Root:** Should the new structure (`data`, `actions`, `metadata`, `authentication`, `others`) be a sub-directory of `private/api/v2/` or a top-level structure within `private/`?
4. **Metadata Definition:** What specific types of information or files should reside in the `metadata` folder? (e.g., OpenAPI/Swagger specs, route definitions, etc.)
5. **Migration of Database Logic:** Are the existing components in `private/database2` intended to be moved into the new `data` or `actions` folders?
6. **Definition of 'Others':** What types of utilities or logic should be placed in the `others` folder?

## Affected Components
- `private/endpoints/EndpointLogic.js` (Refactoring to Factory)
- `private/endpoints/api/1.0/auth/LogoutEndpoint.js` (Migration to 2.0)
- `private/database2/DataCache/DataCache.js` (Potential reorganization)
- `private/database2/DataFacade.js` (Potential reorganization)
- `private/database2/...` (Potential reorganization)
