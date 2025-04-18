const { Logging } = require('../../../../modules/logging');
const { DataCache2 } = require('../../../../database2/DataCache/DataCache.js');
const crypto = require('crypto');

class RequestAuthStateEndpoint {
  constructor() {
    this.environment = null;
    this.requestObject = null;
    this.responseObject = null;
  }

  setEnvironment(environment) {
    this.environment = environment;
    return this;
  }

  setRequestObject(requestObject) {
    this.requestObject = requestObject;
    return this;
  }

  setResponseObject(responseObject) {
    this.responseObject = responseObject;
    return this;
  }

  generateRandomState(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  async execute() {
    const LOCATION = 'RequestAuthStateEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Executing requestAuthState`, location: LOCATION });

    const state = this.generateRandomState();
    const PREFIX_FOR_SHORT_TERM_CACHE = 'short-term';
    const auth_state_cache_key = `${PREFIX_FOR_SHORT_TERM_CACHE}-auth-state-${state}`;

    const cache = new DataCache2(this.environment);
    await cache.set(auth_state_cache_key, true);

    this.responseObject.json(state);
    Logging.debugMessage({ severity: 'INFO', message: `State generated and sent: ${state}`, location: LOCATION });
  }
}

module.exports = RequestAuthStateEndpoint;
