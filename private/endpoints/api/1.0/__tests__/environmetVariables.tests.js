const { EnvironmentVariablesEndpoint } = require('../environmetVariables');
const { Environment } = require('../../../../modules/environment');

describe('EnvironmentVariablesEndpoint', () => {
  let mockRequest, mockResponse, mockEnvironment;

  beforeEach(() => {
    mockEnvironment = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      HOST: 'http://localhost:3000'
    };

    mockRequest = {
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:3000')
    };

    mockResponse = {
      json: jest.fn()
    };
  });

  it('should return the correct public variables', async () => {
    const endpoint = new EnvironmentVariablesEndpoint();
    endpoint
      .setEnvironment(mockEnvironment)
      .setRequestObject(mockRequest)
      .setResponseObject(mockResponse);

    await endpoint.execute();

    expect(mockResponse.json).toHaveBeenCalledWith({
      auth: {
        version: '1.0',
        google: {
          clientId: 'test-client-id',
          redirect_uri: 'http://localhost:3000',
          scope: ['openid', 'email', 'profile'],
          response_type: 'code'
        }
      }
    });
  });

  it('should use the request host if HOST is not set in the environment', async () => {
    delete mockEnvironment.HOST;

    const endpoint = new EnvironmentVariablesEndpoint();
    endpoint
      .setEnvironment(mockEnvironment)
      .setRequestObject(mockRequest)
      .setResponseObject(mockResponse);

    await endpoint.execute();

    expect(mockResponse.json).toHaveBeenCalledWith({
      auth: {
        version: '1.0',
        google: {
          clientId: 'test-client-id',
          redirect_uri: 'http://localhost:3000',
          scope: ['openid', 'email', 'profile'],
          response_type: 'code'
        }
      }
    });
  });
});
