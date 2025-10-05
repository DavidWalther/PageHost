# Publish Endpoint Implementation Documentation

## Overview

The publish endpoint provides functionality to publish unpublished content (paragraphs, chapters, stories) by setting their `publishDate` to the current timestamp. This implementation follows an event-driven architecture pattern with comprehensive validation, caching strategies, and error handling.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Server-Level Implementation](#server-level-implementation)
- [Endpoint Logic Implementation](#endpoint-logic-implementation)
- [Frontend Integration](#frontend-integration)
- [Event Flow](#event-flow)
- [Cache Strategy](#cache-strategy)
- [Error Handling](#error-handling)
- [Security & Authorization](#security--authorization)
- [Testing](#testing)

---

## Architecture Overview

### Components Involved

1. **Custom Paragraph Component** (`custom-paragraph.js`)
   - UI component with publish toggle
   - Fires publish events via event system
   - Handles user interactions and feedback

2. **Event Handler** (`index.js`)
   - Catches publish events from components
   - Handles authentication token extraction
   - Makes HTTP requests to publish endpoint

3. **Server Route** (`server.js`)
   - Defines `/api/1.0/actions/publish` endpoint
   - Handles authentication and authorization
   - Routes to PublishEndpoint class

4. **Publish Endpoint** (`publishEndpoint.js`)
   - Business logic implementation
   - Validation, record checking, and publishing
   - Uses DataFacade for database operations

### Data Flow

```
Custom Component → Event System → HTTP Request → Server Auth → Endpoint Logic → DataFacade → Database
```

---

## Server-Level Implementation

### Route Definition

**File**: `server.js`
**Route**: `PATCH /api/1.0/actions/publish`

```javascript
app.patch('/api/1.0/actions/publish', async (req, res) => {
  const LOCATION = 'Server.patch(\'/api/1.0/actions/publish\')';
  Logging.debugMessage({ severity: 'INFO', message: `Request received - ${req.url}`, location: LOCATION });

  // Extract bearer token from headers
  let headers = req.headers;
  let bearerToken = headers['authorization']?.split(' ')[1];
  let accessTokenService = new AccessTokenService().setEnvironment(environment);

  // Validate token and required scopes
  if(!accessTokenService.isBearerValidFromScope(bearerToken, ['publish', 'edit'])) {
    Logging.debugMessage({ severity: 'INFO', message: `Bearer token is invalid or missing required scopes`, location: LOCATION });
    res.status(401).send('Unauthorized');
    return;
  }

  // Execute endpoint logic
  const endpoint = new PublishEndpoint();
  endpoint.setEnvironment(environment)
    .setRequestObject(req)
    .setResponseObject(res)
    .execute()
    .then(() => {
      Logging.debugMessage({ severity: 'INFO', message: `Publish Endpoint executed`, location: LOCATION });
    });
});
```

### Authentication Requirements

- **Bearer Token**: Required in `Authorization` header
- **Scopes**: Must have both `publish` and `edit` scopes
- **Pattern**: Server-level pre-authorization (Pattern A from architecture guide)

---

## Endpoint Logic Implementation

### Class Structure

**File**: `private/endpoints/api/1.0/action/publishEndpoint.js`

```javascript
class PublishEndpoint extends EndpointLogic {
  async execute()        // Main execution logic
  validateInput()        // Input validation
  async getRecord()      // Record existence checking
  async publishRecord()  // Publishing operation
}
```

### Request/Response Format

#### Request Body
```javascript
{
  "object": "paragraph",  // Required: "paragraph", "chapter", or "story"
  "id": "12345"          // Required: Record ID to publish
}
```

#### Success Response (200)
```javascript
{
  "success": true
}
```

#### Error Responses

**400 - Invalid Input**:
```javascript
{
  "success": false,
  "error": "Invalid request data"
}
```

**404 - Record Not Found**:
```javascript
{
  "success": false,
  "error": "Record not found"
}
```

**400 - Already Published**:
```javascript
{
  "success": false,
  "error": "Record is already published"
}
```

**500 - Server Error**:
```javascript
{
  "success": false,
  "error": "Error message details"
}
```

### Main Execution Logic

```javascript
async execute() {
  const LOCATION = 'PublishEndpoint.execute';
  Logging.debugMessage({ severity: 'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION });

  try {
    // 1. Input validation
    if (!this.validateInput()) {
      this.responseObject.status(400).json({ success: false, error: 'Invalid request data' });
      return;
    }

    // 2. Extract payload from request body
    const { object, id } = this.requestObject.body;

    // 3. Get record to check if it exists and current publish status
    const existingRecord = await this.getRecord(object, id);
    if (!existingRecord) {
      this.responseObject.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    // 4. Check if already published
    if (existingRecord.publishDate) {
      this.responseObject.status(400).json({ success: false, error: 'Record is already published' });
      return;
    }

    // 5. Update publishDate to NOW
    await this.publishRecord(object, id);

    // 6. Success response
    this.responseObject.status(200).json({ success: true });

  } catch (error) {
    Logging.debugMessage({severity:'ERROR', message: `Operation failed: ${error.message}`, location: LOCATION});
    this.responseObject.status(500).json({ success: false, error: error.message });
  }
}
```

### Input Validation

```javascript
validateInput() {
  const LOCATION = 'PublishEndpoint.validateInput';

  // Check request body exists
  if (!this.requestObject.body) {
    Logging.debugMessage({ severity: 'INFO', message: 'Missing request body', location: LOCATION });
    return false;
  }

  const { object, id } = this.requestObject.body;

  // Validate object parameter
  if (!object || typeof object !== 'string') {
    Logging.debugMessage({ severity: 'INFO', message: 'Missing or invalid object parameter', location: LOCATION });
    return false;
  }

  // Validate id parameter
  if (!id || typeof id !== 'string') {
    Logging.debugMessage({ severity: 'INFO', message: 'Missing or invalid id in payload', location: LOCATION });
    return false;
  }

  // Validate supported object types
  const supportedObjects = ['paragraph', 'chapter', 'story'];
  if (!supportedObjects.includes(object.toLowerCase())) {
    Logging.debugMessage({ severity: 'INFO', message: `Unsupported object type: ${object}`, location: LOCATION });
    return false;
  }

  return true;
}
```

### Record Retrieval with Cache Skip

```javascript
async getRecord(object, id) {
  const LOCATION = 'PublishEndpoint.getRecord';

  try {
    // Create DataFacade instance with cache skipping enabled
    const dataFacade = new DataFacade(this.environment).setSkipCache(true);

    // Fetch the record
    const result = await dataFacade.getData({
      request: {
        table: object.toLowerCase(),
        id: id
      }
    });

    return result;

  } catch (error) {
    Logging.debugMessage({severity:'ERROR', message: `Failed to get record: ${error.message}`, location: LOCATION});
    throw error;
  }
}
```

### Publishing Operation

```javascript
async publishRecord(object, id) {
  const LOCATION = 'PublishEndpoint.publishRecord';

  try {
    // Create DataFacade instance with cache skipping enabled
    const dataFacade = new DataFacade(this.environment).setSkipCache(true);

    // Prepare update data with current timestamp
    const updateData = {
      object: object.toLowerCase(),
      payload: {
        id: id,
        publishDate: new Date().toISOString()
      }
    };

    // Execute the update
    const result = await dataFacade.updateData(updateData);

    Logging.debugMessage({ severity: 'INFO', message: `Record published successfully: ${object} ${id}`, location: LOCATION });

    return result;

  } catch (error) {
    Logging.debugMessage({severity:'ERROR', message: `Failed to publish record: ${error.message}`, location: LOCATION});
    throw error;
  }
}
```

---

## Frontend Integration

### Custom Paragraph Component

**File**: `public/components/custom-paragraph/custom-paragraph.js`

#### Publish Toggle UI

The component includes a publish toggle in the settings tab:

```javascript
renderSettingsTab(paragraphData) {
  const canPublish = this.checkPublishPermission();
  const isPublished = paragraphData?.publishDate ? true : false;
  const isToggleDisabled = !canPublish || this.draftMode;

  return html`
    <slds-toggle
      label="Published"
      enabled-label="Published"
      disabled-label="Unpublished"
      name="publish-toggle"
      ?checked=${isPublished}
      ?disabled=${isToggleDisabled}
      @toggle=${this.handlePublishToggleChange}
    ></slds-toggle>
  `;
}
```

#### Permission Checking

```javascript
checkPublishPermission() {
  const authData = sessionStorage.getItem('code_exchange_response');
  if (!authData) return false;
  
  try {
    const parsedData = JSON.parse(authData);
    const scopes = parsedData?.authenticationResult.access?.scopes || [];
    return scopes.includes('publish') && scopes.includes('edit');
  } catch (e) {
    return false;
  }
}
```

#### Toggle Change Handler

```javascript
async handlePublishToggleChange(event) {
  const isChecked = event.detail.checked;
  const wasPublished = this._paragraphData?.publishDate ? true : false;

  // If toggling from unpublished to published
  if (!wasPublished && isChecked) {
    // Check authentication
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) {
      this.requestUpdate();
      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: 'Not authenticated', variant: 'error' },
        bubbles: true,
        composed: true
      }));
      return;
    }

    // Fire publish event
    this.firePublishEvent_Paragraph(this.id);
  }
  // Unpublishing not yet supported
  else if (wasPublished && !isChecked) {
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('toast', {
      detail: { message: 'Unpublishing not yet supported', variant: 'info' },
      bubbles: true,
      composed: true
    }));
  }
}
```

#### Event Firing

```javascript
firePublishEvent_Paragraph(paragraphid) {
  if (!paragraphid) return;

  const payload = {
    id: paragraphid,
    object: 'paragraph'
  };
  
  let eventDetail = {
    object: 'paragraph',
    payload,
    callback: this.publishEventCallback_Paragraph.bind(this),
  };

  this.dispatchEvent(
    new CustomEvent('publish', {
      detail: eventDetail,
      bubbles: true,
      composed: true,
    })
  );
}
```

#### Event Callback

```javascript
publishEventCallback_Paragraph(error, data) {
  if (error) {
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: { message: error, variant: 'error' },
        bubbles: true,
        composed: true,
      })
    );
    return;
  }
  
  if (data) {
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: { message: 'Published', variant: 'success' },
        bubbles: true,
        composed: true,
      })
    );
    this.refreshParagraphData(); // Refresh to get updated publishDate
  }
  
  this.requestUpdate();
}
```

### Event Handler Implementation

**File**: `public/index.js`

#### Event Listener Attachment

```javascript
async function initializeApp() {
  const bodyElem = document.querySelector('body');
  await customElements.whenDefined('app-bookstore');

  const mainApp = document.createElement('app-bookstore');
  attachQueryEventListener(mainApp);
  attachStorageEventListener(mainApp);
  attachSaveEventListener(mainApp);
  attachToastEventListener(mainApp);
  attachCreateEventListener(mainApp);
  attachPublishEventListener(mainApp); // Publish event handler

  bodyElem.appendChild(mainApp);
}
```

#### Publish Event Handler

```javascript
function attachPublishEventListener(element) {
  element.addEventListener('publish', (publishEvent) => {
    let callback = publishEvent.detail.callback;
    
    // Extract authentication token from session storage
    let authData = accessSessionStorage('code_exchange_response', 'read');
    authData = JSON.parse(authData);
    let authBearer = authData.authenticationResult?.access?.access_token;

    // Make HTTP request to publish endpoint
    fetch('/api/1.0/actions/publish', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authBearer}`
      },
      body: JSON.stringify(publishEvent.detail.payload)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      callback(null, data);
    })
    .catch(error => {
      console.error('Error during publish callout:', error);
      callback(error, null);
    });
  });
}
```

---

## Event Flow

### Complete Publish Flow

1. **User Interaction**
   - User toggles publish switch in custom-paragraph component
   - Component checks user permissions and authentication

2. **Event Dispatch**
   - Component fires `firePublishEvent_Paragraph(id)`
   - Creates CustomEvent with payload: `{id, object: 'paragraph'}`
   - Event bubbles up to main app element

3. **Event Handling**
   - `attachPublishEventListener` catches the event
   - Extracts authentication token from session storage
   - Constructs HTTP request to `/api/1.0/actions/publish`

4. **Server Processing**
   - Server validates bearer token and required scopes
   - Routes to PublishEndpoint class
   - Endpoint validates input and processes request

5. **Database Operation**
   - DataFacade with cache skipping retrieves record
   - Validates record exists and is unpublished
   - Updates record with current publishDate

6. **Response Handling**
   - Success/error response sent back to frontend
   - Callback executed with result
   - Component shows toast notification
   - Component refreshes data to reflect changes

### Event Payload Structure

#### Component Event Detail
```javascript
{
  object: 'paragraph',
  payload: {
    id: 'paragraph-id',
    object: 'paragraph'
  },
  callback: function(error, data) { ... }
}
```

#### HTTP Request Body
```javascript
{
  id: 'paragraph-id',
  object: 'paragraph'
}
```

---

## Cache Strategy

### Why Cache Skipping is Critical

The publish endpoint uses `setSkipCache(true)` for all DataFacade operations to ensure:

1. **Real-time Data Access**: Get the most current record state
2. **Consistency**: Avoid stale cache data during publish operations
3. **Immediate Reflection**: Updates are immediately visible to authenticated users

### Cache Usage Pattern

```javascript
// Both read and write operations skip cache
const dataFacade = new DataFacade(this.environment).setSkipCache(true);

// Reading current state
const existingRecord = await dataFacade.getData({...});

// Writing new state
const result = await dataFacade.updateData({...});
```

### Cache Invalidation

After successful publishing:
- Cache is automatically invalidated for the specific record
- Frontend refreshes data via `refreshParagraphData()`
- Subsequent reads will get fresh data from database

---

## Error Handling

### Validation Errors (400)

**Triggers**:
- Missing request body
- Invalid or missing `object` parameter
- Invalid or missing `id` parameter
- Unsupported object type

**Response**:
```javascript
{
  "success": false,
  "error": "Invalid request data"
}
```

### Not Found Errors (404)

**Triggers**:
- Record with specified ID doesn't exist
- Record doesn't belong to current application instance

**Response**:
```javascript
{
  "success": false,
  "error": "Record not found"
}
```

### Business Logic Errors (400)

**Triggers**:
- Attempting to publish already published record

**Response**:
```javascript
{
  "success": false,
  "error": "Record is already published"
}
```

### Server Errors (500)

**Triggers**:
- Database connection failures
- DataFacade operation failures
- Unexpected system errors

**Response**:
```javascript
{
  "success": false,
  "error": "Specific error message"
}
```

### Frontend Error Handling

```javascript
publishEventCallback_Paragraph(error, data) {
  if (error) {
    // Show error toast
    this.dispatchEvent(new CustomEvent('toast', {
      detail: { message: error, variant: 'error' },
      bubbles: true,
      composed: true,
    }));
    return;
  }
  // Handle success...
}
```

---

## Security & Authorization

### Multi-Layer Security

1. **Server-Level Authentication**
   - Bearer token validation
   - Scope checking: `['publish', 'edit']`
   - Pre-authorization before endpoint execution

2. **Component-Level Permission Checking**
   - UI elements disabled if permissions missing
   - Client-side scope validation

3. **Record-Level Security**
   - Records filtered by application key
   - Only own records can be published

### Authorization Requirements

**Required Scopes**:
- `publish`: Permission to publish content
- `edit`: Permission to modify content (prerequisite for publishing)

**Token Format**:
```
Authorization: Bearer <jwt-token>
```

### Permission Flow

```
Frontend Check → HTTP Request → Server Token Validation → Endpoint Execution → Database Operation
```

---

## Testing

### Test Categories

The implementation includes comprehensive tests covering:

1. **Input Validation Tests**
   - Missing request body
   - Invalid object types
   - Missing required fields
   - Unsupported object types

2. **Record Existence Tests**
   - Non-existent records
   - DataFacade parameter validation
   - Error handling for database failures

3. **Business Logic Tests**
   - Already published records
   - Successful publishing operations
   - Timestamp validation

4. **Error Handling Tests**
   - Database connection failures
   - Update operation failures
   - Proper error logging

5. **Integration Tests**
   - End-to-end publish workflow
   - Event system testing
   - Authentication integration

### Test Structure Example

```javascript
describe('PublishEndpoint', () => {
  describe('Input Validation', () => {
    it('should return 400 for missing request body', async () => {
      req.body = undefined;
      await endpoint.execute();
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Invalid request data' 
      });
    });
  });

  describe('Publishing Operation', () => {
    it('should successfully publish unpublished paragraph', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
```

---

## Summary

The publish endpoint implementation provides a robust, secure, and well-tested solution for publishing content with the following key features:

- **Event-Driven Architecture**: Decoupled frontend and backend communication
- **Comprehensive Validation**: Multi-level input and business logic validation
- **Smart Caching**: Strategic cache skipping for real-time operations
- **Security**: Multi-layer authentication and authorization
- **Error Handling**: Comprehensive error scenarios with appropriate responses
- **Testing**: Extensive test coverage for all functionality

The implementation follows established patterns from the PageHost architecture guide and maintains consistency with other endpoints in the application.
