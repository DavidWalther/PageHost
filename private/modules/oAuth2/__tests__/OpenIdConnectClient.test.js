const OpenIdConnectClient = require('../OpenIdConnectClient');

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

describe('OpenIdConnectClient', () => {
  const clientId = 'test-client-id';
  const oidcClient = new OpenIdConnectClient();

  beforeAll(() => {
    oidcClient.setClientId(clientId);
    oidcClient.setClientSecret('test-client-secret');
    oidcClient.setRedirectUri('test-redirect-uri');
    oidcClient.setTokenEndpoint('test-token-endpoint');
    oidcClient.setWellKnownEndpoint('test-well-known-endpoint');

    const mockJwt = createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature);
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ id_token: mockJwt })
    });
  });

  it('should exchange authorization code for tokens', async () => {
    const authCode = 'test-auth-code';
    const tokenResponse = {
      access_token: 'test-access-token',
      id_token: 'test-id-token'
    };
    fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue(tokenResponse)
    });

    const response = await oidcClient.exchangeAuthorizationCode(authCode);
    expect(response).toEqual(tokenResponse);
  });

  it('should decode ID token', () => {
    const mockJwt = createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature);
    const decodedToken = oidcClient.decodeIdToken(mockJwt);
    expect(decodedToken).toEqual({
      header: mockJwtHeader,
      payload: mockJwtPayload,
      signature: mockJwtSignature
    });
  });
});