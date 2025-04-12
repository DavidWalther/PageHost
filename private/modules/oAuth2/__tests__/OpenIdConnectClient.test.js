const OpenIdConnectClient = require('../OpenIdConnectClient');

const mockJwtHeader = { "kid": "mockKid", "test": "abc"};
const mockJwtPayload = { "email": "test@email.com", "aud": "test-client-id", "exp": 2000000000, "iat": 170000000  };
const mockJwtSignature = '';

const mockJwksResponse = {
  keys: [
    {
      kid: 'mockKid',
      n: 'test-modulus',
      e: 'AQAB',
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig'
    }
  ]
};

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
    oidcClient.setTokenEndpoint('test-token-endpoint');
    oidcClient.setWellKnownEndpoint('test-well-known-endpoint');
    oidcClient.setRedirectUri('test-redirect-uri');
  
    global.fetch = jest.fn((url) => {
      if (url === 'test-token-endpoint') {
        return Promise.resolve({
          json: jest.fn().mockResolvedValue({
            access_token: 'test-access-token',
            id_token: createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature) 
          }),
        });
      } else if (url === 'test-well-known-endpoint') {
        return Promise.resolve({
          json: jest.fn().mockResolvedValue({
            token_endpoint: 'test-token-endpoint',
            jwks_uri: 'test-jwks-uri'
          }),
        });
      } else if (url === 'test-jwks-uri') {
        return Promise.resolve({
          json: jest.fn().mockResolvedValue(mockJwksResponse),
        });
      } else {
        return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
      }
    });
  }); 

  it('should exchange authorization code for tokens', async () => {
    const authCode = 'test-auth-code';
    const tokenResponse = {
      access_token: 'test-access-token',
      id_token: createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature)
    };

    const response = await oidcClient.exchangeAuthorizationCode(authCode);
    expect(response).toEqual(tokenResponse);
  });
/*
  it('should decode ID token', () => {
    const mockJwt = createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature);
    const decodedToken = oidcClient.decodeIdToken(mockJwt);
    expect(decodedToken).toEqual({
      header: mockJwtHeader,
      payload: mockJwtPayload,
      signature: mockJwtSignature
    });
  });*/
});