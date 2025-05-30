const { DataCache2 } = require('../../database2/DataCache/DataCache.js');
const crypto = require('crypto');

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

  async createBearer(userInfo) {
    return new Promise(async (resolve, reject) => {
      // Guard clauses
      if(!userInfo) { return null; }
      if(!this.isUserValid(userInfo)) {
        reject('User is not valid');
        return;
      }

      // buisiness logic
      let scopes = this.getUserScopes(userInfo);
      const bearerToken = this.createBearerForUser();

      const bearerTokenCacheKey = this.getBearerCacheKey(bearerToken);
      const bearerTokenCacheValue = {userInfo, scopes};

      let cache = new DataCache2(this.environment);
      await cache.set(bearerTokenCacheKey, bearerTokenCacheValue);

      resolve(bearerToken);
    });
  }

  getUserScopes(userInfo) {
    // Guard clauses
    if(!userInfo) { return []; }
    if(userInfo.email !== this.environment.AUTH_REGISTERED_USER_EMAIL) {
      return [];
    }
    // buisiness logic

    return ['edit','create']; // these are hardcoded (for as long as there is no user management and only one user)
  }

  isUserValid(userInfo) {
    // Guard clauses
    if(!userInfo) { return false; }

    if(userInfo.email !== this.environment.AUTH_REGISTERED_USER_EMAIL) {
      return false;
    }

    return true;
  }

  /**
   * Creates a Bearer token for the user based on the id_token payload, the requested scopes and the server secret.
   */
  createBearerForUser() {
    return crypto.randomBytes(64).toString('hex');
  }

  getBearerCacheKey(bearerToken) {
    // Guard clauses
    if(!bearerToken) { return null; }
    if(!this.environment.AUTH_SERVER_SECRET) {
      throw new Error('No server secret provided');
    }

    return `mid-term-bearer-token-${bearerToken}`;
  }

  async getScopesForBearer(bearer) {
    // Guard clauses
    if (!bearer) {
      return [];
    }

    const cache = new DataCache2(this.environment);
    const cacheKey = this.getBearerCacheKey(bearer);
    const cacheValue = await cache.get(cacheKey);

    if (!cacheValue) {
      return [];
    }

    const { scopes } = cacheValue;

    return scopes;
  }

  async isBearerValidFromScope(bearer, requestedScopes) {
    // Guard clauses
    if (!bearer || !requestedScopes) {
      return false;
    }

    const cache = new DataCache2(this.environment);
    const cacheKey = this.getBearerCacheKey(bearer);
    const cacheValue = await cache.get(cacheKey);

    if (!cacheValue) {
      return false;
    }

    const { userInfo, scopes } = cacheValue;

    if (!this.isUserValid(userInfo)) {
      return false;
    }

    // check if the Bearer was created for the requested scopes
    const isBearedRCreatedForRequestedScopes = requestedScopes.every(scope => scopes.includes(scope));

    return isBearedRCreatedForRequestedScopes;
  }

  async deleteBearer(bearer) {
    // Guard clauses
    if (!bearer) {
      return false;
    }

    const cache = new DataCache2(this.environment);
    const cacheKey = this.getBearerCacheKey(bearer);

    await cache.del(cacheKey);
  }

  async isBearerValid(bearer) {
    // Guard clauses
    if (!bearer) {
      return false;
    }

    const cache = new DataCache2(this.environment);
    const cacheKey = this.getBearerCacheKey(bearer);
    const cacheValue = await cache.get(cacheKey);

    return !!cacheValue;
  }
}

module.exports = AccessTokenService;
