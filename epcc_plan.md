# Plan: API Version 2.0 Implementation

## Goal
Implement a new API version (2.0) featuring a centralized Factory for endpoint logic and a new, organized directory structure.

## Plan
- [ ] Step 0 - Baseline
    - [x] Run existing tests to ensure current functionality is intact.
- [ ] Step 1 - Setup Directory Structure
    - [ ] Create `private/endpoints/api/2.0/data`
    - [ ] Create `private/endpoints/api/2.0/actions`
    - [ ] Create `private/endpoints/api/2.0/metadata`
    - [ ] Create `private/endpoints/api/2.0/authentication`
    - [ ] Create `private/endpoints/api/2.0/others`
- [ ] Step 2 - Implement `EndpointFactory`
    - [ ] Create `private/endpoints/api/2.0/EndpointFactory.js`
    - [ ] Implement logic to dynamically require endpoint classes based on the request path.
- [ ] Step 3 - Implement a sample 2.0 endpoint
    - [ ] Create `private/endpoints/api/2.0/metadata/ManifestEndpoint.js` (to serve manifest info).
- [ ] Step 4 - Update `server.js`
    - [ ] Add a generic route handler for `/api/2.0/*` that uses the new `EndpointFactory`.
- [ ] Step 5 - Verification
    - [ ] Verify 1.0 endpoints are still functional and unaffected.
    - [ ] Verify 2.0 endpoint is functional and returns correct data.
