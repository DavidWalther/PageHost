# Google Authentication Implementation Documentation

## Overview

The PageHost application implements Google OAuth 2.0 authentication using OpenID Connect (OIDC) with PKCE (Proof Key for Code Exchange) flow. The system supports only one registered user, identified by their email address stored in environment variables.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Frontend Implementation](#frontend-implementation)
- [Server Implementation](#server-implementation)
- [Cache Implementation](#cache-implementation)
- [Authentication Flow](#authentication-flow)
- [Token Management](#token-management)
- [User Validation](#user-validation)
- [Scopes and Permissions](#scopes-and-permissions)
- [Environment Variables](#environment-variables)
- [Security Considerations](#security-considerations)
- [Testing](#testing)

---

## Architecture Overview

### Components Involved

1. **Frontend Components**
   - [`oidc-component`](../../public/modules/oIdcComponent.js) - OIDC authentication widget
   - [`bookstore.js`](../../public/applications/bookstore/bookstore.js) - Main application logic
   - Session storage for token persistence

2. **Server Components**
   - [`RequestAuthStateEndpoint`](../../private/endpoints/api/1.0/auth/oAuth2/requestAuthStateEndpoint.js) - State generation
   - [`CodeExchangeEndpoint`](../../private/endpoints/api/1.0/auth/oAuth2/CodeExchangeEndpoint.js) - Authorization code exchange
   - [`AccessTokenService`](../../private/modules/oAuth2/AccessTokenService.js) - Token management
   - [`OpenIdConnectClient`](../../private/modules/oAuth2/OpenIdConnectClient.js) - OIDC protocol handling
   - [`LogoutEndpoint`](../../private/endpoints/api/1.0/auth/LogoutEndpoint.js) - Token invalidation

3. **Cache Layer**
   - [`DataCache2`](../../private/database2/DataCache/DataCache.js) - Redis-based caching
   - Short-term state storage
   - Mid-term bearer token storage

### Data Flow

```
OIDC Component → Auth State Request → Google OAuth → Code Exchange → Bearer Token → Protected Resources
```

---

## Frontend Implementation

### OIDC Component Configuration

The frontend uses an `oidc-component` with Google-specific configuration:

```html
<oidc-component
  provider-endpoint-openid-configuration="https://accounts.google.com/.well-known/openid-configuration"
  server-endpoint-auth-code-exchange="/api/1.0/oAuth2/codeexchange"
  server-endpoint-auth-state-request="/api/1.0/oAuth2/requestAuthState"
  button-label="Login with Google"
>
```

### Event Handling

The main application handles authentication events:

```javascript
// From bookstore.js
oidcComponent.addEventListener('authenticated', (event) => this.handleOIDCAuthenticated(event));
oidcComponent.addEventListener('logout', (event) => this.handleLogout(event));
oidcComponent.addEventListener('rejected', (event) => this.handleAuthenticationRejection(event));
```

### Configuration Retrieval

Google auth configuration is fetched dynamically:

```javascript
async getGoogleAuthConfig() {
  return new Promise((resolve) => {
    fetch('/api/1.0/env/variables')
    .then(response => response.json())
    .then(variables => {
      resolve(variables.auth.google);
    });
  });
}
```

### Token Usage in Protected Operations

Bearer tokens are extracted from session storage for API calls:

```javascript
// Example from publish event handler in index.js
let authData = accessSessionStorage('code_exchange_response', 'read');
authData = JSON.parse(authData);
let authBearer = authData.authenticationResult?.access?.access_token;

fetch('/api/1.0/actions/publish', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authBearer}`
  },
  body: JSON.stringify(payload)
})
```

### PKCE Implementation

The OIDC component implements PKCE for enhanced security:

```javascript
// Code verifier generation
const codeVerifier = this.generateRandomString();
const codeChallenge = await this.generateCodeChallenge(codeVerifier);

// Save verifier for later use
sessionStorage.setItem('pkce_code_verifier', codeVerifier);

// Include challenge in authorization request
const parameters = {
  client_id,
  redirect_uri,
  scope: scope.join(' '),
  response_type,
  state,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256'
};
```

---

## Server Implementation

### Authentication Endpoints

#### 1. Auth State Request (`/api/1.0/oAuth2/requestAuthState`)

Generates and caches a random state value for CSRF protection:

```javascript
app.get('/api/1.0/oAuth2/requestAuthState', async (req, res) => {
  const endpoint = new RequestAuthStateEndpoint();
  endpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute();
});
```

**Implementation Details:**
- Generates 32-byte random state using `crypto.randomBytes()`
- Stores state in cache with `short-term-auth-state-{state}` key
- Returns state to client for inclusion in OAuth request

#### 2. Code Exchange (`/api/1.0/oAuth2/codeexchange`)

Exchanges authorization code for tokens and creates bearer token:

```javascript
app.post('/api/1.0/oAuth2/codeexchange', async (req, res) => {
  const endpoint = new CodeExchangeEndpoint();
  endpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute();
});
```

#### 3. Logout (`/api/1.0/auth/logout`)

Invalidates bearer tokens:

```javascript
app.get('/api/1.0/auth/logout', async (req, res) => {
  const endpoint = new LogoutEndpoint();
  endpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute();
});
```

### Code Exchange Process

The [`CodeExchangeEndpoint`](../../private/endpoints/api/1.0/auth/oAuth2/CodeExchangeEndpoint.js) handles the complete OAuth flow:

1. **State Validation**
```javascript
const auth_state_cache_key = `${PREFIX_FOR_SHORT_TERM_CACHE}-auth-state-${state}`;
const cache = new DataCache2(this.environment);
const isStateValid = await cache.get(auth_state_cache_key);
if (!isStateValid) {
  this.responseObject.status(400).json({ error: 'Invalid or expired state' });
  return;
}
```

2. **Replay Attack Prevention**
```javascript
let auth_code_cache_key = PREFIX_FOR_SHORT_TERM_CACHE + '-used-auth-code-' + auth_code;
let ShortTermCacheKeyGenerator = await cache.get(auth_code_cache_key);
if (ShortTermCacheKeyGenerator) {
  this.responseObject.status(401).json({ error: 'Authentication code already used' });
  return;
}
await cache.set(auth_code_cache_key, true);
```

3. **Token Exchange with Google**
```javascript
const oidcClient = new OpenIdConnectClient()
  .setRedirectUri(this.redirectUri)
  .setClientId(this.environment.GOOGLE_CLIENT_ID)
  .setClientSecret(this.environment.GOOGLE_CLIENT_SECRET)
  .setWellKnownEndpoint(GOOGLE_ENDPOINT_WELLKNOWN)
  .setCodeVerifier(code_verifier);

await oidcClient.exchangeAuthorizationCode(auth_code)
```

4. **User Validation and Bearer Creation**
```javascript
let accessTokenService = new AccessTokenService();
accessTokenService.setEnvironment(this.environment);

if(!accessTokenService.isUserValid(tokenPayload)) {
  this.responseObject.status(401).json({ error: 'No new users allowed' });
  return;
}

let scopes = accessTokenService.getUserScopes(tokenPayload);
accessTokenService.createBearer(tokenPayload)
.then(bearerToken => {
  // Return auth response to client
});
```

### Authorization Middleware

Protected endpoints use bearer token validation with scope checking:

```javascript
// Example from server.js for publish endpoint
app.patch('/api/1.0/actions/publish', async (req, res) => {
  let bearerToken = req.headers['authorization']?.split(' ')[1];
  let accessTokenService = new AccessTokenService().setEnvironment(environment);
  
  if(!accessTokenService.isBearerValidFromScope(bearerToken, ['publish', 'edit'])) {
    res.status(401).send('Unauthorized');
    return;
  }
  
  // Execute endpoint
});
```

### Scope-Based Authorization

Different endpoints require different scopes:

- **Edit operations** (`/api/1.0/data/change/*`): `['edit']`
- **Delete operations** (`/api/1.0/data/delete`): `['delete']` 
- **Publish operations** (`/api/1.0/actions/publish`): `['publish', 'edit']`
- **Unpublish operations** (`/api/1.0/actions/unpublish`): `['publish', 'edit']`

---

## Cache Implementation

### Cache Keys and Storage

The system uses Redis via [`DataCache2`](../../private/database2/DataCache/DataCache.js) with specific key patterns:

#### Short-term Cache (State Values)
- **Pattern**: `short-term-auth-state-{state}`
- **Purpose**: CSRF protection during OAuth flow
- **Lifetime**: Short-lived, deleted after single use
- **Example**: `short-term-auth-state-a1b2c3d4e5f6...`

#### Used Authorization Codes
- **Pattern**: `short-term-used-auth-code-{code}`
- **Purpose**: Prevent replay attacks
- **Lifetime**: 20 minutes
- **Example**: `short-term-used-auth-code-4/0AX4XfWh...`

#### Mid-term Cache (Bearer Tokens)
- **Pattern**: `mid-term-bearer-token-{bearerToken}`
- **Purpose**: Store bearer token with associated user info and scopes
- **Lifetime**: Session-based
- **Example**: `mid-term-bearer-token-a1b2c3d4e5f6...`

### Cache Operations

```javascript
// State storage
const auth_state_cache_key = `short-term-auth-state-${state}`;
await cache.set(auth_state_cache_key, true);

// Bearer token storage
const bearerTokenCacheKey = this.getBearerCacheKey(bearerToken);
const bearerTokenCacheValue = {userInfo, scopes};
await cache.set(bearerTokenCacheKey, bearerTokenCacheValue);

// Bearer token validation
const cacheValue = await cache.get(cacheKey);
if (!cacheValue) {
  return false;
}
const { userInfo, scopes } = cacheValue;
```

---

## Authentication Flow

### Complete Authentication Sequence

1. **Initiation**
   - User clicks login button in OIDC component
   - Component requests auth configuration from `/api/1.0/env/variables`

2. **State Generation**
   - Frontend calls `/api/1.0/oAuth2/requestAuthState`
   - Server generates random state, stores in cache
   - Returns state to frontend

3. **PKCE Preparation**
   - Frontend generates code verifier and challenge
   - Stores verifier in session storage for later use

4. **Google Authorization**
   - Frontend redirects to Google OAuth with state and PKCE parameters
   - User authenticates with Google
   - Google redirects back with authorization code

5. **Code Exchange**
   - Frontend posts code, state, and code_verifier to `/api/1.0/oAuth2/codeexchange`
   - Server validates state against cache
   - Server checks for code replay attacks
   - Server exchanges code for ID token with Google
   - Server validates ID token signature using Google's public keys
   - Server validates user email against registered user
   - Server creates bearer token and stores in cache

6. **Token Response**
   - Server returns bearer token and user info to frontend
   - Frontend stores response in session storage

7. **Protected Resource Access**
   - Frontend includes bearer token in Authorization header
   - Server validates token and scopes for each request

### URL Parameter Handling

The system handles OAuth callback parameters:

```javascript
// From bookstore.js
saveAuthParameterToStorage() {
  let queryParameters = new URLSearchParams(window.location.search);
  if(!queryParameters.code && !queryParameters.state) { return; }
  let authParameters = {
    code: queryParameters.code,
    state: queryParameters.state
  };
  sessionStorage.setItem('authParameters', JSON.stringify(authParameters));
}
```

---

## Token Management

### Bearer Token Creation

The [`AccessTokenService`](../../private/modules/oAuth2/AccessTokenService.js) handles token lifecycle:

```javascript
async createBearer(userInfo) {
  return new Promise(async (resolve, reject) => {
    if(!userInfo) { return null; }
    if(!this.isUserValid(userInfo)) {
      reject('User is not valid');
      return;
    }
    
    let scopes = this.getUserScopes(userInfo);
    const bearerToken = this.createBearerForUser();
    const bearerTokenCacheKey = this.getBearerCacheKey(bearerToken);
    const bearerTokenCacheValue = {userInfo, scopes};
    
    let cache = new DataCache2(this.environment);
    await cache.set(bearerTokenCacheKey, bearerTokenCacheValue);
    resolve(bearerToken);
  });
}
```

### Token Validation

```javascript
async isBearerValidFromScope(bearer, requestedScopes) {
  if (!bearer || !requestedScopes) {
    return false;
  }
  
  const cache = new DataCache2(this.environment);
  const cacheKey = this.getBearerCacheKey(bearer);
  const cacheValue = await cache.get(cacheKey);
  
  if (!cacheValue) {
    return false;
  }
  
  const { userInfo, scopes } = cacheValue;
  if (!this.isUserValid(userInfo)) {
    return false;
  }
  
  // Check if bearer was created for requested scopes
  const isBearerCreatedForRequestedScopes = requestedScopes.every(scope => scopes.includes(scope));
  return isBearerCreatedForRequestedScopes;
}
```

### Bearer Token Generation

```javascript
createBearerForUser() {
  return crypto.randomBytes(64).toString('hex'); // 128 character hex string
}

getBearerCacheKey(bearerToken) {
  if(!bearerToken) { return null; }
  if(!this.environment.AUTH_SERVER_SECRET) {
    throw new Error('No server secret provided');
  }
  return `mid-term-bearer-token-${bearerToken}`;
}
```

### Token Deletion (Logout)

```javascript
async deleteBearer(bearer) {
  if (!bearer) {
    return false;
  }
  
  const cache = new DataCache2(this.environment);
  const cacheKey = this.getBearerCacheKey(bearer);
  await cache.del(cacheKey);
}
```

---

## User Validation

### Single User System

The application currently supports only one registered user:

```javascript
isUserValid(userInfo) {
  if(!userInfo) { return false; }
  if(userInfo.email !== this.environment.AUTH_REGISTERED_USER_EMAIL) {
    return false;
  }
  return true;
}
```

### User Registration Check

During authentication, new users are rejected:

```javascript
if(!accessTokenService.isUserValid(tokenPayload)) {
  this.responseObject.status(401).json({ error: 'No new users allowed' });
  return;
}
```

### User Information Structure

User information from Google ID token includes:

```javascript
let user = {
  provider: 'google',
  first_name: tokenPayload.given_name,
  last_name: tokenPayload.family_name,
  picture: tokenPayload.picture,
  display_name: tokenPayload.name,
  email: tokenPayload.email
};
```

---

## Scopes and Permissions

### Available Scopes

Currently hardcoded for the single registered user:

```javascript
getUserScopes(userInfo) {
  if(!userInfo) { return []; }
  if(userInfo.email !== this.environment.AUTH_REGISTERED_USER_EMAIL) {
    return [];
  }
  // Hardcoded scopes for single user system
  return ['edit','create', 'delete', 'publish'];
}
```

### Scope Usage in Endpoints

Different endpoints require different scopes:

| Endpoint | Required Scopes | Purpose |
|----------|----------------|---------|
| `/api/1.0/data/change/*` | `['edit']` | Content modification |
| `/api/1.0/data/delete` | `['delete']` | Content deletion |
| `/api/1.0/actions/publish` | `['publish', 'edit']` | Content publishing |
| `/api/1.0/actions/unpublish` | `['publish', 'edit']` | Content unpublishing |

Example validation:
```javascript
if(!accessTokenService.isBearerValidFromScope(bearerToken, ['publish', 'edit'])) {
  res.status(401).send('Unauthorized');
  return;
}
```

---

## Environment Variables

### Required Authentication Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `AUTH_REGISTERED_USER_EMAIL` | Email of the single allowed user | `"user@example.com"` |
| `AUTH_SERVER_SECRET` | Secret for token generation | `"secret-key-123"` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `"client-id.googleusercontent.com"` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `"client-secret"` |
| `APPLICATION_ACTIVE_ACTIONS` | Allowed operations | `["edit","create","delete","publish"]` |

### Optional Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AUTH_OIDC_AUTH_URL` | Custom redirect URI | Auto-detected from request |

### Cache Configuration

| Variable | Purpose |
|----------|---------|
| `REDIS_HOST` | Redis server host |
| `REDIS_PORT` | Redis server port |
| `REDIS_PASSWORD` | Redis authentication |
| `CACHE_KEY_PREFIX` | Cache namespace prefix |

---

## Security Considerations

### CSRF Protection
- State parameter validation prevents CSRF attacks
- State values are randomly generated and single-use
- State values are validated against cache before processing

### PKCE Implementation
- Code verifier/challenge prevents authorization code interception
- Enhances security for public clients
- SHA256 hashing of code verifier creates challenge

### Token Security
- Bearer tokens are cryptographically random (128 hex characters)
- Tokens are stored in cache with associated user context
- Server secret protects cache key generation
- ID token signature verification using Google's public keys

### Replay Attack Prevention
- Authorization codes are cached after use
- Subsequent use of same code is rejected
- Prevents code interception and replay

### Single User Limitation
- Only one email address is allowed to authenticate
- New user registration is explicitly blocked
- User validation occurs at both token creation and validation

### Session Management
- Tokens stored in session storage (not persistent)
- Cache-based token validation enables server-side revocation
- No persistent login cookies
- Logout endpoint removes tokens from cache

### ID Token Validation

The system performs comprehensive ID token validation:

```javascript
// Time-based validation
if (decodedIdToken.payload.exp + clockSkew < currentTime) {
  throw new Error('ID token is expired');
}
if (decodedIdToken.payload.iat - clockSkew > currentTime) {
  throw new Error('ID token is not yet valid');
}

// Issuer and audience validation
if (decodedIdToken.payload.iss !== openIdConfig.issuer) {
  throw new Error('Invalid issuer');
}
if (decodedIdToken.payload.aud !== this._clientId) {
  throw new Error('Invalid audience');
}

// Signature verification
jwt.verify(exchangeResponse.id_token, publicKey, { algorithms: ['RS256'] });
```

---

## Testing

### Test Coverage

Authentication is thoroughly tested in:
- [`AccessTokenService.tests.js`](../../private/modules/oAuth2/__tests__/AccessTokenService.tests.js)
- [`CodeExchangeEndpoint.tests.js`](../../private/endpoints/api/1.0/auth/oAuth2/__tests__/CodeExchangeEndpoint.tests.js)
- [`OpenIdConnectClient.test.js`](../../private/modules/oAuth2/__tests__/OpenIdConnectClient.test.js)
- [`requestAuthStateEndpoint.tests.js`](../../private/endpoints/api/1.0/auth/oAuth2/__tests__/requestAuthStateEndpoint.tests.js)

### Key Test Scenarios

1. **User Validation**
   - Valid user email acceptance
   - Invalid user email rejection
   - Missing user info handling

2. **Bearer Token Management**
   - Token creation with valid user
   - Token validation with scopes
   - Cache integration testing

3. **OAuth Flow**
   - State validation
   - Code exchange process
   - Error handling for invalid codes/states

4. **Security Testing**
   - CSRF protection via state validation
   - Replay attack prevention
   - Token expiration handling

### Mock Patterns

```javascript
// Standard test environment
const mockEnvironment = {
  AUTH_REGISTERED_USER_EMAIL: 'test@mail.com',
  AUTH_SERVER_SECRET: 'secret',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'create', 'delete', 'publish'])
};

// User info mocks
const validUserInfo = {
  email: 'test@mail.com',
  iss: 'https://accounts.google.com',
  aud: 'test-client-id',
  given_name: 'Test',
  family_name: 'User',
  name: 'Test User',
  picture: 'https://example.com/picture.jpg'
};
```

---

## Frontend Integration Examples

### Publish Operation

```javascript
// From index.js
function attachPublishEventListener(element) {
  element.addEventListener('publish', (publishEvent) => {
    let callback = publishEvent.detail.callback;
    let authData = accessSessionStorage('code_exchange_response', 'read');
    authData = JSON.parse(authData);
    let authBearer = authData.authenticationResult?.access?.access_token;

    fetch('/api/1.0/actions/publish', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authBearer}`
      },
      body: JSON.stringify(publishEvent.detail.payload)
    })
    .then(response => response.json())
    .then(data => callback(null, data))
    .catch(error => callback(error, null));
  });
}
```

### Logout Handling

```javascript
// From bookstore.js
async handleLogout(event) {
  let logoutCallback = event.detail.callback;
  let accessToken = sessionStorage.getItem('code_exchange_response');
  if(!accessToken) { return; }

  accessToken = JSON.parse(accessToken);
  const authHeader = 'Bearer ' + accessToken.authenticationResult.access.access_token;
  
  await fetch('/api/1.0/auth/logout', {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  }).then(() => {
    this.fireToast('Logout successful', 'success');
    logoutCallback();
  });
}
```

---

## Summary

The Google authentication implementation provides a secure, single-user OAuth 2.0 flow with:

- **Frontend**: OIDC component with event-driven authentication and PKCE support
- **Server**: State-based CSRF protection, secure token exchange, and comprehensive validation
- **Cache**: Redis-based session management with proper key patterns and security
- **Security**: PKCE implementation, user validation, scope-based authorization, and replay attack prevention

The system is well-architected for its current single-user requirement but would need significant enhancement for multi-user scenarios, including:
- User database/registry
- Dynamic scope assignment
- Role-based permissions
- User management interface
- Token refresh mechanisms
- Audit logging

The implementation follows OAuth 2.0 and OIDC best practices with additional security measures like PKCE, comprehensive token validation, and proper cache management.
