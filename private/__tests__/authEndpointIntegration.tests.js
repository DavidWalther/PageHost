/**
 * Integrationstests der Auth- und Konfigurations-Endpunkte.
 *
 * Diese Datei hielt einmal auch den Lese- und Schreibpfad fest — über den
 * `DataStorage`-Seam, den nur das alte Datenmodell benutzte. Mit dessen
 * Wegfall sind diese Teile verschwunden; ihre Nachfolger stehen in
 * `typeFreeEndpointsIntegration.tests.js` (lesen) und
 * `nodeWritePathIntegration.tests.js` (schreiben).
 *
 * Übrig bleibt, was nie am Inhaltsmodell hing: Anmeldung, Token-Austausch,
 * Abmeldung und die ausgelieferten Umgebungsvariablen. `identity` läuft
 * weiterhin direkt über `DataStorage` — deshalb bleibt dieser Mock.
 *
 * Mocking strategy:
 *   - DataStorage (Postgres) and DataCache2 (Redis) are mocked — these are external I/O
 *   - Logging is mocked to suppress console output during tests
 *   - All other modules (DataFacade, DataFacadeSync, EndpointLogic, DataCleaner, etc.) are real
 *   - OpenIdConnectClient is also mocked in auth tests to avoid real HTTP calls to Google
 */

const { DataStorage } = require('../database2/DataStorage/DataStorage');
const { DataCache2 } = require('../database2/DataCache/DataCache');

jest.mock('../database2/DataStorage/DataStorage');
jest.mock('../database2/DataCache/DataCache');
jest.mock('../modules/logging');

// ─── Shared helpers ─────────────────────────────────────────────────────────

const ENVIRONMENT = Object.freeze({
  APPLICATION_APPLICATION_KEY: 'test-key',
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify([
    'login',
    'create',
    'edit',
    'delete',
    'publish',
  ]),
  CACHE_KEY_PREFIX: 'TEST',
  CACHE_DATA_INCREMENT: '1',
  CACHE_CONTAINER_EXPIRATION_SECONDS: 60,
  AUTH_SERVER_SECRET: 'test-secret',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
});

function createResMock() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

let mockCacheGet;
let mockCacheSet;
let mockCacheDel;
let mockQueryIdentityByKey;
let mockUpdateData;

function setupDataCacheMock() {
  DataCache2.mockImplementation(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
    del: mockCacheDel,
  }));
}

function setupDataStorageMock() {
  DataStorage.mockImplementation(() => ({
    setConditionApplicationKey: jest.fn().mockReturnThis(),
    setConditionPublishDate: jest.fn().mockReturnThis(),
    queryIdentityByKey: mockQueryIdentityByKey,
    updateData: mockUpdateData,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();

  mockCacheGet = jest.fn().mockResolvedValue(null); // always cache miss by default
  mockCacheSet = jest.fn().mockResolvedValue(undefined);
  mockCacheDel = jest.fn().mockResolvedValue(undefined);

  mockQueryIdentityByKey = jest.fn().mockResolvedValue({});
  mockUpdateData = jest.fn().mockResolvedValue({});

  setupDataCacheMock();
  setupDataStorageMock();
});
// ─── Auth + Config Endpoints ────────────────────────────────────────────────

const RequestAuthStateEndpoint = require('../endpoints/api/1.0/auth/oAuth2/requestAuthStateEndpoint');
const CodeExchangeEndpoint = require('../endpoints/api/1.0/auth/oAuth2/CodeExchangeEndpoint');
const LogoutEndpoint = require('../endpoints/api/1.0/auth/LogoutEndpoint');
const {
  EnvironmentVariablesEndpoint,
} = require('../endpoints/api/1.0/environmetVariables');

// OpenIdConnectClient is mocked to prevent real HTTP calls to Google
jest.mock('../modules/oAuth2/OpenIdConnectClient');
const OpenIdConnectClient = require('../modules/oAuth2/OpenIdConnectClient');

const ENV_WITH_LOGIN = {
  ...ENVIRONMENT,
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['login']),
  AUTH_REFRESH_TOKEN_LIFETIME_DAYS: '7',
  AUTH_CLOCK_SKEW_SECONDS: '5',
};

// Minimal fake id_token: header.payload.signature (base64url encoded)
const FAKE_TOKEN_PAYLOAD = {
  email: 'test@example.com',
  given_name: 'Test',
  family_name: 'User',
  picture: 'https://example.com/pic.jpg',
  name: 'Test User',
};
const fakeIdToken = [
  Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64'),
  Buffer.from(JSON.stringify(FAKE_TOKEN_PAYLOAD)).toString('base64'),
  'fakesignature',
].join('.');

describe('RequestAuthStateEndpoint Integration', () => {
  it('should generate a state, store it in cache, and return it', async () => {
    const res = createResMock();

    await new RequestAuthStateEndpoint()
      .setEnvironment(ENV_WITH_LOGIN)
      .setRequestObject({})
      .setResponseObject(res)
      .execute();

    expect(mockCacheSet).toHaveBeenCalledTimes(1);
    const [cacheKey, cacheValue] = mockCacheSet.mock.calls[0];
    expect(cacheKey).toMatch(/^short-term-auth-state-/);
    expect(cacheValue).toBe(true);
    // The state string itself is returned as the response
    const state = res.json.mock.calls[0][0];
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);
  });

  it('should return 403 when login is not in allowed actions', async () => {
    const envWithoutLogin = {
      ...ENVIRONMENT,
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']),
    };

    const res = createResMock();
    await new RequestAuthStateEndpoint()
      .setEnvironment(envWithoutLogin)
      .setRequestObject({})
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Login not allowed' });
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});

describe('CodeExchangeEndpoint Integration', () => {
  let mockExchangeAuthorizationCode;

  beforeEach(() => {
    mockExchangeAuthorizationCode = jest
      .fn()
      .mockResolvedValue({ id_token: fakeIdToken });
    OpenIdConnectClient.mockImplementation(() => ({
      setRedirectUri: jest.fn().mockReturnThis(),
      setClientId: jest.fn().mockReturnThis(),
      setClientSecret: jest.fn().mockReturnThis(),
      setWellKnownEndpoint: jest.fn().mockReturnThis(),
      setCodeVerifier: jest.fn().mockReturnThis(),
      setClockSkew: jest.fn().mockReturnThis(),
      exchangeAuthorizationCode: mockExchangeAuthorizationCode,
    }));
  });

  function makeCodeExchangeReq(overrides = {}) {
    return {
      protocol: 'https',
      hostname: 'example.com',
      get: jest.fn().mockReturnValue('example.com'),
      path: '/api/1.0/oAuth2/codeexchange',
      port: null,
      query: {},
      body: {
        auth_code: 'valid-auth-code',
        state: 'valid-state-123',
        code_verifier: 'valid-code-verifier',
        ...overrides,
      },
    };
  }

  it('should complete code exchange and return auth response with JWT', async () => {
    const existingUser = {
      id: 'user-001',
      key: 'test@example.com',
      scopes: 'edit,create',
    };
    mockQueryIdentityByKey.mockResolvedValue(existingUser);

    // Cache: state is valid (first call), auth code not used (second call)
    mockCacheGet.mockResolvedValueOnce(true).mockResolvedValueOnce(null);

    const req = makeCodeExchangeReq();
    const res = createResMock();

    await new CodeExchangeEndpoint()
      .setEnvironment(ENV_WITH_LOGIN)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(mockExchangeAuthorizationCode).toHaveBeenCalledWith(
      'valid-auth-code'
    );
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty('authenticationResult');
    expect(responseData.authenticationResult).toHaveProperty('access');
    expect(responseData.authenticationResult.access).toHaveProperty(
      'access_token'
    );
    expect(responseData.authenticationResult.user.email).toBe(
      'test@example.com'
    );
  });

  it('should return 403 when login is not in allowed actions', async () => {
    const envWithoutLogin = {
      ...ENVIRONMENT,
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']),
    };

    const req = makeCodeExchangeReq();
    const res = createResMock();

    await new CodeExchangeEndpoint()
      .setEnvironment(envWithoutLogin)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Login not allowed' });
  });

  it('should return 400 when auth_code is missing', async () => {
    const req = makeCodeExchangeReq({ auth_code: undefined });
    const res = createResMock();

    await new CodeExchangeEndpoint()
      .setEnvironment(ENV_WITH_LOGIN)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing auth_code' });
  });

  it('should return 400 when state is missing', async () => {
    const req = makeCodeExchangeReq({ state: undefined });
    const res = createResMock();

    await new CodeExchangeEndpoint()
      .setEnvironment(ENV_WITH_LOGIN)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing auth_state' });
  });

  it('should return 400 when state is invalid or expired (not found in cache)', async () => {
    mockCacheGet.mockResolvedValueOnce(null); // state not in cache

    const req = makeCodeExchangeReq();
    const res = createResMock();

    await new CodeExchangeEndpoint()
      .setEnvironment(ENV_WITH_LOGIN)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired state',
    });
  });

  it('should return 401 when user is not found in the identity table', async () => {
    mockQueryIdentityByKey.mockResolvedValue({}); // no id → user not found
    mockCacheGet.mockResolvedValueOnce(true).mockResolvedValueOnce(null);

    const req = makeCodeExchangeReq();
    const res = createResMock();

    await new CodeExchangeEndpoint()
      .setEnvironment(ENV_WITH_LOGIN)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No new users allowed' });
  });
});

describe('LogoutEndpoint Integration', () => {
  it('should return 200 when a valid Bearer token is present', async () => {
    const JwtService = require('../modules/oAuth2/JwtService.js');
    const validJwt = JwtService.createJwt(
      'user@test.com',
      'google',
      ['edit'],
      ENVIRONMENT.AUTH_SERVER_SECRET,
      900
    );

    mockQueryIdentityByKey.mockResolvedValue({
      id: 'identity-001',
      key: 'user@test.com',
    });

    const req = { headers: { authorization: `Bearer ${validJwt}` } };
    const res = createResMock();

    await new LogoutEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Logout successful' });
  });

  it('should return 401 when Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = createResMock();

    await new LogoutEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic some-credentials' } };
    const res = createResMock();

    await new LogoutEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });
});

describe('EnvironmentVariablesEndpoint Integration', () => {
  it('should return public environment variables', async () => {
    const env = {
      ...ENVIRONMENT,
      GOOGLE_CLIENT_ID: 'my-client-id',
    };
    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue('example.com'),
    };
    const res = createResMock();

    await new EnvironmentVariablesEndpoint()
      .setEnvironment(env)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.auth.google.clientId).toBe('my-client-id');
    expect(responseData.auth.version).toBe('1.0');
  });

  it('should use AUTH_OIDC_REDIRECT_URI when set', async () => {
    const env = {
      ...ENVIRONMENT,
      AUTH_OIDC_REDIRECT_URI: 'https://custom-redirect.example.com',
    };
    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue('example.com'),
    };
    const res = createResMock();

    await new EnvironmentVariablesEndpoint()
      .setEnvironment(env)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.auth.google.redirect_uri).toBe(
      'https://custom-redirect.example.com'
    );
  });

  it('should construct redirect_uri from request when AUTH_OIDC_REDIRECT_URI is not set', async () => {
    const env = { ...ENVIRONMENT };
    delete env.AUTH_OIDC_REDIRECT_URI;
    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue('example.com'),
    };
    const res = createResMock();

    await new EnvironmentVariablesEndpoint()
      .setEnvironment(env)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.auth.google.redirect_uri).toBe('https://example.com');
  });
});
