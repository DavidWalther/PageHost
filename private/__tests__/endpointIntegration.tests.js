const UpsertEndpoint = require('../endpoints/api/1.0/data/upsertEndpoint');
const DeleteEndpoint = require('../endpoints/api/1.0/data/deleteEndpoint');
const { DataStorage } = require('../database2/DataStorage/DataStorage');
const { DataCache2 } = require('../database2/DataCache/DataCache');
const { Logging } = require('../modules/logging');

jest.mock('../database2/DataStorage/DataStorage');
jest.mock('../database2/DataCache/DataCache');
jest.mock('../modules/logging');


const MOCK_APPLICATION_KEY = 'test-key';
describe('UpsertEndpoint Integration', () => {
  let req, res, environment, endpoint;
  let mockUpdateData;
  let mockCreateData;
  let mockGetData;
  let mockSetData;

  beforeEach(() => {
    environment = {
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'create']),
      APPLICATION_APPLICATION_KEY: MOCK_APPLICATION_KEY,
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

  it('should set the correct application key in DataStorage', async () => {
    mockCreateData = jest.fn().mockResolvedValue({ id: 'newid' });
    mockGetData = jest.fn().mockResolvedValue(null);
    req.body = { object: 'paragraph', payload: { key: 'value' } };
    
    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute().then(() => {
      
            //applicationIncluded: MOCK_APPLICATION_KEY
      const callArgs = mockCreateData.mock.calls[0][1];
      expect(callArgs).toHaveProperty('key');
      expect(callArgs).toHaveProperty('applicationIncluded');
    });
  });
});

describe('DeleteEndpoint Integration', () => {
  let req, res, environment, endpoint;
  let mockDeleteData;
  let mockSetData;
  let mockGetData;

  beforeEach(() => {
    environment = {
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['delete']),
      APPLICATION_APPLICATION_KEY: MOCK_APPLICATION_KEY,
    };
    req = { url: '/api/1.0/data/delete', query: { object: 'paragraph', id: 'deleteid' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockDeleteData = jest.fn().mockResolvedValue({ id: 'deleteid' });
    DataStorage.mockImplementation(() => ({
      setConditionApplicationKey: jest.fn().mockReturnThis(),
      deleteData: mockDeleteData,
    }));
    DataCache2.mockImplementation(() => ({
      set: mockSetData,
      get: mockGetData,
      del: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call DataStorage.deleteData and return success', async () => {
    endpoint = new DeleteEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(mockDeleteData).toHaveBeenCalledWith('paragraph', 'deleteid');
  });

  it('should return 400 if object or id is missing', async () => {
    req.query = { object: 'paragraph' };
    endpoint = new DeleteEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Missing object or id' });
  });

  it('should return 403 if delete is not allowed', async () => {
    environment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['edit']);
    endpoint = new DeleteEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
  });
});
