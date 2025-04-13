const jwt = require('jsonwebtoken');
const OpenIdConnectClient = require('../OpenIdConnectClient');
const rsaPemFromModExp = require('rsa-pem-from-mod-exp');

jest.mock('rsa-pem-from-mod-exp');
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockImplementation((token, publicKey, options, callback) => {
    return true;
  })
}));


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

  let mockTokenEndpoint;
  let mockWellKnownEndpoint;
  let mockJwksEndpoint;

  beforeAll(() => {
    oidcClient.setClientId(clientId);
    oidcClient.setClientSecret('test-client-secret');
    oidcClient.setTokenEndpoint('test-token-endpoint');
    oidcClient.setWellKnownEndpoint('test-well-known-endpoint');
    oidcClient.setRedirectUri('test-redirect-uri');

    // Default mock implementations
    mockTokenEndpoint = jest.fn(() =>
      Promise.resolve({
        json: jest.fn().mockResolvedValue({
          access_token: 'test-access-token',
          id_token: createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature),
        }),
      })
    );

    mockWellKnownEndpoint = jest.fn(() =>
      Promise.resolve({
        json: jest.fn().mockResolvedValue({
          token_endpoint: 'test-token-endpoint',
          jwks_uri: 'test-jwks-uri',
        }),
      })
    );

    mockJwksEndpoint = jest.fn(() =>
      Promise.resolve({
        json: jest.fn().mockResolvedValue(mockJwksResponse),
      })
    );

    // Global fetch mock
    global.fetch = jest.fn((url) => {
      if (url === 'test-token-endpoint') {
        return mockTokenEndpoint();
      } else if (url === 'test-well-known-endpoint') {
        return mockWellKnownEndpoint();
      } else if (url === 'test-jwks-uri') {
        return mockJwksEndpoint();
      } else {
        return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
      }
    });
  });

  it('should exchange authorization code for tokens',   async () => {
      const authCode = 'test-auth-code';
      const tokenResponse = {
        access_token: 'test-access-token',
        id_token: createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature),
      };
      oidcClient.setCodeVerifier('test-code-verifier');
      const response = await oidcClient.exchangeAuthorizationCode(authCode);
      expect(response).toEqual(tokenResponse);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1. openId config, 2. token endpoint, 3. JWKS endpoint

      // Check the order of calls
      expect(global.fetch).toHaveBeenNthCalledWith(1, 'test-well-known-endpoint');
      expect(global.fetch).toHaveBeenNthCalledWith(2, 'test-token-endpoint', expect.any(Object));
      //expect(global.fetch).toHaveBeenNthCalledWith(3, 'test-jwks-uri', expect.any(Object));
    });

  it('should decode ID token', () => {
    const mockJwt = createMockJwt(mockJwtHeader, mockJwtPayload, mockJwtSignature);
    const decodedToken = oidcClient.decodeIdToken(mockJwt);
    expect(decodedToken).toEqual({
      header: mockJwtHeader,
      payload: mockJwtPayload,
      signature: mockJwtSignature,
    });
  });

  it('should throw an error if JWKS endpoint delivers no keys', async () => {
    const authCode = 'test-auth-code';

    // Override the JWKS endpoint mock for this test
    mockJwksEndpoint = jest.fn(() =>
      Promise.resolve({
        json: jest.fn().mockResolvedValue({ keys: [] }), // No keys in the response
      })
    );

    await expect(oidcClient.exchangeAuthorizationCode(authCode)).rejects.toThrow('No keys found in the JWKs response');
  });

  it('should throw an error if JWKS endpoint delivers three keys but none matches', async () => {
    const authCode = 'test-auth-code';

    // Override the JWKS endpoint mock for this test
    mockJwksEndpoint = jest.fn(() =>
      Promise.resolve({
        json: jest.fn().mockResolvedValue({
          keys: [
            { kid: 'nonMatchingKid1', n: 'modulus1', e: 'AQAB', kty: 'RSA', alg: 'RS256', use: 'sig' },
            { kid: 'nonMatchingKid2', n: 'modulus2', e: 'AQAB', kty: 'RSA', alg: 'RS256', use: 'sig' },
            { kid: 'nonMatchingKid3', n: 'modulus3', e: 'AQAB', kty: 'RSA', alg: 'RS256', use: 'sig' },
          ],
        }),
      })
    );

    await expect(oidcClient.exchangeAuthorizationCode(authCode)).rejects.toThrow('No matching JWKs key found for the given kid');
  });
});