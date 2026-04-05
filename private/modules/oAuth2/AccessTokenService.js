const JwtService = require('./JwtService.js');

class AccessTokenService {
  constructor() {
  }

  setEnvironment(environment) {
    this._environment = environment;
    return this;
  }

  get serverSecret() {
   return this.environment.AUTH_SERVER_SECRET;
  }

  get environment() {
    return this._environment;
  }

  /**
   * Creates a stateless JWT access token for the user.
   *
   * @param {object} userInfo - Object containing at least an `email` field
   * @param {string[]} scopes - Scopes to embed in the JWT
   * @returns {string} Signed JWT string
   */
  createJwt(userInfo, scopes) {
    if (!userInfo) {
      throw new Error('User information is missing');
    }
    if (!this.environment.AUTH_SERVER_SECRET) {
      throw new Error('No server secret provided');
    }
    const parsedLifetime = parseInt(this.environment.AUTH_JWT_LIFETIME_SECONDS, 10);
    const lifetimeSeconds = (this.environment.AUTH_JWT_LIFETIME_SECONDS && !isNaN(parsedLifetime) && parsedLifetime > 0)
      ? parsedLifetime
      : 900;
    return JwtService.createJwt(userInfo.email, 'google', scopes, this.environment.AUTH_SERVER_SECRET, lifetimeSeconds);
  }

  getUserScopes(userInfo) {
    // Guard clauses
    if(!userInfo) { return []; }

    // buisiness logic

    return ['edit','create', 'delete', 'publish']; // these are hardcoded (for as long as there is no user management and only one user)
  }
}

module.exports = AccessTokenService;
