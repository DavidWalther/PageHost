const { DataFacade } = require('../DataFacade.js');
const { Environment } = require('../../modules/environment.js');
const { DataCache2 } = require('../DataCache/DataCache.js');
const { DataStorage } = require('../DataStorage/DataStorage.js');

const MOCK_ENVIRONMENT = {
  APPLICATION_APPLICATION_KEY: 'test-key',
  MOCK_DATA_ENABLE: 'false',
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  REDIS_PASSWORD: 'test-password',
  REDIS_HOST: 'test-host',
  REDIS_PORT: 'test-port'
};
const MOCK_CACHE = {
  metaTitle: 'Mock Tabtitle',
  pageHeaderHeadline: 'Mock Headline',
  pageSidebarTitle: 'Mock Contents'
}

const MOCK_DATABASE = {
  rows: [
    {key: 'metaTitle', value: 'Mock Tabtitle'},
    {key: 'pageHeaderHeadline', value: 'Mock Headline'},
    {key: 'pageSidebarTitle', value: 'Mock Contents'}
  ]
};

// ---- Environment.js mock ----
jest.mock('../../modules/environment.js');
let mockGetEnvironment = jest.fn().mockReturnValue(MOCK_ENVIRONMENT);
Environment.mockImplementation(() => {
  return {
    getEnvironment: mockGetEnvironment
  };
});

// ---- DataCache.js mock ----
jest.mock('../DataCache/DataCache.js');
let mockCacheGet = jest.fn().mockReturnValue(MOCK_CACHE);
let mockCacheSet = jest.fn();
DataCache2.mockImplementation(() => {
  return {
    get: mockCacheGet,
    set: mockCacheSet
  };
});

// ---- DataStorage.js mock ----
jest.mock('../DataStorage/DataStorage.js');
let mockQueryConfiguration = jest.fn().mockReturnValue(MOCK_DATABASE);
let mockQueryStory = jest.fn().mockReturnValue();
let mockQueryAllStories = jest.fn().mockReturnValue();
let mockQueryChapter = jest.fn().mockReturnValue();
let mockQueryParagraph = jest.fn().mockReturnValue();
let setConditionApplicationKey = jest.fn();
DataStorage.mockImplementation(() => {
  return {
    setConditionApplicationKey: setConditionApplicationKey,
    queryConfiguration: mockQueryConfiguration,
    queryAllStories: mockQueryAllStories,
    queryStory: mockQueryStory,
    queryChapter: mockQueryChapter,
    queryParagraph: mockQueryParagraph
  };
});


describe('DataFacade', () => {

  afterEach(() => {
    DataCache2.mockClear();
    Environment.mockClear();
    process.env = MOCK_ENVIRONMENT;
  });

  it('can be instantiated', () => {
    const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
    expect(dataFacade).toBeInstanceOf(DataFacade);
  });

  describe('isDataMockEnabled', () => {
    beforeEach(() => {
      Environment.getEnvironment = mockGetEnvironment;
    });

    it('should be a static method', () => {
      expect(typeof DataFacade.isDataMockEnabled).toBe('function');
    });

    it('should return a boolean', () => {
      const result = DataFacade.isDataMockEnabled();
      expect(typeof result).toBe('boolean');
    });

    it('should return true if MOCK_DATA_ENABLE is true', () => {
      mockGetEnvironment = jest.fn().mockReturnValue({
        APPLICATION_APPLICATION_KEY: 'test-key',
        MOCK_DATA_ENABLE: 'true',
        LOGGING_SEVERITY_LEVEL: 'DEBUG'
      });
      const result = DataFacade.isDataMockEnabled();
      expect(result).toBe(true);
    });

    it('should return false if MOCK_DATA_ENABLE is false', () => {
      mockGetEnvironment = jest.fn().mockReturnValue({
        APPLICATION_APPLICATION_KEY: 'test-key',
        MOCK_DATA_ENABLE: 'false',
        LOGGING_SEVERITY_LEVEL: 'DEBUG'
      });
      const result = DataFacade.isDataMockEnabled();
      expect(result).toBe(false);
    });
  });
});

describe('getData', () => {

  beforeEach(() => {
    DataStorage.mockClear();
    DataCache2.mockClear();
    Environment.mockClear();

    mockCacheGet = jest.fn().mockReturnValue(MOCK_CACHE);
  });

  describe('Basic', () => {
    it('should have a getData method', () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      expect(typeof dataFacade.getData).toBe('function');
    });

    it('getData should have an object parameter', () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      expect(dataFacade.getData.length).toBe(1);
    });

    it('getData should return a Promise if parameter \'returnPromise\' is set to true', () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      const result = dataFacade.getData({ request: {id: '1234'}, returnPromise: true });
      expect(result).toBeInstanceOf(Promise);
    });

    it('getData should return a result object if parameter \'returnPromise\' is not true', () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      const result = dataFacade.getData({request: {id: '1234'} });
      expect(result).toBeTruthy();
    });
  });

  describe('Story', () => {
    it('getData should trigger a query for stories if request.table is \'story\' and no id is given', async () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      mockCacheGet = jest.fn().mockReturnValue(null);
      mockQueryAllStories = jest.fn().mockReturnValue([{id: '1234'}, {id: '5678'}]);

      const result = await dataFacade.getData({ request: { table: 'story' } });
      expect(DataStorage).toHaveBeenCalled();
      expect(mockQueryAllStories).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result).toStrictEqual([{id: '1234'}, {id: '5678'}]);
    });

    it('getData should trigger a query for a story if request.table is \'story\' and an id is given', async () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      mockCacheGet = jest.fn().mockReturnValue(null);
      mockQueryStory = jest.fn().mockReturnValue({id: '1234'});

      const result = await dataFacade.getData({ request: { table: 'story', id: '1234' } });
      expect(DataStorage).toHaveBeenCalled();
      expect(mockQueryStory).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result).toStrictEqual({id: '1234'});
    });
  });

  describe('Chapter', () => {
    /*
    it('should neither call DataCache nor DataStorage if mock data is enabled', async () => {
      MOCK_ENVIRONMENT.MOCK_DATA_ENABLE = 'true';
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);

      const result = await dataFacade.getData({ request: { table: 'chapter', id: '000c00000000000023' } });
      expect(DataCache2).not.toHaveBeenCalled();
      expect(DataStorage).not.toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
    */

    it('should call DataCache and DataStorage if request.table is \'chapter\'', async () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      mockCacheGet = jest.fn().mockReturnValue();

      const result = await dataFacade.getData({ request: { table: 'chapter', id: '000c00000000000023' } });
      expect(DataCache2).toHaveBeenCalled();
      expect(mockCacheGet).toHaveBeenCalledWith('000c00000000000023');
      expect(DataStorage).toHaveBeenCalled();
      expect(mockQueryChapter).toHaveBeenCalledWith('000c00000000000023');
    });

    it('should return cache result if there was a hit', async () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      mockCacheGet = jest.fn().mockReturnValue({id: '000c00000000000023', Name: 'Test Chapter'});

      const result = await dataFacade.getData({ request: { table: 'chapter', id: '000c00000000000023' } });
      expect(DataCache2).toHaveBeenCalled();
      expect(mockCacheGet).toHaveBeenCalledWith('000c00000000000023');
      expect(DataStorage).not.toHaveBeenCalled();
      expect(result.id).toBe('000c00000000000023');
      expect(result.Name).toBe('Test Chapter');
    });

    it('should call DataStorage if there was no hit in cache', async () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      mockCacheGet = jest.fn().mockReturnValue(null);
      mockQueryChapter = jest.fn().mockReturnValue({id: '000c00000000000023', Name: 'Test Chapter'});

      const result = await dataFacade.getData({ request: { table: 'chapter', id: '000c00000000000023' } });
      expect(DataCache2).toHaveBeenCalled();
      expect(mockCacheGet).toHaveBeenCalledWith('000c00000000000023');
      expect(DataStorage).toHaveBeenCalled();
      expect(mockQueryChapter).toHaveBeenCalledWith('000c00000000000023');
      expect(result.id).toBe('000c00000000000023');
      expect(result.Name).toBe('Test Chapter');
    });
  });

  describe('Interaction between Mock, Database and Cache', () => {
    afterEach(() => {
      DataCache2.mockClear();
      Environment.mockClear();
      MOCK_ENVIRONMENT.MOCK_DATA_ENABLE = 'false';
    });

    it('should return a mock configuration object if MOCK_DATA_ENABLE is true', async () => {
      MOCK_ENVIRONMENT.MOCK_DATA_ENABLE = 'true';
      Environment.getEnvironment = mockGetEnvironment;

      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      const result = await dataFacade.getData({ request: { table: 'configuration' } });
      expect(result).toBeTruthy();
    });

    it("should call 'get' from Cache if MOCK_DATA_ENABLE is false", async () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      dataFacade.getData({ request: { table: 'configuration' } }).then(result => {
        expect(mockCacheGet).toHaveBeenCalled();
        expect(result).toStrictEqual(MOCK_CACHE);
      });
    });

    it('should call DataStorage if MOCK_DATA_ENABLE is false and Cache returns nothing', async () => {
      mockCacheGet = jest.fn().mockReturnValue(null);
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);

      dataFacade.getData({ request: { table: 'configuration' } }).then(result => {
        expect(DataCache2).toHaveBeenCalled();
        expect(mockCacheGet).toHaveBeenCalled();

        expect(DataStorage).toHaveBeenCalled();
        expect(mockQueryConfiguration).toHaveBeenCalled();
        expect(result).toStrictEqual(MOCK_DATABASE);
      });
    });

    it('should save the result from DataStorage to Cache', async () => {
      mockCacheGet = jest.fn().mockReturnValue(null);
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);

      dataFacade.getData({ request: { table: 'configuration' } }).then(result => {
        expect(DataCache2).toHaveBeenCalled();
        expect(mockCacheGet).toHaveBeenCalled();

        expect(DataStorage).toHaveBeenCalled();
        expect(mockQueryConfiguration).toHaveBeenCalled();
        expect(mockCacheSet).toHaveBeenCalled();
        expect(result).toStrictEqual(MOCK_DATABASE);
      });
    });
  });
});

describe('updateData', () => {
  let dataFacade;
  let mockEnvironment;
  let mockDataStorage;
  let mockDataCache;
  let mockDataStorageUpdateData;

  beforeEach(() => {
    mockEnvironment = { APPLICATION_APPLICATION_KEY: 'test-key' };

    mockDataStorage = {
      setConditionApplicationKey: jest.fn(),
      updateData: mockDataStorageUpdateData = jest.fn(),
    };

    mockDataCache = {
      set: jest.fn(),
    };

    DataStorage.mockImplementation(() => mockDataStorage);
    DataCache2.mockImplementation(() => mockDataCache);

    dataFacade = new DataFacade(mockEnvironment);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if the object type is invalid', async () => {
    mockDataStorageUpdateData = jest.fn().mockImplementation(() => {
      throw new Error('Invalid object type');
    });
    const invalidData = { object: 'InvalidObject', payload: { id: '1234' } };

    try {
     let result =  await dataFacade.updateData(invalidData);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid object type');
      expect(mockDataCache.set).not.toHaveBeenCalled();
      expect(mockDataStorage.updateData).not.toHaveBeenCalled();
    }
  });

  it('should throw an error if the payload does not have an ID', async () => {
    const invalidData = { object: 'configuration', payload: {} };

    await expect(dataFacade.updateData(invalidData)).rejects.toThrow('Invalid data object: Missing object type or payload ID');
    expect(mockDataStorage.updateData).not.toHaveBeenCalled();
    expect(mockDataCache.set).not.toHaveBeenCalled();
  });

  it('should call DataStorage.updateData and DataCache.set on success', async () => {
    const validData = { object: 'configuration', payload: { id: '1234', key: 'testKey', value: 'testValue' } };
    mockDataStorage.updateData.mockResolvedValue({ id: '1234' });

    await expect(dataFacade.updateData(validData)).resolves.not.toThrow();

    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith('test-key');
    expect(mockDataStorage.updateData).toHaveBeenCalledWith('configuration', validData.payload);
    expect(mockDataCache.set).toHaveBeenCalledWith('1234', validData.payload);
  });

  it('should throw an error if DataStorage.updateData fails', async () => {
    const validData = { object: 'configuration', payload: { id: '1234', key: 'testKey', value: 'testValue' } };
    mockDataStorage.updateData.mockRejectedValue(new Error('Update failed'));

    await expect(dataFacade.updateData(validData)).rejects.toThrow('Update failed');

    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith('test-key');
    expect(mockDataStorage.updateData).toHaveBeenCalledWith('configuration', validData.payload);
    expect(mockDataCache.set).not.toHaveBeenCalled();
  });
});
