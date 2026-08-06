const { DataFacade } = require('../DataFacade.js');
const { Environment } = require('../../modules/environment.js');
const { DataCache2 } = require('../DataCache/DataCache.js');
const { DataStorage } = require('../DataStorage/DataStorage.js');

// Diese Suite prüft, was die Facade **neben** den Inhalten tut: Konfiguration,
// Identity und die Schreibwege. Die Inhalte laufen über das
// `NodeContentRepository` und sind in `typeFreeReadPath.tests.js` sowie
// `private/__tests__/readPathIntegration.tests.js` abgedeckt.
const MOCK_ENVIRONMENT = {
  APPLICATION_APPLICATION_KEY: 'test-key',
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  REDIS_PASSWORD: 'test-password',
  REDIS_HOST: 'test-host',
  REDIS_PORT: 'test-port',
};
const MOCK_CACHE = {
  metaTitle: 'Mock Tabtitle',
  pageHeaderHeadline: 'Mock Headline',
};

const MOCK_DATABASE = {
  rows: [
    { key: 'metaTitle', value: 'Mock Tabtitle' },
    { key: 'pageHeaderHeadline', value: 'Mock Headline' },
  ],
};

// ---- Environment.js mock ----
jest.mock('../../modules/logging');
jest.mock('../../modules/environment.js');
let mockGetEnvironment = jest.fn().mockReturnValue(MOCK_ENVIRONMENT);
Environment.mockImplementation(() => {
  return {
    getEnvironment: mockGetEnvironment,
  };
});

// ---- DataCache.js mock ----
jest.mock('../DataCache/DataCache.js');
let mockCacheGet = jest.fn().mockReturnValue(MOCK_CACHE);
let mockCacheSet = jest.fn();
DataCache2.mockImplementation(() => {
  return {
    get: mockCacheGet,
    set: mockCacheSet,
  };
});

// ---- DataStorage.js mock ----
jest.mock('../DataStorage/DataStorage.js');
let mockQueryConfiguration = jest.fn().mockReturnValue(MOCK_DATABASE);
let mockQueryIdentityByKey = jest.fn().mockReturnValue();
let setConditionApplicationKey = jest.fn();
let setConditionPublishDate = jest.fn();
DataStorage.mockImplementation(() => {
  return {
    setConditionPublishDate: setConditionPublishDate,
    setConditionApplicationKey: setConditionApplicationKey,
    queryConfiguration: mockQueryConfiguration,
    queryIdentityByKey: mockQueryIdentityByKey,
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

    it("getData should return a Promise if parameter 'returnPromise' is set to true", () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      const result = dataFacade.getData({
        request: { id: '1234' },
        returnPromise: true,
      });
      expect(result).toBeInstanceOf(Promise);
    });

    it("getData should return a result object if parameter 'returnPromise' is not true", () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      const result = dataFacade.getData({ request: { id: '1234' } });
      expect(result).toBeTruthy();
    });
  });

  describe('Interaction between Database and Cache', () => {
    afterEach(() => {
      DataCache2.mockClear();
      Environment.mockClear();
    });

    it("should call 'get' from Cache", async () => {
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
      dataFacade
        .getData({ request: { table: 'configuration' } })
        .then((result) => {
          expect(mockCacheGet).toHaveBeenCalled();
          expect(result).toStrictEqual(MOCK_CACHE);
        });
    });

    it('should call DataStorage if Cache returns nothing', async () => {
      mockCacheGet = jest.fn().mockReturnValue(null);
      const dataFacade = new DataFacade(MOCK_ENVIRONMENT);

      dataFacade
        .getData({ request: { table: 'configuration' } })
        .then((result) => {
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

      dataFacade
        .getData({ request: { table: 'configuration' } })
        .then((result) => {
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

describe('getData with specific scopes', () => {
  beforeEach(() => {
    DataStorage.mockClear();
    DataCache2.mockClear();
    mockCacheGet = jest.fn();
    mockQueryIdentityByKey = jest.fn();
    setConditionPublishDate.mockClear();
    setConditionApplicationKey.mockClear();
  });

  describe('skipping cache', () => {
    describe('Identity', () => {
      it('should always bypass cache when querying identity', async () => {
        const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
        mockQueryIdentityByKey.mockReturnValue({
          id: '000i123',
          key: 'user@example.com',
          active: true,
        });

        await dataFacade.getData({
          request: { table: 'identity', key: 'user@example.com' },
        });

        expect(mockCacheGet).not.toHaveBeenCalled();
        expect(DataStorage).toHaveBeenCalled();
        expect(mockQueryIdentityByKey).toHaveBeenCalledWith('user@example.com');
      });

      it('should return identity data directly from database', async () => {
        const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
        mockQueryIdentityByKey.mockReturnValue({
          id: '000i123',
          key: 'user@example.com',
          active: true,
          recordnumber: 1,
        });

        const result = await dataFacade.getData({
          request: { table: 'identity', key: 'user@example.com' },
        });

        expect(mockCacheGet).not.toHaveBeenCalled();
        expect(DataStorage).toHaveBeenCalled();
        expect(mockQueryIdentityByKey).toHaveBeenCalledWith('user@example.com');
        expect(setConditionApplicationKey).toHaveBeenCalledWith('test-key');
        expect(result.id).toBe('000i123');
        expect(result.key).toBe('user@example.com');
        expect(result.active).toBe(true);
      });

      it('should return empty object when identity not found', async () => {
        const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
        mockQueryIdentityByKey.mockReturnValue({});

        const result = await dataFacade.getData({
          request: { table: 'identity', key: 'nonexistent@example.com' },
        });

        expect(mockCacheGet).not.toHaveBeenCalled();
        expect(DataStorage).toHaveBeenCalled();
        expect(mockQueryIdentityByKey).toHaveBeenCalledWith(
          'nonexistent@example.com'
        );
        expect(result).toEqual({});
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
    // Schreibpfad ueber den DataStorage-Seam: nur die alte Quelle. Die neue
    // schreibt in node / content_node / content_item und wird in
    // nodeWritePath.tests.js geprueft.
    mockEnvironment = {
      APPLICATION_APPLICATION_KEY: 'test-key',
    };

    mockDataStorage = {
      setConditionApplicationKey: jest.fn(),
      updateData: (mockDataStorageUpdateData = jest.fn()),
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
      let result = await dataFacade.updateData(invalidData);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid object type');
      expect(mockDataCache.set).not.toHaveBeenCalled();
      expect(mockDataStorage.updateData).not.toHaveBeenCalled();
    }
  });

  it('should throw an error if the payload does not have an ID', async () => {
    const invalidData = { object: 'configuration', payload: {} };

    await expect(dataFacade.updateData(invalidData)).rejects.toThrow(
      'Invalid data object: Missing object type or payload ID'
    );
    expect(mockDataStorage.updateData).not.toHaveBeenCalled();
    expect(mockDataCache.set).not.toHaveBeenCalled();
  });

  it('should call DataStorage.updateData and DataCache.set on success', async () => {
    const validData = {
      object: 'configuration',
      payload: { id: '1234', key: 'testKey', value: 'testValue' },
    };
    mockDataStorage.updateData.mockResolvedValue({ id: '1234' });

    await expect(dataFacade.updateData(validData)).resolves.not.toThrow();

    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith(
      'test-key'
    );
    expect(mockDataStorage.updateData).toHaveBeenCalledWith(
      'configuration',
      validData.payload
    );
    expect(mockDataCache.set).toHaveBeenCalledWith('1234', validData.payload);
  });

  it('should throw an error if DataStorage.updateData fails', async () => {
    const validData = {
      object: 'configuration',
      payload: { id: '1234', key: 'testKey', value: 'testValue' },
    };
    mockDataStorage.updateData.mockRejectedValue(new Error('Update failed'));

    await expect(dataFacade.updateData(validData)).rejects.toThrow(
      'Update failed'
    );

    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith(
      'test-key'
    );
    expect(mockDataStorage.updateData).toHaveBeenCalledWith(
      'configuration',
      validData.payload
    );
    expect(mockDataCache.set).not.toHaveBeenCalled();
  });

  it('should skip writing to cache when skipCache is true', async () => {
    const validData = {
      object: 'configuration',
      payload: { id: '1234', key: 'testKey', value: 'testValue' },
    };
    const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
    dataFacade.setSkipCache(true);

    await expect(dataFacade.updateData(validData)).resolves.not.toThrow();

    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith(
      'test-key'
    );
    expect(mockDataStorage.updateData).toHaveBeenCalledWith(
      'configuration',
      validData.payload
    );
    expect(mockDataCache.set).not.toHaveBeenCalled();
  });

  it('should write to cache when skipCache is false', async () => {
    const validData = {
      object: 'configuration',
      payload: { id: '1234', key: 'testKey', value: 'testValue' },
    };
    const dataFacade = new DataFacade(MOCK_ENVIRONMENT);
    dataFacade.setSkipCache(false);

    await expect(dataFacade.updateData(validData)).resolves.not.toThrow();

    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith(
      'test-key'
    );
    expect(mockDataStorage.updateData).toHaveBeenCalledWith(
      'configuration',
      validData.payload
    );
    expect(mockDataCache.set).toHaveBeenCalledWith('1234', validData.payload);
  });
});

describe('createData', () => {
  let dataFacade;
  let mockEnvironment;
  let mockDataStorage;
  let mockCreateRecord;

  beforeEach(() => {
    // Schreibpfad ueber den DataStorage-Seam: nur die alte Quelle. Die neue
    // schreibt in node / content_node / content_item und wird in
    // nodeWritePath.tests.js geprueft.
    mockEnvironment = {
      APPLICATION_APPLICATION_KEY: 'test-key',
    };
    mockCreateRecord = jest.fn();
    mockDataStorage = {
      setConditionApplicationKey: jest.fn(),
      createRecord: mockCreateRecord,
    };
    DataStorage.mockImplementation(() => mockDataStorage);
    dataFacade = new DataFacade(mockEnvironment);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if the object type is invalid', async () => {
    const invalidData = {
      object: 'InvalidObject',
      payload: { key: 'testKey', value: 'testValue' },
    };
    mockCreateRecord.mockImplementation(() => {
      throw new Error('Invalid table name: InvalidObject');
    });
    await expect(dataFacade.createData(invalidData)).rejects.toThrow(
      'Invalid table name: InvalidObject'
    );
    expect(mockDataStorage.createRecord).not.toHaveBeenCalledWith(
      undefined,
      invalidData.payload
    );
  });

  it('should throw an error if the payload is missing', async () => {
    const invalidData = { object: 'configuration' };
    await expect(dataFacade.createData(invalidData)).rejects.toThrow(
      'Invalid data object: Missing object type or payload'
    );
    expect(mockDataStorage.createRecord).not.toHaveBeenCalled();
  });

  it('should call DataStorage.createRecord on success', async () => {
    const validData = {
      object: 'configuration',
      payload: { key: 'testKey', value: 'testValue' },
    };
    mockCreateRecord.mockResolvedValue({
      id: '1234',
      key: 'testKey',
      value: 'testValue',
    });
    await expect(dataFacade.createData(validData)).resolves.toEqual({
      id: '1234',
      key: 'testKey',
      value: 'testValue',
    });
    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith(
      'test-key'
    );
    expect(mockDataStorage.createRecord).toHaveBeenCalled();
  });

  it('should throw an error if DataStorage.createRecord fails', async () => {
    const validData = {
      object: 'configuration',
      payload: { key: 'testKey', value: 'testValue' },
    };
    mockCreateRecord.mockRejectedValue(new Error('Create failed'));
    await expect(dataFacade.createData(validData)).rejects.toThrow(
      'Create failed'
    );
    expect(mockDataStorage.setConditionApplicationKey).toHaveBeenCalledWith(
      'test-key'
    );
    expect(mockDataStorage.createRecord).toHaveBeenCalled();
  });

  it('should always skip cache when creating a record', async () => {
    const validData = {
      object: 'configuration',
      payload: { key: 'testKey', value: 'testValue' },
    };
    mockCreateRecord.mockResolvedValue({
      id: '1234',
      key: 'testKey',
      value: 'testValue',
    });
    dataFacade.setSkipCache(false); // Should be ignored for create
    await expect(dataFacade.createData(validData)).resolves.toEqual({
      id: '1234',
      key: 'testKey',
      value: 'testValue',
    });
    // No cache set or get should be called
    expect(mockDataStorage.createRecord).toHaveBeenCalled();
  });
});
