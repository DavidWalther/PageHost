const jwt = require('jsonwebtoken');

class JwtService {
  /**
   * Creates a signed JWT with HS256 algorithm.
   *
   * @param {string} userId - The user's email or identifier
   * @param {string} idp - Identity Provider (e.g. 'google')
   * @param {string[]} scopes - Array of permission scopes
   * @param {string} serverSecret - The secret used to sign the token ($AUTH_SERVER_SECRET)
   * @param {number} [lifetimeSeconds=900] - Token lifetime in seconds (default: 15 minutes)
   * @returns {string} Signed JWT string
   */
  static createJwt(userId, idp, scopes, serverSecret, lifetimeSeconds = 900) {
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      userId,
      IdP: idp,
      scopes,
      exp: now + lifetimeSeconds,
      nbf: now,
    };

    return jwt.sign(payload, serverSecret, {
      algorithm: 'HS256',
      header: { alg: 'HS256', typ: 'JWT' },
    });
  }

  /**
   * Verifies a JWT and returns the decoded payload, or null if invalid.
   *
   * @param {string} token - The JWT string to verify
   * @param {string} serverSecret - The secret used to verify the signature
   * @returns {object|null} Decoded payload or null if verification fails
   */
  static verifyJwt(token, serverSecret) {
    try {
      return jwt.verify(token, serverSecret, { algorithms: ['HS256'] });
    } catch (e) {
      return null;
    }
  }

  /**
   * Extracts scopes from a valid JWT. Returns null if the token is invalid.
   *
   * @param {string} token - The JWT string
   * @param {string} serverSecret - The secret used to verify the signature
   * @returns {string[]|null} Array of scopes or null if verification fails
   */
  static getScopesFromJwt(token, serverSecret) {
    const payload = JwtService.verifyJwt(token, serverSecret);
    if (!payload) {
      return null;
    }
    return payload.scopes || [];
  }
}

module.exports = JwtService;
