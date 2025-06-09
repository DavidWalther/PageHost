require('dotenv').config();

class Environment {
  constructor(environmentInput) {
    this._originalEnv = environmentInput || process.env;
  }

  getEnvironment() {
    return Object.freeze({... this._originalEnv});
  }
}

module.exports = {Environment};
