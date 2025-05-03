const { EndpointLogic } = require('../../EndpointLogic');

class EnvironmentVariablesEndpoint extends EndpointLogic {
  async execute() {
    const AUTH_OIDC_REDIRECT_URI = 'https://glacial-plains-08201-4314ef80e9a0.herokuapp.com'; 
    const HOST = this.environment.HOST || `${this.requestObject.protocol}://${this.requestObject.get('host')}`;
    const publicVars = {
      system: {
        isMock: this.environment.MOCK_DATA_ENABLE === 'true',
      },
      auth: {
        version: '1.0',
        google: {
          clientId: this.environment.GOOGLE_CLIENT_ID,
          redirect_uri: AUTH_OIDC_REDIRECT_URI,
          scope: ['openid', 'email', 'profile'],
          response_type: 'code'
        }
      }
    };

    this.responseObject.json(publicVars);
  }
}

module.exports = { EnvironmentVariablesEndpoint };
