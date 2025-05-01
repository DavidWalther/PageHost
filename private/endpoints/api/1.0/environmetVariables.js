const { EndpointLogic } = require('../../EndpointLogic');

class EnvironmentVariablesEndpoint extends EndpointLogic {
  async execute() {
    const HOST = this.environment.HOST || `${this.requestObject.protocol}://${this.requestObject.get('host')}`;
    const publicVars = {
      system: {
        isMock: this.environment.MOCK_DATA_ENABLE === 'true',
      },
      auth: {
        version: '1.0',
        google: {
          clientId: this.environment.GOOGLE_CLIENT_ID,
          redirect_uri: HOST,
          scope: ['openid', 'email', 'profile'],
          response_type: 'code'
        }
      }
    };

    this.responseObject.json(publicVars);
  }
}

module.exports = { EnvironmentVariablesEndpoint };
