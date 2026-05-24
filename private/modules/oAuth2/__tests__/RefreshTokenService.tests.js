const RefreshTokenService = require('../RefreshTokenService.js');
const jwt = require('jsonwebtoken');

jest.mock('../../../modules/logging.js');

const SERVER_SECRET = 'unit-test-secret';
const LIFETIME_DAYS = 14;

describe('RefreshTokenService', () => {
  describe('createRefreshToken', () => {
    it('should return a valid JWT string', () => {
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );

      expect(typeof token).toBe('string');
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should contain token, issuedAt, and expiresAt in the payload', () => {
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const decoded = jwt.verify(token, SERVER_SECRET);

      expect(decoded.token).toBeDefined();
      expect(decoded.issuedAt).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
    });

    it('should set expiresAt to lifetimeDays from now', () => {
      const before = new Date();
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const after = new Date();

      const decoded = jwt.verify(token, SERVER_SECRET);
      const expiresAt = new Date(decoded.expiresAt);

      const expectedMin = new Date(
        before.getTime() + LIFETIME_DAYS * 24 * 60 * 60 * 1000
      );
      const expectedMax = new Date(
        after.getTime() + LIFETIME_DAYS * 24 * 60 * 60 * 1000
      );

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime() - 1000
      );
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        expectedMax.getTime() + 1000
      );
    });

    it('should generate a UUID v4 format token ID', () => {
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const decoded = jwt.verify(token, SERVER_SECRET);

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(decoded.token).toMatch(uuidRegex);
    });

    it('should throw when serverSecret is null', () => {
      expect(() =>
        RefreshTokenService.createRefreshToken(null, LIFETIME_DAYS)
      ).toThrow('Server secret is required');
    });

    it('should throw when serverSecret is empty string', () => {
      expect(() =>
        RefreshTokenService.createRefreshToken('', LIFETIME_DAYS)
      ).toThrow('Server secret is required');
    });

    it('should throw when lifetimeDays is null', () => {
      expect(() =>
        RefreshTokenService.createRefreshToken(SERVER_SECRET, null)
      ).toThrow('Lifetime days must be a positive number');
    });

    it('should throw when lifetimeDays is 0', () => {
      expect(() =>
        RefreshTokenService.createRefreshToken(SERVER_SECRET, 0)
      ).toThrow('Lifetime days must be a positive number');
    });

    it('should throw when lifetimeDays is negative', () => {
      expect(() =>
        RefreshTokenService.createRefreshToken(SERVER_SECRET, -5)
      ).toThrow('Lifetime days must be a positive number');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should return payload for a valid token', () => {
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const payload = RefreshTokenService.verifyRefreshToken(
        token,
        SERVER_SECRET
      );

      expect(payload).not.toBeNull();
      expect(payload.token).toBeDefined();
      expect(payload.issuedAt).toBeDefined();
      expect(payload.expiresAt).toBeDefined();
    });

    it('should return null for a token signed with a different secret', () => {
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const payload = RefreshTokenService.verifyRefreshToken(
        token,
        'different-secret'
      );

      expect(payload).toBeNull();
    });

    it('should return null for a malformed token', () => {
      const payload = RefreshTokenService.verifyRefreshToken(
        'not.a.valid.jwt',
        SERVER_SECRET
      );

      expect(payload).toBeNull();
    });

    it('should return null for an expired token', () => {
      const expiredToken = jwt.sign(
        {
          token: 'test-uuid',
          issuedAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
        SERVER_SECRET,
        { algorithm: 'HS256', expiresIn: -10 }
      );

      const payload = RefreshTokenService.verifyRefreshToken(
        expiredToken,
        SERVER_SECRET
      );

      expect(payload).toBeNull();
    });

    it('should return null for null input', () => {
      const payload = RefreshTokenService.verifyRefreshToken(
        null,
        SERVER_SECRET
      );

      expect(payload).toBeNull();
    });
  });

  describe('extractTokenId', () => {
    it('should return the UUID from a valid token', () => {
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const tokenId = RefreshTokenService.extractTokenId(token, SERVER_SECRET);

      expect(tokenId).toBeDefined();
      expect(typeof tokenId).toBe('string');
    });

    it('should return null for an invalid token', () => {
      const tokenId = RefreshTokenService.extractTokenId(
        'invalid-jwt',
        SERVER_SECRET
      );

      expect(tokenId).toBeNull();
    });

    it('should return null when using wrong secret', () => {
      const token = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const tokenId = RefreshTokenService.extractTokenId(token, 'wrong-secret');

      expect(tokenId).toBeNull();
    });
  });
});
