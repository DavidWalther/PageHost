const RefreshTokenService = require('../RefreshTokenService.js');

jest.mock('../../../modules/logging.js');

const SERVER_SECRET = 'test-server-secret-for-integration';
const LIFETIME_DAYS = 7;

describe('RefreshTokenService Integration', () => {
  describe('Refresh Token Lifecycle', () => {
    it('should create a valid refresh token, validate it, and extract the token ID', () => {
      const refreshTokenJwt = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );

      expect(refreshTokenJwt).toBeDefined();
      expect(typeof refreshTokenJwt).toBe('string');

      const payload = RefreshTokenService.verifyRefreshToken(
        refreshTokenJwt,
        SERVER_SECRET
      );

      expect(payload).not.toBeNull();
      expect(payload.token).toBeDefined();
      expect(payload.issuedAt).toBeDefined();
      expect(payload.expiresAt).toBeDefined();

      const tokenId = RefreshTokenService.extractTokenId(
        refreshTokenJwt,
        SERVER_SECRET
      );

      expect(tokenId).toBe(payload.token);
    });

    it('should produce a different token ID on each call (rotation)', () => {
      const token1 = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );
      const token2 = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );

      const id1 = RefreshTokenService.extractTokenId(token1, SERVER_SECRET);
      const id2 = RefreshTokenService.extractTokenId(token2, SERVER_SECRET);

      expect(id1).not.toBe(id2);
    });
  });

  describe('Expired Refresh Token', () => {
    it('should reject an expired refresh token', () => {
      const jwt = require('jsonwebtoken');
      const crypto = require('crypto');

      const now = new Date();
      const expiredAt = new Date(now.getTime() - 1000);

      const payload = {
        token: crypto.randomUUID(),
        issuedAt: new Date(now.getTime() - 86400000).toISOString(),
        expiresAt: expiredAt.toISOString(),
      };

      const expiredJwt = jwt.sign(payload, SERVER_SECRET, {
        algorithm: 'HS256',
        expiresIn: -10,
      });

      const result = RefreshTokenService.verifyRefreshToken(
        expiredJwt,
        SERVER_SECRET
      );

      expect(result).toBeNull();
    });
  });

  describe('Invalid Token ID', () => {
    it('should return null for extractTokenId when JWT signature is invalid', () => {
      const refreshTokenJwt = RefreshTokenService.createRefreshToken(
        SERVER_SECRET,
        LIFETIME_DAYS
      );

      const tokenId = RefreshTokenService.extractTokenId(
        refreshTokenJwt,
        'wrong-secret'
      );

      expect(tokenId).toBeNull();
    });
  });

  describe('Missing Configuration', () => {
    it('should throw an error when serverSecret is not provided', () => {
      expect(() => {
        RefreshTokenService.createRefreshToken(null, LIFETIME_DAYS);
      }).toThrow();
    });

    it('should throw an error when lifetimeDays is not provided', () => {
      expect(() => {
        RefreshTokenService.createRefreshToken(SERVER_SECRET, null);
      }).toThrow();
    });

    it('should throw an error when lifetimeDays is not a positive number', () => {
      expect(() => {
        RefreshTokenService.createRefreshToken(SERVER_SECRET, 0);
      }).toThrow();

      expect(() => {
        RefreshTokenService.createRefreshToken(SERVER_SECRET, -1);
      }).toThrow();
    });
  });
});
