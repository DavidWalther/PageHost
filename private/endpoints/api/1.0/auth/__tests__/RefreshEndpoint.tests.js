const RefreshEndpoint = require('../RefreshEndpoint.js');
const { Logging } = require('../../../../../modules/logging.js');
const { DataFacade } = require('../../../../../database2/DataFacade.js');
const RefreshTokenService = require('../../../../../modules/oAuth2/RefreshTokenService.js');
const AccessTokenService = require('../../../../../modules/oAuth2/AccessTokenService.js');

jest.mock('../../../../../modules/logging.js');
jest.mock('../../../../../database2/DataFacade.js');
jest.mock('../../../../../modules/oAuth2/RefreshTokenService.js');
jest.mock('../../../../../modules/oAuth2/AccessTokenService.js');

describe('RefreshEndpoint', () => {
  let endpoint;
  let mockRequestObject;
  let mockResponseObject;
  let mockEnvironment;
  let mockGetData;
  let mockUpdateData;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEnvironment = {
      AUTH_SERVER_SECRET: 'test-secret',
      AUTH_REFRESH_TOKEN_LIFETIME_DAYS: '7',
      APPLICATION_APPLICATION_KEY: 'test-app-key',
    };

    mockRequestObject = {
      body: {
        refresh_token: 'valid-refresh-token-jwt',
      },
    };

    mockResponseObject = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Default mocks
    RefreshTokenService.verifyRefreshToken = jest.fn().mockReturnValue({
      token: 'existing-uuid',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-08T00:00:00.000Z',
    });
    RefreshTokenService.createRefreshToken = jest
      .fn()
      .mockReturnValue('new-refresh-token-jwt');
    RefreshTokenService.extractTokenId = jest.fn().mockReturnValue('new-uuid');

    AccessTokenService.mockImplementation(() => ({
      setEnvironment: jest.fn().mockReturnThis(),
      getUserScopes: jest.fn().mockReturnValue(['edit', 'create']),
      createJwt: jest.fn().mockReturnValue('new-access-token-jwt'),
    }));

    mockGetData = jest
      .fn()
      .mockResolvedValue({ id: 'identity-001', key: 'user@test.com' });
    mockUpdateData = jest.fn().mockResolvedValue({});

    DataFacade.mockImplementation(() => ({
      getData: mockGetData,
      updateData: mockUpdateData,
      setSkipCache: jest.fn(),
    }));

    endpoint = new RefreshEndpoint();
    endpoint
      .setEnvironment(mockEnvironment)
      .setRequestObject(mockRequestObject)
      .setResponseObject(mockResponseObject);
  });

  it('should return new access and refresh tokens on successful refresh', async () => {
    await endpoint.execute();

    expect(mockResponseObject.json).toHaveBeenCalledWith({
      authenticationResult: {
        access: {
          access_token: 'new-access-token-jwt',
          scopes: ['edit', 'create'],
        },
        refresh: {
          refresh_token: 'new-refresh-token-jwt',
        },
      },
    });
  });

  it('should return 400 when refresh_token is missing', async () => {
    mockRequestObject.body = {};
    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(400);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      error: 'Missing refresh_token',
    });
  });

  it('should return 401 when refresh token JWT is invalid', async () => {
    RefreshTokenService.verifyRefreshToken = jest.fn().mockReturnValue(null);

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(401);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      error: 'Invalid or expired refresh token',
    });
  });

  it('sucht die Identität über die Token-Id, nicht über den Anmeldeschlüssel', async () => {
    await endpoint.execute();

    expect(mockGetData).toHaveBeenCalledWith({
      request: { table: 'identity', refreshTokenId: 'existing-uuid' },
    });
  });

  it('should return 401 when refresh token UUID does not match any identity', async () => {
    mockGetData.mockResolvedValue(null);

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(401);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      error: 'Invalid refresh token',
    });
  });

  it('should return 401 when refresh token is expired', async () => {
    RefreshTokenService.verifyRefreshToken = jest.fn().mockReturnValue(null);

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(401);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      error: 'Invalid or expired refresh token',
    });
  });

  it('should call RefreshTokenService.createRefreshToken for rotation', async () => {
    await endpoint.execute();

    expect(RefreshTokenService.createRefreshToken).toHaveBeenCalledWith(
      'test-secret',
      7
    );
  });

  it('should store the new refresh token UUID in the database', async () => {
    await endpoint.execute();

    // Das **Objekt** geht in die jsonb-Spalte, nicht sein JSON-Text —
    // serialisiert wird vom Treiber.
    expect(mockUpdateData).toHaveBeenCalledWith({
      object: 'identity',
      payload: {
        id: 'identity-001',
        refreshtoken: {
          token: expect.any(String),
          issuedAt: expect.any(String),
          expiresAt: expect.any(String),
        },
      },
    });
  });
});
