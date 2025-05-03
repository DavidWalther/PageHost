require('dotenv').config();

class Environment {
  constructor(environmentInput) {
    this._originalEnv = environmentInput || process.env;
    this._originalEnv.HOST = 'https://glacial-plains-08201-4314ef80e9a0.herokuapp.com';
  }

  getEnvironment() {
    return Object.freeze({... this._originalEnv});
  }
}

module.exports = {Environment};
