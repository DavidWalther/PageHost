const { PostgresActions } = require('../pgConnector.js');
const { ActionGet } = require('../actions/get.js');
const ActionUpdate = require('../actions/update.js'); // Mock ActionUpdate
const { DataStorage } = require('../DataStorage.js');
const { DataCleaner } = require('../../../modules/DataCleaner.js');

jest.mock('../../../modules/logging');
jest.mock('../pgConnector.js');
jest.mock('../actions/get.js');
jest.mock('../actions/update.js'); // Mock ActionUpdate

const MOCK_ENVIRONMENT = {
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  PGHOST: 'localhost',
  PGDATABASE: 'test',
  PGUSER: 'testUser',
  PGPASSWORD: 'testPassword',
  ENDPOINT_ID: 'testEndpoint',
  PG_LOCAL_DB: 'true',
};

const MOCK_CONFIGURATION = [
  { key: 'firstname', value: 'Tom' },
  { key: 'lastname', value: 'Jones' },
];

// ----- Mock PostgresActions -----
let mockExecuteSql = jest.fn().mockResolvedValue();
PostgresActions.mockImplementation(() => {
  return {
    executeSql: mockExecuteSql,
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue([]),
  };
});

// ----- Mock ActionGet -----
let mockActionGetExecute = jest.fn().mockResolvedValue([
  {
    story_id: 1337,
    story_name: 'Test Story',
    chapter_name: 'Test Chapter',
    chapter_id: 1,
  },
  {
    story_id: 1337,
    story_name: 'Test Story',
    chapter_name: 'Test Chapter',
    chapter_id: 2,
  },
]);
let mockActionConditionApplicationKey = jest.fn().mockReturnThis();
let mockActionConditionEquals = jest.fn().mockReturnThis();
let mockActionCustomConditions = jest.fn().mockReturnThis();
ActionGet.mockImplementation(() => {
  return {
    execute: mockActionGetExecute,
    setPgConnector: jest.fn().mockReturnThis(),
    setTableName: jest.fn().mockReturnThis(),
    setTableFields: jest.fn().mockReturnThis(),
    setConditionEquals: mockActionConditionEquals,
    setCustomConditions: mockActionCustomConditions,
    setConditionApplicationKey: mockActionConditionApplicationKey,
  };
});

describe('DataStorage', () => {
  let dataStorage;
  let dataCleanerSpy;

  beforeEach(() => {
    dataCleanerSpy = jest.spyOn(DataCleaner.prototype, 'removeApplicationKeys');
    PostgresActions.mockClear();
    ActionGet.mockClear();
    mockActionCustomConditions.mockClear();
    dataStorage = new DataStorage(MOCK_ENVIRONMENT);
    process.env = MOCK_ENVIRONMENT;
  });

  afterEach(() => {
    dataCleanerSpy.mockRestore();
  });

  describe('Basic methods', () => {
    it('constructor should call PostgresActions constructor', () => {
      dataStorage = new DataStorage(MOCK_ENVIRONMENT);
      expect(PostgresActions).toHaveBeenCalled();
    });
  });

  describe('Queries', () => {
    it('queryConfiguration should call ActionGet', async () => {
      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryConfiguration();

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith(
          'testApplication'
        );
        expect(result).toBeTruthy();
      });
    });

    it('queryConfiguration should create nested objects for keys with dots', async () => {
      const nestedConfiguration = [
        { key: 'parent.child1', value: 'value1' },
        { key: 'parent.child2', value: 'value2' },
        { key: 'singleLevel', value: 'singleValue' },
      ];
      mockActionGetExecute.mockResolvedValue(nestedConfiguration);

      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryConfiguration();

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith(
          'testApplication'
        );
        expect(result).toBeTruthy();
        expect(result.parent).toBeTruthy();
        expect(result.parent.child1).toBe('value1');
        expect(result.parent.child2).toBe('value2');
        expect(result.singleLevel).toBe('singleValue');
      });
    });

    it('queryIdentityByKey should call ActionGet with custom conditions and DataCleaner', async () => {
      mockActionGetExecute.mockResolvedValue([
        {
          id: '000i123',
          key: 'user@example.com',
          active: true,
          recordnumber: 1,
          createddate: '2023-01-01',
        },
      ]);

      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryIdentityByKey('user@example.com');

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        // Der Anmeldeschlüssel kommt vom Identity Provider und ist damit
        // fremder Eingabe. Er geht gebunden in die Abfrage, nicht in den Text.
        expect(mockActionConditionEquals).toHaveBeenCalledWith(
          'key',
          'user@example.com'
        );
        expect(mockActionCustomConditions).toHaveBeenCalledTimes(1);
        expect(mockActionCustomConditions).toHaveBeenCalledWith(
          'active = true'
        );
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith(
          'testApplication'
        );
        expect(dataCleanerSpy).toHaveBeenCalled();
        expect(result).toBeTruthy();
        expect(result.id).toBe('000i123');
        expect(result.key).toBe('user@example.com');
        expect(result.active).toBe(true);
      });
    });

    it('queryIdentityByKey should return empty object when no identity found', async () => {
      mockActionGetExecute.mockResolvedValue([]);

      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryIdentityByKey(
        'nonexistent@example.com'
      );

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionEquals).toHaveBeenCalledWith(
          'key',
          'nonexistent@example.com'
        );
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith(
          'testApplication'
        );
        expect(result).toEqual({});
      });
    });
  });

  describe('Query error propagation', () => {
    // A failing query (e.g. CONNECTION_ENDED) must reject so the caller can
    // handle it, instead of being swallowed into a never-settling promise that
    // surfaces as an unhandled rejection and crashes the process.
    const connectionError = Object.assign(
      new Error('write CONNECTION_ENDED localhost:5432'),
      { code: 'CONNECTION_ENDED' }
    );
  });

  describe('Updates', () => {
    let mockActionUpdateExecute;

    beforeEach(() => {
      ActionUpdate.mockImplementation(() => {
        return {
          setPgConnector: jest.fn().mockReturnThis(),
          setTable: jest.fn().mockReturnThis(),
          setValues: jest.fn().mockReturnThis(),
          execute: mockActionUpdateExecute,
        };
      });
    });

    it('should successfully update a record', async () => {
      mockActionUpdateExecute = jest.fn().mockResolvedValue([{ id: '1234' }]);

      const dataStorage = new DataStorage(MOCK_ENVIRONMENT);
      const mockPayload = { id: '1234', key: 'testKey', value: 'testValue' };

      dataStorage.updateData('identity', mockPayload).then((result) => {
        expect(ActionUpdate).toHaveBeenCalled();
        expect(mockActionUpdateExecute).toHaveBeenCalled();
        expect(result).toEqual({ id: '1234' });
      });
    });

    it('should throw an error if the update fails', async () => {
      mockActionUpdateExecute.mockRejectedValue(new Error('Update failed'));

      const dataStorage = new DataStorage(MOCK_ENVIRONMENT);
      const mockPayload = { id: '1234', key: 'testKey', value: 'testValue' };

      dataStorage.updateData('identity', mockPayload).catch((error) => {
        expect(ActionUpdate).toHaveBeenCalled();
        expect(mockActionUpdateExecute).toHaveBeenCalled();
        expect(error.message).toBe('Update failed');
      });
    });
  });
});
