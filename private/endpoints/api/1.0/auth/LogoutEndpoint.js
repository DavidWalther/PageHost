const { Logging } = require('../../../../modules/logging');

class LogoutEndpoint {
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

  async execute() {
    const LOCATION = 'LogoutEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: 'Executing logout', location: LOCATION });

    const authHeader = this.requestObject.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      Logging.debugMessage({ severity: 'WARNING', message: `Missing or invalid Authorization header`, location: LOCATION });
      return this.responseObject.status(401).json({ error: 'Unauthorized' });
    }

    Logging.debugMessage({ severity: 'INFO', message: `Logout successful`, location: LOCATION });
    return this.responseObject.status(200).json({ message: 'Logout successful' });
  }
}

module.exports = LogoutEndpoint;
