const { Logging } = require('../../../../modules/logging');
const AccessTokenService = require('../../../../modules/oAuth2/AccessTokenService');

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
    const token = authHeader.split(' ')[1];

    const accessTokenService = new AccessTokenService().setEnvironment(this.environment);
    const isBearerValid = await accessTokenService.isBearerValid(token);
    if (!isBearerValid) {
      Logging.debugMessage({ severity: 'WARNING', message: `Invalid or expired token`, location: LOCATION });
      return this.responseObject.status(401).json({ error: 'Unauthorized' });
    }

    try {
      await accessTokenService.deleteBearer(token);
      Logging.debugMessage({ severity: 'INFO', message: `Token deleted successfully`, location: LOCATION });
      this.responseObject.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      Logging.debugMessage({ severity: 'ERROR', message: `Error deleting token: ${error}`, location: LOCATION });
      this.responseObject.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = LogoutEndpoint;
