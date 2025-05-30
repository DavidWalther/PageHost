const UpsertEndpoint = require('../endpoints/api/1.0/data/upsertEndpoint');
const { DataStorage } = require('../database2/DataStorage/DataStorage');
const { DataCache2 } = require('../database2/DataCache/DataCache');
const { Logging } = require('../modules/logging');

jest.mock('../database2/DataStorage/DataStorage');
jest.mock('../database2/DataCache/DataCache');
jest.mock('../modules/logging');

describe('UpsertEndpoint Integration', () => {
  let req, res, environment, endpoint;
  let mockUpdateData;
  let mockCreateData;
  let mockGetData;
  let mockSetData;

  beforeEach(() => {
    environment = {
      APPLICATION_ACTIVE_DMLS: JSON.stringify(['edit', 'create']),
      APPLICATION_APPLICATION_KEY: 'test-key',
    };
    req = { url: '/api/1.0/data/change/test', body: { object: 'story', payload: { id: 'existingid', key: 'value' } } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockUpdateData = jest.fn().mockResolvedValue({ id: 'existingid', key: 'value' });
    DataStorage.mockImplementation(() => ({
      setConditionApplicationKey: jest.fn().mockReturnThis(),
      updateData: mockUpdateData,
      createRecord: mockCreateData,
    }));
    DataCache2.mockImplementation(() => ({
      set: mockSetData,
      get: mockGetData,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call only the Postgres connector (DataStorage) and not Redis (DataCache2) on update', async () => {
    mockCreateData = jest.fn().mockResolvedValue({ id: 'newid' });
    mockGetData = jest.fn().mockResolvedValue(null);
    req.body = { object: 'paragraph', payload: { key: 'value' } };
    
    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    endpoint.execute().then(() => {
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, result: { id: 'newid'} });
      // Postgres connector (updateData) should be called
      expect(mockCreateData).toHaveBeenCalledTimes(1);
      // Redis connector (DataCache2) should not be called
      expect(mockGetData).not.toHaveBeenCalled();
    });
  });
});
