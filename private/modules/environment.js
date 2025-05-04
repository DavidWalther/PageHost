require('dotenv').config();

class Environment {
  constructor(environmentInput) {
    this._originalEnv = environmentInput || process.env;
    this._originalEnv.HOST = process.env.AUTH_OIDC_REDIRECT_URI;
  }

  getEnvironment() {
    return Object.freeze({... this._originalEnv});
  }
}

module.exports = {Environment};
