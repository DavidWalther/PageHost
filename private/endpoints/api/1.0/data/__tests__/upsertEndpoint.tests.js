const UpsertEndpoint = require('../upsertEndpoint');
const { DataFacade } = require('../../../../../database2/DataFacade.js');
const { Logging } = require('../../../../../modules/logging');

jest.mock('../../../../../database2/DataFacade');
jest.mock('../../../../../modules/logging');

describe('UpsertEndpoint', () => {
  let req, res, endpoint, environment;

  beforeEach(() => {
    environment = {
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'create'])
    };
    req = { url: '/api/1.0/data/change/test', body: { object: 'test', payload: { key: 'value' } } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    DataFacade.mockClear();
    Logging.debugMessage.mockClear();
  });

  it('should perform create when no id is present and create is allowed', async () => {
    req.body = { object: 'test', payload: { key: 'value' } };
    const mockCreateData = jest.fn().mockResolvedValue({ id: 'newid', key: 'value' });
    DataFacade.mockImplementation(() => ({
      setSkipCache: jest.fn().mockReturnThis(),
      createData: mockCreateData,
    }));
    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, result: { id: 'newid', key: 'value' } });
    expect(mockCreateData).toHaveBeenCalledWith(req.body);
  });

  it('should perform update when id is present and edit is allowed', async () => {
    req.body = { object: 'test', payload: { id: 'existingid', key: 'value' } };
    const mockUpdateData = jest.fn().mockResolvedValue({ id: 'existingid', key: 'value' });
    DataFacade.mockImplementation(() => ({ setSkipCache: () => ({ updateData: mockUpdateData }) }));
    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, result: { id: 'existingid', key: 'value' } });
    expect(mockUpdateData).toHaveBeenCalledWith(req.body);
  });

  it('should deny create if not allowed', async () => {
    environment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['edit']);
    req.body = { object: 'test', payload: { key: 'value' } };
    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
  });

  it('should deny update if not allowed', async () => {
    environment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['create']);
    req.body = { object: 'test', payload: { id: 'existingid', key: 'value' } };
    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
  });

  it('should return 400 for invalid request data', async () => {
    req.body = { object: 'test' };
    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
  });

  it('should create a complete record and return the full created record with applicationIncluded', async () => {
    // Set up environment with APPLICATION_KEY
    environment.APPLICATION_APPLICATION_KEY = 'test-app-key';

    // Create a more comprehensive payload similar to a chapter record
    const inputPayload = {
      title: 'Test Chapter',
      description: 'Test chapter description',
      content: 'Chapter content here',
      sortOrder: 1,
      isActive: true,
      metadata: { author: 'testuser' }
    };

    req.body = {
      object: 'chapter',
      payload: inputPayload
    };

    // Mock the complete created record that would be returned from database
    const createdRecord = {
      id: 'generated-uuid-123',
      ...inputPayload,
      applicationIncluded: 'test-app-key',
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:00:00Z'
    };

    const mockCreateData = jest.fn().mockResolvedValue(createdRecord);
    DataFacade.mockImplementation(() => ({
      setSkipCache: jest.fn().mockReturnThis(),
      createData: mockCreateData,
    }));

    endpoint = new UpsertEndpoint().setEnvironment(environment).setRequestObject(req).setResponseObject(res);
    await endpoint.execute();

    // Verify the applicationIncluded was added to the payload before sending to DataFacade
    const expectedPayloadWithApp = {
      object: 'chapter',
      payload: {
        ...inputPayload,
        applicationIncluded: 'test-app-key'
      }
    };

    expect(mockCreateData).toHaveBeenCalledWith(expectedPayloadWithApp);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      result: createdRecord
    });

    // Verify the complete record structure is returned
    const response = res.json.mock.calls[0][0];
    expect(response.result).toHaveProperty('id', 'generated-uuid-123');
    expect(response.result).toHaveProperty('title', 'Test Chapter');
    expect(response.result).toHaveProperty('applicationIncluded', 'test-app-key');
    expect(response.result).toHaveProperty('createdAt');
    expect(response.result).toHaveProperty('updatedAt');
  });
});