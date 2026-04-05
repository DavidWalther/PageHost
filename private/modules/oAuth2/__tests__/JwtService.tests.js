const JwtService = require('../JwtService.js');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-server-secret';
const TEST_USER_ID = 'user@example.com';
const TEST_IDP = 'google';
const TEST_SCOPES = ['edit', 'create', 'delete', 'publish'];

describe('JwtService', () => {
  describe('createJwt', () => {
    it('should return a signed JWT string', () => {
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should produce a token with HS256 algorithm in the header', () => {
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      const [encodedHeader] = token.split('.');
      const header = JSON.parse(Buffer.from(encodedHeader, 'base64').toString());
      expect(header.alg).toBe('HS256');
      expect(header.typ).toBe('JWT');
    });

    it('should embed userId, IdP, and scopes in the payload', () => {
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      const payload = jwt.decode(token);
      expect(payload.userId).toBe(TEST_USER_ID);
      expect(payload.IdP).toBe(TEST_IDP);
      expect(payload.scopes).toEqual(TEST_SCOPES);
    });

    it('should set exp 15 minutes (900 seconds) after nbf by default', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      const after = Math.floor(Date.now() / 1000);

      const payload = jwt.decode(token);
      expect(payload.iat).toBeGreaterThanOrEqual(before);
      expect(payload.iat).toBeLessThanOrEqual(after);
      expect(payload.nbf).toBe(payload.iat);
      expect(payload.exp).toBe(payload.nbf + 900);
    });

    it('should use the provided lifetimeSeconds for exp', () => {
      const customLifetime = 3600;
      const before = Math.floor(Date.now() / 1000);
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET, customLifetime);
      const after = Math.floor(Date.now() / 1000);

      const payload = jwt.decode(token);
      expect(payload.nbf).toBeGreaterThanOrEqual(before);
      expect(payload.nbf).toBeLessThanOrEqual(after);
      expect(payload.exp).toBe(payload.nbf + customLifetime);
    });
  });

  describe('verifyJwt', () => {
    it('should return the decoded payload for a valid token', () => {
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      const payload = JwtService.verifyJwt(token, TEST_SECRET);
      expect(payload).not.toBeNull();
      expect(payload.userId).toBe(TEST_USER_ID);
    });

    it('should return null for a token signed with a different secret', () => {
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      const result = JwtService.verifyJwt(token, 'wrong-secret');
      expect(result).toBeNull();
    });

    it('should return null for an expired token', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = jwt.sign(
        { userId: TEST_USER_ID, IdP: TEST_IDP, scopes: TEST_SCOPES, exp: now - 1, nbf: now - 100, iat: now - 100 },
        TEST_SECRET,
        { algorithm: 'HS256', noTimestamp: true }
      );
      const result = JwtService.verifyJwt(expiredToken, TEST_SECRET);
      expect(result).toBeNull();
    });

    it('should return null for a malformed token', () => {
      const result = JwtService.verifyJwt('not.a.valid.jwt', TEST_SECRET);
      expect(result).toBeNull();
    });

    it('should return null for an empty token', () => {
      const result = JwtService.verifyJwt('', TEST_SECRET);
      expect(result).toBeNull();
    });
  });

  describe('getScopesFromJwt', () => {
    it('should return the scopes array for a valid token', () => {
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      const scopes = JwtService.getScopesFromJwt(token, TEST_SECRET);
      expect(scopes).toEqual(TEST_SCOPES);
    });

    it('should return null for an invalid token', () => {
      const scopes = JwtService.getScopesFromJwt('invalid-token', TEST_SECRET);
      expect(scopes).toBeNull();
    });

    it('should return null for a token signed with a different secret', () => {
      const token = JwtService.createJwt(TEST_USER_ID, TEST_IDP, TEST_SCOPES, TEST_SECRET);
      const scopes = JwtService.getScopesFromJwt(token, 'wrong-secret');
      expect(scopes).toBeNull();
    });

    it('should return an empty array for a valid token with no scopes', () => {
      const token = jwt.sign(
        { userId: TEST_USER_ID, IdP: TEST_IDP },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' }
      );
      const scopes = JwtService.getScopesFromJwt(token, TEST_SECRET);
      expect(scopes).toEqual([]);
    });
  });
});
