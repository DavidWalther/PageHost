const PublishEndpoint = require('../publishEndpoint.js');
const { Logging } = require('../../../../../modules/logging.js');
const { DataFacade } = require('../../../../../database2/DataFacade.js');

// Mock dependencies
jest.mock('../../../../../modules/logging.js');
jest.mock('../../../../../database2/DataFacade.js');

describe('PublishEndpoint', () => {
  let req, res, mockEnvironment, endpoint;

  beforeEach(() => {
    // Clear all mocks to prevent test interdependence
    jest.clearAllMocks();

    // Standard environment mock with commonly used variables
    mockEnvironment = {
      APPLICATION_APPLICATION_KEY: 'test-key',
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'create', 'delete', 'publish']),
      MOCK_DATA_ENABLE: 'false',
      LOGGING_SEVERITY_LEVEL: 'DEBUG'
    };

    // Standard request/response mocks with new payload structure
    req = {
      url: '/api/1.0/actions/publish',
      body: {
        object: 'paragraph',
        id: '123'
      },
      headers: { 'authorization': 'Bearer test-token' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Create endpoint instance
    endpoint = new PublishEndpoint()
      .setEnvironment(mockEnvironment)
      .setRequestObject(req)
      .setResponseObject(res);
  });

  describe('Input Validation', () => {
    it('should return 400 for missing request body', async () => {
      req.body = undefined;

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
    });

    it('should return 400 for missing object parameter', async () => {
      req.body = { id: '123' };

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
    });

    it('should return 400 for missing id parameter', async () => {
      req.body = { object: 'paragraph' };

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
    });

    it('should return 400 for invalid object parameter type', async () => {
      req.body = { object: 123, id: '123' };

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
    });

    it('should return 400 for invalid id parameter type', async () => {
      req.body = { object: 'paragraph', id: 123 };

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
    });

    it('should return 400 for unsupported object type', async () => {
      req.body = { object: 'unsupported', id: '123' };

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
    });

    it('should accept valid paragraph object type', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should accept valid chapter object type', async () => {
      req.body = { object: 'chapter', id: '123' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should accept valid story object type', async () => {
      req.body = { object: 'story', id: '123' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('Record Existence Checking', () => {
    it('should return 404 when paragraph record does not exist', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record not found' });
    });

    it('should return 404 when chapter record does not exist', async () => {
      req.body = { object: 'chapter', id: '123' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record not found' });
    });

    it('should return 404 when story record does not exist', async () => {
      req.body = { object: 'story', id: '123' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record not found' });
    });

    it('should call DataFacade with correct parameters', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(mockDataFacadeInstance.getData).toHaveBeenCalledWith({
        request: {
          table: 'paragraph',
          id: '123'
        }
      });
    });
  });

  describe('Already Published Checking', () => {
    it('should return 400 when paragraph is already published', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: '2023-01-01T00:00:00.000Z' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record is already published' });
    });

    it('should return 400 when chapter is already published', async () => {
      req.body = { object: 'chapter', id: '123' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: '2023-01-01T00:00:00.000Z' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record is already published' });
    });

    it('should return 400 when story is already published', async () => {
      req.body = { object: 'story', id: '123' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: '2023-01-01T00:00:00.000Z' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record is already published' });
    });
  });

  describe('Publishing Operation', () => {
    it('should successfully publish unpublished paragraph', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(mockDataFacadeInstance.updateData).toHaveBeenCalledWith({
        object: 'paragraph',
        payload: {
          id: '123',
          publishDate: expect.any(String)
        }
      });
    });

    it('should successfully publish unpublished chapter', async () => {
      req.body = { object: 'chapter', id: '456' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '456', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '456' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(mockDataFacadeInstance.updateData).toHaveBeenCalledWith({
        object: 'chapter',
        payload: {
          id: '456',
          publishDate: expect.any(String)
        }
      });
    });

    it('should successfully publish unpublished story', async () => {
      req.body = { object: 'story', id: '789' };
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '789', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '789' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      endpoint.setRequestObject(req);
      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(mockDataFacadeInstance.updateData).toHaveBeenCalledWith({
        object: 'story',
        payload: {
          id: '789',
          publishDate: expect.any(String)
        }
      });
    });

    it('should set publishDate to current timestamp', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      const beforeTime = new Date();
      await endpoint.execute();
      const afterTime = new Date();

      const updateCall = mockDataFacadeInstance.updateData.mock.calls[0];
      const publishDate = new Date(updateCall[0].payload.publishDate);

      expect(publishDate).toBeInstanceOf(Date);
      expect(publishDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(publishDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should use setSkipCache(true) for all DataFacade operations', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(mockDataFacadeInstance.setSkipCache).toHaveBeenCalledWith(true);
      expect(mockDataFacadeInstance.setSkipCache).toHaveBeenCalledTimes(2); // Once for getData, once for updateData
    });
  });

  describe('Error Handling', () => {
    it('should handle database error when getting record', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Database connection failed' });
    });

    it('should handle database error when updating record', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockRejectedValue(new Error('Update failed'))
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Update failed' });
    });

    it('should log errors appropriately', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockRejectedValue(new Error('Test error'))
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(Logging.debugMessage).toHaveBeenCalledWith({
        severity: 'ERROR',
        message: 'Operation failed: Test error',
        location: 'PublishEndpoint.execute'
      });
    });
  });

  describe('Logging', () => {
    it('should log request received', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(Logging.debugMessage).toHaveBeenCalledWith({
        severity: 'INFO',
        message: 'Request received - /api/1.0/actions/publish',
        location: 'PublishEndpoint.execute'
      });
    });

    it('should log successful publication', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(Logging.debugMessage).toHaveBeenCalledWith({
        severity: 'INFO',
        message: 'Record published successfully: paragraph 123',
        location: 'PublishEndpoint.publishRecord'
      });
    });
  });
});
