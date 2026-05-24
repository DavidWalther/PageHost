const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class RefreshTokenService {
  /**
   * Creates a signed JWT refresh token with a unique UUID identifier.
   *
   * @param {string} serverSecret - The secret used to sign the token
   * @param {number} lifetimeDays - Token lifetime in days
   * @returns {string} Signed JWT string
   */
  static createRefreshToken(serverSecret, lifetimeDays) {
    if (!serverSecret) {
      throw new Error('Server secret is required');
    }
    if (!lifetimeDays || lifetimeDays <= 0) {
      throw new Error('Lifetime days must be a positive number');
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + lifetimeDays * 24 * 60 * 60 * 1000
    );

    const payload = {
      token: crypto.randomUUID(),
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const lifetimeSeconds = lifetimeDays * 24 * 60 * 60;

    return jwt.sign(payload, serverSecret, {
      algorithm: 'HS256',
      expiresIn: lifetimeSeconds,
    });
  }

  /**
   * Verifies a refresh token JWT and returns the decoded payload.
   *
   * @param {string} refreshTokenJwt - The JWT string to verify
   * @param {string} serverSecret - The secret used to verify the signature
   * @returns {object|null} Decoded payload ({ token, issuedAt, expiresAt }) or null if invalid
   */
  static verifyRefreshToken(refreshTokenJwt, serverSecret) {
    try {
      const decoded = jwt.verify(refreshTokenJwt, serverSecret, {
        algorithms: ['HS256'],
      });
      return {
        token: decoded.token,
        issuedAt: decoded.issuedAt,
        expiresAt: decoded.expiresAt,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Extracts the UUID token identifier from a valid refresh token JWT.
   *
   * @param {string} refreshTokenJwt - The JWT string
   * @param {string} serverSecret - The secret used to verify the signature
   * @returns {string|null} UUID token identifier or null if verification fails
   */
  static extractTokenId(refreshTokenJwt, serverSecret) {
    const payload = RefreshTokenService.verifyRefreshToken(
      refreshTokenJwt,
      serverSecret
    );
    if (!payload) {
      return null;
    }
    return payload.token;
  }
}

module.exports = RefreshTokenService;
