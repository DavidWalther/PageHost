const { Logging } = require('../../../../modules/logging');
const JwtService = require('../../../../modules/oAuth2/JwtService.js');
const { DataFacade } = require('../../../../database2/DataFacade.js');

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
    Logging.debugMessage({
      severity: 'INFO',
      message: 'Executing logout',
      location: LOCATION,
    });

    const authHeader = this.requestObject.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      Logging.debugMessage({
        severity: 'WARNING',
        message: `Missing or invalid Authorization header`,
        location: LOCATION,
      });
      return this.responseObject.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const payload = JwtService.verifyJwt(
      token,
      this.environment.AUTH_SERVER_SECRET
    );

    if (!payload) {
      Logging.debugMessage({
        severity: 'WARNING',
        message: 'Invalid access token on logout',
        location: LOCATION,
      });
      return this.responseObject.status(401).json({ error: 'Unauthorized' });
    }

    // Invalidate refresh token in database
    const dataFacade = new DataFacade(this.environment);
    try {
      const userData = {
        request: { table: 'identity', key: payload.userId },
      };
      const identityRecord = await dataFacade.getData(userData);

      if (identityRecord && identityRecord.id) {
        await dataFacade.updateData({
          object: 'identity',
          payload: {
            id: identityRecord.id,
            refreshtoken: null,
          },
        });
        Logging.debugMessage({
          severity: 'INFO',
          message: 'Refresh token invalidated',
          location: LOCATION,
        });
      }
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        message: `Error invalidating refresh token: ${error}`,
        location: LOCATION,
      });
    }

    Logging.debugMessage({
      severity: 'INFO',
      message: `Logout successful`,
      location: LOCATION,
    });
    return this.responseObject
      .status(200)
      .json({ message: 'Logout successful' });
  }
}

module.exports = LogoutEndpoint;
