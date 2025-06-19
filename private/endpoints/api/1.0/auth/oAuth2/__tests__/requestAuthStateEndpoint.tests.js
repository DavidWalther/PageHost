const { Logging } = require('../../../../../../modules/logging.js');
const RequestAuthStateEndpoint = require('../requestAuthStateEndpoint');
const { DataCache2 } = require('../../../../../../database2/DataCache/DataCache.js');

let mockSetKey = jest.fn().mockResolvedValue(true);
let mockGetKey = jest.fn().mockResolvedValue(false);
let mockDeleteKey = jest.fn().mockResolvedValue(true);

jest.mock('../../../../../../modules/logging');
jest.mock('../../../../../../database2/DataCache/DataCache.js', () => {
  return {
    DataCache2: jest.fn().mockImplementation(() => {
      return {
        set: mockSetKey,
        get: mockGetKey,
        del: mockDeleteKey,
      };
    }),
  };
});

describe('RequestAuthStateEndpoint', () => {
  let endpoint;
  let mockEnvironment;
  let mockRequestObject;
  let mockResponseObject;

  beforeEach(() => {
    mockEnvironment = {};
    mockRequestObject = {};
    mockResponseObject = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // clear the mock calls before each test
    mockSetKey.mockClear();
    mockGetKey.mockClear();
    mockDeleteKey.mockClear();

    // Create a new instance of the endpoint before each test
    endpoint = new RequestAuthStateEndpoint()
      .setEnvironment(mockEnvironment)
      .setRequestObject(mockRequestObject)
      .setResponseObject(mockResponseObject);
  });

  it('should generate a new state value and save it to cache', async () => {
    mockEnvironment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['login']); // Ensure login is allowed
    await endpoint.setEnvironment(mockEnvironment).execute();

    // Assert that a state value was generated and returned
    expect(mockResponseObject.json).toHaveBeenCalledTimes(1);
    const generatedState = mockResponseObject.json.mock.calls[0][0];
    expect(typeof generatedState).toBe('string');
    expect(generatedState.length).toBeGreaterThan(0);

    // Assert that the state value was cached
    const cacheInstance = new DataCache2(mockEnvironment);
    expect(cacheInstance.set).toHaveBeenCalledTimes(1);
    expect(cacheInstance.set).toHaveBeenCalledWith(
      expect.stringContaining('short-term-auth-state-'),
      true
    );
  });

  it('should return the generated state value in the response', async () => {
    await endpoint.execute();

    expect(mockResponseObject.json).toHaveBeenCalledTimes(1);
    const generatedState = mockResponseObject.json.mock.calls[0][0];
    expect(generatedState).toBeDefined();
  });

  it('should return 403 if login is not allowed', async () => {
    mockEnvironment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['something_else']); // 'login' missing
    await endpoint.setEnvironment(mockEnvironment).execute();
    expect(mockResponseObject.status).toHaveBeenCalledWith(403);
    expect(mockResponseObject.json).toHaveBeenCalledWith({ error: 'Login not allowed' });
  });
});
