# Endpoint Architecture Implementation Guide

## Overview
This document provides a comprehensive guide for implementing new endpoints in the PageHost application, based on analysis of existing endpoint patterns and architectural decisions.

---

## Key Environment Variables Reference

Understanding the environment variables used in the application is crucial for proper endpoint implementation and testing.

### Core Application Variables
| Variable | Purpose | Example Value | Required |
|----------|---------|---------------|----------|
| `APPLICATION_APPLICATION_KEY` | Unique identifier for app instance | `'app-key-123'` | Yes |
| `APPLICATION_ACTIVE_ACTIONS` | JSON array of allowed operations | `'["edit","create","delete"]'` | Yes |
| `MOCK_DATA_ENABLE` | Enable/disable mock data sources | `'false'` | Yes |
| `LOGGING_SEVERITY_LEVEL` | Control logging verbosity | `'DEBUG'` | No |

### Authentication Variables
| Variable | Purpose | Example Value | Required |
|----------|---------|---------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `'client-id-123.googleusercontent.com'` | For auth endpoints |
| `AUTH_OIDC_REDIRECT_URI` | OAuth redirect URI | `'https://app.example.com'` | For auth endpoints |
| `AUTH_SERVER_SECRET` | Server secret for token generation | `'secret-key-456'` | For auth endpoints |
| `AUTH_REGISTERED_USER_EMAIL` | Allowed user email | `'user@example.com'` | For auth endpoints |

### Database/Cache Variables  
| Variable | Purpose | Example Value | Required |
|----------|---------|---------------|----------|
| `REDIS_HOST` | Redis cache host | `'localhost'` | For cache operations |
| `REDIS_PORT` | Redis cache port | `'6379'` | For cache operations |
| `REDIS_PASSWORD` | Redis authentication | `'redis-password'` | For cache operations |
| `DATABASE_URL` | PostgreSQL connection string | `'postgresql://...'` | For database operations |

---

## Table of Contents
- [Endpoint Architecture Overview](#endpoint-architecture-overview)
- [Core Components](#core-components)
- [Authentication & Authorization](#authentication--authorization)
- [Endpoint Categories](#endpoint-categories)
- [Implementation Patterns](#implementation-patterns)
- [Permission System](#permission-system)
- [Cache Management](#cache-management)
- [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
- [Testing Requirements](#testing-requirements)
- [Common Patterns Reference](#common-patterns-reference)

---

## Endpoint Architecture Overview

### Design Pattern
The application uses a **Factory Pattern** with inheritance-based endpoint logic:
- **Base Class**: `EndpointLogic` - provides common interface and fluent API
- **Concrete Endpoints**: Inherit from `EndpointLogic` and implement specific business logic
- **Factory Classes**: Route requests to appropriate endpoint implementations (legacy pattern)
- **Direct Registration**: Current preferred approach for new endpoints

### Request Flow
```
1. HTTP Request → server.js
2. Route Matching
3. Authentication Check (if required)
4. Endpoint Instantiation
5. Configuration Chain: .setEnvironment().setRequestObject().setResponseObject()
6. Scope Assignment (if authenticated)
7. Execute Business Logic
8. Response Handling
```

---

## Core Components

### EndpointLogic Base Class
**Location**: `private/endpoints/EndpointLogic.js`

**Provides**:
- Fluent interface with method chaining
- Common properties: `environment`, `requestObject`, `responseObject`, `scopes`
- Required method: `execute()` - must be implemented by subclasses
- Utility method: `getClassName()`

**Usage Pattern**:
```javascript
const endpoint = new ConcreteEndpoint()
  .setEnvironment(environment)
  .setRequestObject(req)
  .setResponseObject(res);

if (scopes) {
  endpoint.setScopes(new Set(scopes));
}

await endpoint.execute();
```

### Factory Classes (Legacy)
- **DataQueryLogicFactory**: Routes `/data/query/*` requests based on table type
- **WildcardLogicFactory**: Handles static files and fallback requests
- **MetadataEndpointLogicFactory**: Manages metadata-related endpoints

**Note**: New endpoints should use direct registration in `server.js` rather than factories.

---

## Authentication & Authorization

### Authentication Flow
1. **Bearer Token Extraction**: `req.headers['authorization']?.split(' ')[1]`
2. **Token Validation**: Via `AccessTokenService`
3. **Scope Retrieval**: Get user scopes associated with token
4. **Permission Check**: Validate required scopes and environment permissions

### Authorization Levels
1. **Server-Level Pre-Authorization** (Most Restrictive)
2. **Environment-Level Permissions** (System-wide toggles)
3. **Endpoint-Level Scope Logic** (Feature enhancement)

### Permission Formula
```
Permission Granted = (User has required scope) AND (Environment allows action)
```

---

## Endpoint Categories

### 1. Data Query Endpoints (`/data/query/*`)
**Purpose**: Read operations for published/unpublished content
**Location**: `private/endpoints/data/query/`
**Authentication**: Optional (enhances behavior for authenticated users)
**Examples**: `SingleStoryEndpoint`, `ChapterEndpoint`, `ParagraphEndpoint`

**Characteristics**:
- Public access to published content
- Enhanced access to unpublished content for authenticated users
- Cache bypass for users with edit scope
- Content filtering based on publishDate

### 2. API Endpoints (`/api/1.0/...`)
**Purpose**: CRUD operations, configuration, authentication
**Location**: `private/endpoints/api/1.0/`
**Authentication**: Required for data manipulation, optional for configuration
**Versioning**: Uses `/api/1.0/` until breaking changes require version bump

**Subcategories**:
- **Auth**: OAuth2, logout (`auth/`)
- **Data Operations**: CRUD operations (`data/`)
- **Environment**: Public configuration (`environmetVariables.js`)

### 3. Static/Metadata Endpoints
**Purpose**: System files, manifests, sitemaps
**Location**: `private/endpoints/*/` and `private/endpoints/metadata/`
**Authentication**: None required
**Examples**: `ManifestEndpointLogic`, `RobotsEndpointLogic`

---

## Implementation Patterns

### Pattern A: Server-Level Pre-Authorization (Preferred)
**Use Case**: Data manipulation endpoints, destructive operations
**Implementation**: Authentication check in `server.js` before endpoint execution

```javascript
app.post('/api/1.0/data/change/*', async (req, res) => {
  const LOCATION = 'Server.post(\'/api/1.0/data/change/*\')';
  
  let bearerToken = req.headers['authorization']?.split(' ')[1];
  let accessTokenService = new AccessTokenService().setEnvironment(environment);
  
  if(!accessTokenService.isBearerValidFromScope(bearerToken, ['edit'])) {
    Logging.debugMessage({ severity: 'INFO', message: `Bearer token is invalid`, location: LOCATION });
    res.status(401).send('Unauthorized');
    return;
  }
  
  const endpoint = new ConcreteEndpoint();
  endpoint.setEnvironment(environment)
    .setRequestObject(req)
    .setResponseObject(res)
    .execute();
});
```

### Pattern B: Endpoint-Level Optional Auth
**Use Case**: Public data with enhanced access for authenticated users
**Implementation**: Optional authentication in factory flow

```javascript
app.get('/data/query/*', async (req, res) => {
  const selectedEndpoint = DataQueryLogicFactory.getProduct(req);
  
  const bearerToken = req.headers['authorization']?.split(' ')[1];
  if (bearerToken) {
    let accessTokenService = new AccessTokenService();
    let userScopes = await accessTokenService.setEnvironment(environment).getScopesForBearer(bearerToken);
    
    if (userScopes) {
      selectedEndpoint.setScopes(new Set(userScopes));
    }
  }
  
  selectedEndpoint.setEnvironment(environment)
    .setRequestObject(req)
    .setResponseObject(res)
    .execute();
});
```

---

## Permission System

### Scope Types
- **`edit`**: Modify existing records, view unpublished content
- **`create`**: Create new records  
- **`delete`**: Delete records

**Note**: Currently all authenticated users receive all scopes, but this may change.

### Environment Permissions
**Variable**: `APPLICATION_ACTIVE_ACTIONS`
**Format**: JSON array of allowed actions
**Purpose**: System-wide feature toggles for different deployment environments

**Example**:
```json
["edit", "create", "delete"]
```

### Permission Checking Pattern
```javascript
// Environment permission setup
const environentAllowedDmls = this.environment.APPLICATION_ACTIVE_ACTIONS || '[]';
let allowedDmls = JSON.parse(environentAllowedDmls).map(permission => permission.toLowerCase());
this._allowedDmls = new Set(allowedDmls);

// Permission getters
get isAllowedEdit() {
  return this._allowedDmls.has('edit');
}

get isAllowedCreate() {
  return this._allowedDmls.has('create');
}

get isAllowedDelete() {
  return this._allowedDmls.has('delete');
}
```

---

## Cache Management

### Cache Strategy
- **DataFacade**: Orchestrates between cache and storage
- **Cache Purpose**: Reduce database load for frequently accessed published content
- **Cache Bypass**: Required for real-time data access

### Cache Bypass Rules
```javascript
// Skip cache for users with edit scope (to see real-time data)
if(this.scopes?.has('edit')) {
  dataFacade.setSkipCache(true);
}
```

**Important**: Cache bypass is specifically for users with **edit scope**, not all authenticated users.

### Content Filtering
```javascript
// Show unpublished content to editors
if(this.scopes?.has('edit')) {
  parameterObject.request.publishDate = null;  // No date filter - show all content
} 
// Default behavior: publishDate = undefined shows content published <= NOW
```

---

## Step-by-Step Implementation Guide

### Step 1: Create Endpoint Class
```javascript
const { EndpointLogic } = require('../../../EndpointLogic.js');
const { Logging } = require('../../../../modules/logging.js');
const { DataFacade } = require('../../../../database2/DataFacade.js');

class NewEndpoint extends EndpointLogic {
  async execute() {
    const LOCATION = 'NewEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION });

    // Implementation here
  }
}

module.exports = NewEndpoint;
```

### Step 2: Add Route to server.js
Choose appropriate authentication pattern and add route:

```javascript
// For protected endpoints
app.post('/api/1.0/new-endpoint', async (req, res) => {
  const LOCATION = 'Server.post(\'/api/1.0/new-endpoint\')';
  
  // Authentication if required
  let bearerToken = req.headers['authorization']?.split(' ')[1];
  let accessTokenService = new AccessTokenService().setEnvironment(environment);
  
  if(!accessTokenService.isBearerValidFromScope(bearerToken, ['required_scope'])) {
    res.status(401).send('Unauthorized');
    return;
  }
  
  const NewEndpoint = require('./private/endpoints/api/1.0/new-endpoint.js');
  const endpoint = new NewEndpoint();
  endpoint.setEnvironment(environment)
    .setRequestObject(req)
    .setResponseObject(res)
    .execute();
});
```

### Step 3: Implement Business Logic
Follow established patterns for:
- Input validation
- Permission checking (if needed)
- DataFacade usage
- Error handling
- Response formatting

### Step 4: Add Tests
Create both unit and integration tests following existing patterns.

---

## Testing Requirements

### Unit Tests
**Focus**: Implementation details, isolated component behavior
**Location**: `__tests__/` directory alongside endpoint file
**Pattern**: Mock dependencies (`DataStorage`, `DataCache`, `Logging`)

### Integration Tests
**Focus**: End-to-end use cases, real workflow scenarios
**Location**: `private/__tests__/endpointIntegration.tests.js`
**Pattern**: Test complete request/response cycle

### Mock Dependency Patterns

#### Standard Mocks Setup
```javascript
// Mock external dependencies
jest.mock('../../../../database2/DataFacade');
jest.mock('../../../../modules/logging');
jest.mock('../../../../database2/DataCache/DataCache');

// Clear mocks in beforeEach
beforeEach(() => {
  DataFacade.mockClear();
  Logging.debugMessage.mockClear();
  // Reset all mocks to clean state
});
```

#### DataFacade Mocking
```javascript
beforeEach(() => {
  const mockDataFacadeInstance = {
    setSkipCache: jest.fn().mockReturnThis(),
    getData: jest.fn().mockResolvedValue({ id: '123', data: 'test' }),
    createData: jest.fn().mockResolvedValue({ id: 'new123', data: 'created' }),
    updateData: jest.fn().mockResolvedValue({ id: '123', data: 'updated' }),
    deleteData: jest.fn().mockResolvedValue(true)
  };

  DataFacade.mockImplementation(() => mockDataFacadeInstance);
});
```

#### Scope Testing Patterns
```javascript
it('should set skipCache on DataFacade when the "edit" scope is set', async () => {
  const mockFacadeSetSkipCache = jest.fn().mockReturnThis();
  DataFacade.mockImplementation(() => ({
    setSkipCache: mockFacadeSetSkipCache,
    getData: jest.fn().mockResolvedValue({ id: '123' })
  }));

  // Set edit scope
  endpoint.setScopes(new Set(['edit']));
  await endpoint.execute();

    expect(mockFacadeSetSkipCache).toHaveBeenCalledWith(true);
});
```

---

## Testing Best Practices

### Test File Organization
- **Unit tests**: Place in `__tests__/` directory alongside the endpoint file
- **Integration tests**: Place in `private/__tests__/endpointIntegration.tests.js`
- **Naming**: Use `.tests.js` or `.test.js` suffix

### Essential Test Categories

#### 1. Happy Path Tests
```javascript
it('should successfully process valid request', async () => {
  const mockData = { id: '123', title: 'Test' };
  DataFacade.mockImplementation(() => ({
    getData: jest.fn().mockResolvedValue(mockData)
  }));

  await endpoint.execute();
  
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ success: true, result: mockData });
});
```

#### 2. Permission/Security Tests
```javascript
it('should deny access when required scope is missing', async () => {
  mockEnvironment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify([]); // No permissions
  
  endpoint.setEnvironment(mockEnvironment);
  await endpoint.execute();
  
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
});
```

#### 3. Input Validation Tests
```javascript
it('should return 400 for invalid request data', async () => {
  req.body = { invalidData: true }; // Missing required fields
  
  await endpoint.execute();
  
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
});
```

#### 4. Error Handling Tests
```javascript
it('should handle database errors gracefully', async () => {
  DataFacade.mockImplementation(() => ({
    getData: jest.fn().mockRejectedValue(new Error('Database error'))
  }));

  await endpoint.execute();
  
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Database error' });
});
```

#### 5. Scope-Based Behavior Tests
```javascript
it('should skip cache for users with edit scope', async () => {
  const mockSetSkipCache = jest.fn().mockReturnThis();
  DataFacade.mockImplementation(() => ({
    setSkipCache: mockSetSkipCache,
    getData: jest.fn().mockResolvedValue({})
  }));

  endpoint.setScopes(new Set(['edit']));
  await endpoint.execute();
  
  expect(mockSetSkipCache).toHaveBeenCalledWith(true);
});
```

### Mock Management Best Practices

#### Clean Slate Pattern
```javascript
beforeEach(() => {
  // Clear all mocks to prevent test interdependence
  jest.clearAllMocks();
  
  // Reset to default mock implementations
  DataFacade.mockClear();
  Logging.debugMessage.mockClear();
});

afterEach(() => {
  // Additional cleanup if needed
  jest.resetAllMocks();
});
```

#### Reusable Mock Factories
```javascript
// Create helper functions for common mock scenarios
function createMockDataFacade(overrides = {}) {
  const defaults = {
    setSkipCache: jest.fn().mockReturnThis(),
    getData: jest.fn().mockResolvedValue({}),
    createData: jest.fn().mockResolvedValue({}),
    updateData: jest.fn().mockResolvedValue({}),
    deleteData: jest.fn().mockResolvedValue(true)
  };
  
  return { ...defaults, ...overrides };
}

// Usage in tests
DataFacade.mockImplementation(() => createMockDataFacade({
  getData: jest.fn().mockRejectedValue(new Error('Test error'))
}));
```

---
});
```

### Environment Mocking Patterns

Based on analysis of existing tests, here are the standard environment mocking patterns:

#### Basic Environment Mock Setup
```javascript
describe('NewEndpoint', () => {
  let req, res, mockEnvironment, endpoint;

  beforeEach(() => {
    // Standard environment mock with commonly used variables
    mockEnvironment = {
      APPLICATION_APPLICATION_KEY: 'test-key',
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'create', 'delete']),
      MOCK_DATA_ENABLE: 'false',
      LOGGING_SEVERITY_LEVEL: 'DEBUG'
    };

    // Standard request/response mocks
    req = { 
      url: '/api/1.0/test', 
      body: { object: 'test', payload: { key: 'value' } },
      query: { id: '123' },
      headers: { 'authorization': 'Bearer test-token' }
    };
    
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn() 
    };
  });
});
```

#### Environment Variables by Category

**Core Application Variables**:
```javascript
mockEnvironment = {
  APPLICATION_APPLICATION_KEY: 'test-key',           // Required for most endpoints
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'create', 'delete']), // Permissions
  MOCK_DATA_ENABLE: 'false',                        // Data source control
  LOGGING_SEVERITY_LEVEL: 'DEBUG'                   // Logging control
};
```

**Authentication Variables** (for auth-related tests):
```javascript
mockEnvironment = {
  ...mockEnvironment,
  GOOGLE_CLIENT_ID: 'test-client-id',
  AUTH_OIDC_REDIRECT_URI: 'http://localhost:3000',
  AUTH_SERVER_SECRET: 'test-secret',
  AUTH_REGISTERED_USER_EMAIL: 'test@example.com'
};
```

**Database/Cache Variables** (for data operation tests):
```javascript
mockEnvironment = {
  ...mockEnvironment,
  REDIS_HOST: 'test-host',
  REDIS_PORT: 'test-port', 
  REDIS_PASSWORD: 'test-password',
  DATABASE_URL: 'test-db-url'
};
```

#### Dynamic Environment Variable Testing
```javascript
it('should deny create if not allowed in environment', async () => {
  // Modify environment for specific test case
  mockEnvironment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['edit']); // Remove 'create'
  
  endpoint = new NewEndpoint()
    .setEnvironment(mockEnvironment)
    .setRequestObject(req)
    .setResponseObject(res);
    
  await endpoint.execute();
  
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
});
```

### Test Structure Example
```javascript
describe('NewEndpoint', () => {
  let req, res, mockEnvironment, endpoint;

  beforeEach(() => {
    // Environment setup
    mockEnvironment = {
      APPLICATION_APPLICATION_KEY: 'test-key',
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'create']),
      MOCK_DATA_ENABLE: 'false'
    };

    // Request/Response setup
    req = { url: '/api/1.0/test', body: { object: 'test', payload: { key: 'value' } } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('should handle valid request', async () => {
    endpoint = new NewEndpoint()
      .setEnvironment(mockEnvironment)
      .setRequestObject(req)
      .setResponseObject(res);
      
    await endpoint.execute();
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should handle authentication failure', async () => {
    // Test with restricted permissions
    mockEnvironment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify([]);
    
    endpoint = new NewEndpoint()
      .setEnvironment(mockEnvironment)
      .setRequestObject(req)
      .setResponseObject(res);
      
    await endpoint.execute();
    
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
```

---

## Common Patterns Reference

### Standard Endpoint Structure
```javascript
class ConcreteEndpoint extends EndpointLogic {
  async execute() {
    const LOCATION = 'ConcreteEndpoint.execute';
    Logging.debugMessage({severity:'INFO', message: 'Starting execution', location: LOCATION});
    
    try {
      // 1. Input validation
      if (!this.validateInput()) {
        this.responseObject.status(400).json({ success: false, error: 'Invalid input' });
        return;
      }
      
      // 2. Permission checking
      if (!this.checkPermissions()) {
        this.responseObject.status(403).json({ success: false, error: 'Permission denied' });
        return;
      }
      
      // 3. Business logic
      const result = await this.performOperation();
      
      // 4. Success response
      this.responseObject.status(200).json({ success: true, result });
      
    } catch (error) {
      Logging.debugMessage({severity:'ERROR', message: `Operation failed: ${error.message}`, location: LOCATION});
      this.responseObject.status(500).json({ success: false, error: error.message });
    }
  }
}
```

### DataFacade Usage
```javascript
// Standard data operations
let dataFacade = new DataFacade(this.environment);

// Skip cache for real-time data (edit scope users)
if(this.scopes?.has('edit')) {
  dataFacade.setSkipCache(true);
}

// Query operations
const result = await dataFacade.getData(parameterObject);

// Create operations
const newRecord = await dataFacade.createData(data);

// Update operations  
const updatedRecord = await dataFacade.updateData(data);

// Delete operations
await dataFacade.deleteData({ object, id });
```

### Error Response Patterns
```javascript
// Bad Request (400)
this.responseObject.status(400).json({ success: false, error: 'Invalid request data' });

// Unauthorized (401) 
this.responseObject.status(401).json({ error: 'Unauthorized' });

// Forbidden (403)
this.responseObject.status(403).json({ success: false, error: 'Permission denied' });

// Internal Server Error (500)
this.responseObject.status(500).json({ success: false, error: error.message });

// Success (200)
this.responseObject.status(200).json({ success: true, result });
```

### Logging Patterns
```javascript
const LOCATION = 'EndpointName.methodName';

// Info level - major operations
Logging.debugMessage({severity:'INFO', message: 'Starting operation', location: LOCATION});

// Error level - exceptions
Logging.debugMessage({severity:'ERROR', message: `Operation failed: ${error.message}`, location: LOCATION});

// Finer level - detailed flow
Logging.debugMessage({severity:'FINER', message: 'Processing data', location: LOCATION});

// Finest level - granular debugging
Logging.debugMessage({severity:'FINEST', message: 'Checking permissions', location: LOCATION});
```

---

## Best Practices

### Security
1. Always validate input data
2. Use appropriate authentication pattern for endpoint type
3. Check both scope and environment permissions for protected operations
4. Log security-related events appropriately

### Performance
1. Use cache appropriately - skip only when necessary
2. Minimize database queries
3. Handle errors gracefully to avoid resource leaks

### Maintainability
1. Follow established naming conventions
2. Use consistent logging patterns
3. Implement comprehensive tests
4. Document business logic clearly

### Error Handling
1. Provide meaningful error messages
2. Use appropriate HTTP status codes
3. Log errors with sufficient context
4. Handle edge cases gracefully

---

## Future Considerations

### Planned Improvements
- **Factory Pattern Migration**: Long-term goal to move all endpoints to factory pattern
- **Error Response Standardization**: Existing ticket for consistent error formatting
- **Logging Standardization**: Existing ticket for consistent logging patterns
- **User Role System**: May replace current single-user scope system

### Extensibility
The current architecture supports easy extension through:
- Direct route registration in `server.js`
- Inheritance from `EndpointLogic` base class
- Consistent permission and caching patterns
- Standardized testing approaches

This architecture allows new endpoints to be added with minimal filesystem changes while maintaining consistency with existing patterns.

---

## Conclusion

This guide provides all necessary information to implement new endpoints following established architectural patterns. The key is to:

1. Choose the appropriate authentication pattern based on endpoint purpose
2. Follow the dual permission system (scopes + environment)
3. Handle caching correctly for different user types
4. Implement comprehensive tests
5. Use consistent error handling and logging

For specific implementation questions, refer to existing endpoints as examples and follow the patterns documented here.
