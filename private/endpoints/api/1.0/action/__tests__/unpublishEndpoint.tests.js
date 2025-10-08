const UnpublishEndpoint = require('../unpublishEndpoint');
const { DataFacade } = require('../../../../../database2/DataFacade');
const { Logging } = require('../../../../../modules/logging');

// Mock dependencies
jest.mock('../../../../../database2/DataFacade');
jest.mock('../../../../../modules/logging');

describe('UnpublishEndpoint', () => {
  let endpoint;
  let req, res;
  let environment;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock environment
    environment = { test: 'environment' };

    // Mock request and response objects
    req = {
      body: {},
      url: '/api/1.0/actions/unpublish'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Create endpoint instance
    endpoint = new UnpublishEndpoint();
    endpoint.setEnvironment(environment)
      .setRequestObject(req)
      .setResponseObject(res);

    // Mock logging
    Logging.debugMessage = jest.fn();
  });

  describe('Input Validation', () => {
    it('should return 400 for missing request body', async () => {
      req.body = undefined;

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Invalid request data' 
      });
    });

    it('should return 400 for missing object parameter', async () => {
      req.body = { id: '123' };

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Invalid request data' 
      });
    });

    it('should return 400 for missing id parameter', async () => {
      req.body = { object: 'paragraph' };

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Invalid request data' 
      });
    });

    it('should return 400 for invalid object parameter type', async () => {
      req.body = { object: 123, id: '123' };

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Invalid request data' 
      });
    });

    it('should return 400 for invalid id parameter type', async () => {
      req.body = { object: 'paragraph', id: 123 };

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Invalid request data' 
      });
    });

    it('should return 400 for unsupported object type', async () => {
      req.body = { object: 'unsupported', id: '123' };

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Invalid request data' 
      });
    });

    it('should accept valid paragraph object type', async () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      // Should not fail validation (will fail at record not found)
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should accept valid chapter object type', async () => {
      req.body = { object: 'chapter', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      // Should not fail validation (will fail at record not found)
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should accept valid story object type', async () => {
      req.body = { object: 'story', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      // Should not fail validation (will fail at record not found)
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Record Existence', () => {
    it('should return 404 when record does not exist', async () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Record not found' 
      });
    });

    it('should call DataFacade with correct parameters', async () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(null)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(DataFacade).toHaveBeenCalledWith(environment);
      expect(mockDataFacadeInstance.setSkipCache).toHaveBeenCalledWith(true);
      expect(mockDataFacadeInstance.getData).toHaveBeenCalledWith({
        request: {
          table: 'paragraph',
          id: '123'
        }
      });
    });

    it('should handle DataFacade errors', async () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Database error' 
      });
    });
  });

  describe('Unpublish Logic', () => {
    it('should return 400 when record is already unpublished', async () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ id: '123', publishDate: null })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Record is already unpublished' 
      });
    });

    it('should successfully unpublish published paragraph', async () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ 
          id: '123', 
          publishDate: '2023-01-01T00:00:00.000Z' 
        }),
        updateData: jest.fn().mockResolvedValue({ id: '123' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(mockDataFacadeInstance.updateData).toHaveBeenCalledWith({
        object: 'paragraph',
        payload: {
          id: '123',
          publishDate: null
        }
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should successfully unpublish published chapter', async () => {
      req.body = { object: 'chapter', id: '456' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ 
          id: '456', 
          publishDate: '2023-01-01T00:00:00.000Z' 
        }),
        updateData: jest.fn().mockResolvedValue({ id: '456' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(mockDataFacadeInstance.updateData).toHaveBeenCalledWith({
        object: 'chapter',
        payload: {
          id: '456',
          publishDate: null
        }
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should successfully unpublish published story', async () => {
      req.body = { object: 'story', id: '789' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ 
          id: '789', 
          publishDate: '2023-01-01T00:00:00.000Z' 
        }),
        updateData: jest.fn().mockResolvedValue({ id: '789' })
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(mockDataFacadeInstance.updateData).toHaveBeenCalledWith({
        object: 'story',
        payload: {
          id: '789',
          publishDate: null
        }
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should handle updateData errors', async () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue({ 
          id: '123', 
          publishDate: '2023-01-01T00:00:00.000Z' 
        }),
        updateData: jest.fn().mockRejectedValue(new Error('Update failed'))
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await endpoint.execute();

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Update failed' 
      });
    });
  });

  describe('validateInput method', () => {
    it('should return true for valid input', () => {
      req.body = { object: 'paragraph', id: '123' };
      
      const result = endpoint.validateInput();
      
      expect(result).toBe(true);
    });

    it('should return false for missing body', () => {
      req.body = undefined;
      
      const result = endpoint.validateInput();
      
      expect(result).toBe(false);
    });
  });

  describe('getRecord method', () => {
    it('should return record when found', async () => {
      const expectedRecord = { id: '123', publishDate: '2023-01-01T00:00:00.000Z' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockResolvedValue(expectedRecord)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      const result = await endpoint.getRecord('paragraph', '123');

      expect(result).toEqual(expectedRecord);
    });

    it('should throw error when DataFacade fails', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        getData: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await expect(endpoint.getRecord('paragraph', '123')).rejects.toThrow('Database error');
    });
  });

  describe('unpublishRecord method', () => {
    it('should successfully unpublish record', async () => {
      const expectedResult = { id: '123' };
      
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        updateData: jest.fn().mockResolvedValue(expectedResult)
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      const result = await endpoint.unpublishRecord('paragraph', '123');

      expect(result).toEqual(expectedResult);
      expect(mockDataFacadeInstance.updateData).toHaveBeenCalledWith({
        object: 'paragraph',
        payload: {
          id: '123',
          publishDate: null
        }
      });
    });

    it('should throw error when updateData fails', async () => {
      const mockDataFacadeInstance = {
        setSkipCache: jest.fn().mockReturnThis(),
        updateData: jest.fn().mockRejectedValue(new Error('Update failed'))
      };
      DataFacade.mockImplementation(() => mockDataFacadeInstance);

      await expect(endpoint.unpublishRecord('paragraph', '123')).rejects.toThrow('Update failed');
    });
  });
});
