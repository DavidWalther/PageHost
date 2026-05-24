const LogoutEndpoint = require('../LogoutEndpoint.js');
const { Logging } = require('../../../../../modules/logging.js');
const JwtService = require('../../../../../modules/oAuth2/JwtService.js');
const { DataFacade } = require('../../../../../database2/DataFacade.js');

jest.mock('../../../../../modules/logging.js');
jest.mock('../../../../../modules/oAuth2/JwtService.js');
jest.mock('../../../../../database2/DataFacade.js');

describe('LogoutEndpoint', () => {
  let endpoint;
  let mockRequestObject;
  let mockResponseObject;
  let mockEnvironment;
  let mockGetData;
  let mockUpdateData;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEnvironment = {
      AUTH_SERVER_SECRET: 'test-secret',
      APPLICATION_APPLICATION_KEY: 'test-app-key',
    };

    mockRequestObject = {
      headers: {
        authorization: 'Bearer valid-access-token',
      },
    };

    mockResponseObject = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    JwtService.verifyJwt = jest.fn().mockReturnValue({
      userId: 'user@test.com',
      scopes: ['edit'],
    });

    mockGetData = jest
      .fn()
      .mockResolvedValue({ id: 'identity-001', key: 'user@test.com' });
    mockUpdateData = jest.fn().mockResolvedValue({});

    DataFacade.mockImplementation(() => ({
      getData: mockGetData,
      updateData: mockUpdateData,
    }));

    endpoint = new LogoutEndpoint();
    endpoint
      .setEnvironment(mockEnvironment)
      .setRequestObject(mockRequestObject)
      .setResponseObject(mockResponseObject);
  });

  it('should invalidate refresh token in database on successful logout', async () => {
    await endpoint.execute();

    expect(mockUpdateData).toHaveBeenCalledWith({
      object: 'identity',
      payload: {
        id: 'identity-001',
        refreshtoken: null,
      },
    });
    expect(mockResponseObject.status).toHaveBeenCalledWith(200);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      message: 'Logout successful',
    });
  });

  it('should return 401 when Authorization header is missing', async () => {
    mockRequestObject.headers = {};

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(401);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
    });
    expect(mockUpdateData).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    mockRequestObject.headers.authorization = 'Basic abc123';

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(401);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
    });
  });

  it('should return 401 when access token is invalid', async () => {
    JwtService.verifyJwt = jest.fn().mockReturnValue(null);

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(401);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
    });
    expect(mockUpdateData).not.toHaveBeenCalled();
  });

  it('should still return 200 if identity record is not found', async () => {
    mockGetData.mockResolvedValue({});

    await endpoint.execute();

    expect(mockUpdateData).not.toHaveBeenCalled();
    expect(mockResponseObject.status).toHaveBeenCalledWith(200);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      message: 'Logout successful',
    });
  });

  it('should still return 200 if database update fails', async () => {
    mockUpdateData.mockRejectedValue(new Error('DB connection failed'));

    await endpoint.execute();

    expect(mockResponseObject.status).toHaveBeenCalledWith(200);
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      message: 'Logout successful',
    });
  });
});
