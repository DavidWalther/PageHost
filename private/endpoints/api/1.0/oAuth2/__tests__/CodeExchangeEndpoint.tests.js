const CodeExchangeEndpoint = require('../CodeExchangeEndpoint');
const { Logging } = require('../../../../../modules/logging.js');
const OpenIdConnectClient = require('../../../../../modules/oAuth2/OpenIdConnectClient.js');
const crypto = require('crypto');
const { json } = require('stream/consumers');
const { DataCache2 } = require('../../../../../database2/DataCache/DataCache.js');

jest.mock('../../../../../modules/logging');
jest.mock('../../../../../modules/oAuth2/OpenIdConnectClient');
jest.mock('crypto');
jest.mock('../../../../../database2/DataCache/DataCache.js');

const mockJwtHeader = { "test": "abc"};
const mockJwtPayload = { "email": "test@email.com"};
const mockJwtSignature = '';

function createMockJwt(header, payload, signature) {
  const encodeBase64 = (str) => {
    const buffer = Buffer.from(str, 'utf-8');
    return buffer.toString('base64');
  };

  let jwtParts = [];
  //console.log('Test: json headser: ', mockJwtHeader);
  let stringifiedHeader = JSON.stringify(mockJwtHeader);
  //console.log('Test: stringifiedHeader: ', stringifiedHeader);
  let encodedHeader = encodeBase64(stringifiedHeader);
  //console.log('Test: encodedHeader: ', encodedHeader);
  jwtParts.push(encodedHeader);

  let stringifiedPayload = JSON.stringify(mockJwtPayload);
  let encodedPayload = encodeBase64(stringifiedPayload);
  jwtParts.push(encodedPayload);

  let encodedSignature = encodeBase64(mockJwtSignature);
  jwtParts.push(encodedSignature);

  return jwtParts.join('.');
}

const encode64 = (str) => Buffer.from(str).toString('base64');
const mockIdToken = [
  encode64('test-header'),
  encode64(JSON.stringify({ sub: 'test-subject', exp: 1234567890, iat: 1234567890 })),
  encode64('test-signature')
].join('.');

DataCache2.mockImplementation(() => {
  return {
    get: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(true)
  }
});

describe('CodeExchangeEndpoint', () => {
  let endpoint;
  let mockRequestObject;
  let mockResponseObject;
  let mockEnvironment;

  beforeEach(() => {
    mockEnvironment = { HOST: 'http://localhost', GOOGLE_CLIENT_ID: 'test-client-id', GOOGLE_CLIENT_SECRET: 'test-client-secret', GOOGLE_ENDPOINT_WELLKNOWN: 'test-wellknown' };
    mockRequestObject = { protocol: 'http', get: jest.fn().mockReturnValue('localhost'), body: { auth_code: 'test-auth-code', code_verifier: 'test-auth-verifier'} };
    mockResponseObject = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    endpoint = new CodeExchangeEndpoint();
    endpoint.setEnvironment(mockEnvironment).setRequestObject(mockRequestObject).setResponseObject(mockResponseObject);

    OpenIdConnectClient.mockImplementation(() => ({
      setRedirectUri: jest.fn().mockReturnThis(),
      setClientId: jest.fn().mockReturnThis(),
      setClientSecret: jest.fn().mockReturnThis(),
      setWellKnownEndpoint: jest.fn().mockReturnThis(),
      exchangeAuthorizationCode: jest.fn().mockResolvedValue({ id_token: createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature) }),
      setCodeVerifier: jest.fn().mockReturnThis(),
    }));

    crypto.randomBytes.mockReturnValue({ toString: jest.fn().mockReturnValue('random-token') });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if auth_code is missing', async () => {
    mockRequestObject.body = {};
    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(400);
    expect(mockResponseObject.json).toHaveBeenCalledWith({ error: 'Invalid code' });
  });

  it('should return 401 if token exchange fails', async () => {
    OpenIdConnectClient.mockImplementation(() => ({
      setRedirectUri: jest.fn().mockReturnThis(),
      setClientId: jest.fn().mockReturnThis(),
      setClientSecret: jest.fn().mockReturnThis(),
      setWellKnownEndpoint: jest.fn().mockReturnThis(),
      exchangeAuthorizationCode: jest.fn().mockRejectedValue(new Error('Invalid code')),
      setCodeVerifier: jest.fn().mockReturnThis(),
    }));

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(400);
    expect(mockResponseObject.json).toHaveBeenCalledWith({ error: 'Bad Request' });
  });

  it('should return a valid response on successful token exchange', async () => {
    await endpoint.execute();

    expect(mockResponseObject.json).toHaveBeenCalledWith(expect.objectContaining({
      server_token: 'random-token',
      providerResponse: expect.objectContaining({
        providedInfo: expect.any(Object),
        tokenPayload: expect.any(Object)
      })
    }));
  });
});
