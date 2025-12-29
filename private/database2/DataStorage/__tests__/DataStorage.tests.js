const { PostgresActions } = require('../pgConnector.js');
const { ActionGet } = require('../actions/get.js');
const ActionUpdate  = require('../actions/update.js'); // Mock ActionUpdate
const { DataStorage } = require('../DataStorage.js');
const { DataCleaner } = require('../../../modules/DataCleaner.js');

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
  PG_LOCAL_DB: 'true'
};

const MOCK_CONFIGURATION = [{ key: 'firstname', value: 'Tom'}, { key: 'lastname', value: 'Jones'}];

// ----- Mock PostgresActions -----
let mockExecuteSql = jest.fn().mockResolvedValue();
PostgresActions.mockImplementation(() => {
  return {
    executeSql: mockExecuteSql,
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue([])
  };
});

// ----- Mock ActionGet -----
let mockActionGetExecute = jest.fn().mockResolvedValue([
    { story_id: 1337, story_name: 'Test Story', chapter_name: 'Test Chapter', chapter_id: 1 },
    { story_id: 1337, story_name: 'Test Story', chapter_name: 'Test Chapter', chapter_id: 2 }
  ]);
let mockActionConditionId = jest.fn().mockReturnThis();
let mockActionConditionApplicationKey = jest.fn().mockReturnThis();
let mockActionConditionPublishDate = jest.fn().mockReturnThis();
let mockActionConditions = jest.fn().mockReturnThis();
let mockActionOrderDirection = jest.fn().mockReturnThis();
let mockActionRightTableSortField = jest.fn().mockReturnThis();
let mockActionRightTableSortDirection = jest.fn().mockReturnThis();
ActionGet.mockImplementation(() => {
  return {
    execute: mockActionGetExecute,
    setPgConnector: jest.fn().mockReturnThis(),
    setTableName: jest.fn().mockReturnThis(),
    setTableFields: jest.fn().mockReturnThis(),
    setTable: jest.fn().mockReturnThis(),
    setRightTable: jest.fn().mockReturnThis(),
    setRightOrderField: mockActionRightTableSortField,
    setRightOrderDirection: mockActionRightTableSortDirection,
    setConditionId: mockActionConditionId,
    setConditionPublishDate: mockActionConditionPublishDate,
    setConditions: mockActionConditions,
    setOrderDirection: mockActionOrderDirection,
    setConditionApplicationKey: mockActionConditionApplicationKey,
    setLeftJoin: jest.fn().mockReturnThis()
  };
});

describe('DataStorage', () => {
  let dataStorage;
  let dataCleanerSpy;

  beforeEach(() => {
      dataCleanerSpy = jest.spyOn(DataCleaner.prototype, 'removeApplicationKeys');
      PostgresActions.mockClear();
      ActionGet.mockClear();
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
    it('queryParagraphs should call ActionGet and DataCleaner', async () => {
      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryParagraphs('testParagraphId');

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionId).toHaveBeenCalledWith('testParagraphId');
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
        expect(result).toBeTruthy();
        expect(dataCleanerSpy).toHaveBeenCalled();
      });
    });

    it('queryConfiguration should call ActionGet', async () => {
      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryConfiguration();

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
        expect(result).toBeTruthy();
      });
    });

    it('queryAllStories should call ActionGet and DataCleaner', async () => {
      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryAllStories();

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
        expect(result).toBeTruthy();
      });
    });

    it('queryStory should call ActionGet and DataCleaner', async () => {
      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryStory('testId');

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionId).toHaveBeenCalledWith('testId');
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
        expect(mockActionConditionPublishDate).toHaveBeenCalledWith(new Date().toISOString().split('T')[0]);
        expect(mockActionRightTableSortField).toHaveBeenCalledWith('SortNumber');
        expect(mockActionRightTableSortDirection).toHaveBeenCalledWith('ASC');
        expect(dataCleanerSpy).toHaveBeenCalled();
        expect(result).toBeTruthy();
        expect(result.id).toBe(1337);
        expect(result.name).toBe('Test Story');
        expect(result.chapters).toHaveLength(2);
        expect(result.chapters[0].name).toBe('Test Chapter');
        expect(result.chapters[0].id).toBe(1);
        expect(result.chapters[1].name).toBe('Test Chapter');
        expect(result.chapters[1].id).toBe(2);
      });
    });

    it('queryChapter should return a chapter record with its child paragraphs and call DataCleaner', async () => {
      mockActionGetExecute.mockResolvedValue([
        { chapter_id: 1, chapter_name: 'Test Chapter', paragraph_id: 1, paragraph_content: 'Test Paragraph 1' },
        { chapter_id: 1, chapter_name: 'Test Chapter', paragraph_id: 2, paragraph_content: 'Test Paragraph 2' }
      ]);

      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryChapter('testChapterId');

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionId).toHaveBeenCalledWith('testChapterId');
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
        expect(mockActionConditionPublishDate).toHaveBeenCalledWith(new Date().toISOString().split('T')[0]);
        expect(mockActionRightTableSortField).toHaveBeenCalledWith('SortNumber');
        expect(mockActionRightTableSortDirection).toHaveBeenCalledWith('ASC');
        expect(dataCleanerSpy).toHaveBeenCalled();
        expect(result).toBeTruthy();
        expect(result.id).toBe(1);
        expect(result.name).toBe('Test Chapter');
        expect(result.paragraphs).toHaveLength(2);
        expect(result.paragraphs[0].id).toBe(1);
        expect(result.paragraphs[0].content).toBe('Test Paragraph 1');
        expect(result.paragraphs[1].id).toBe(2);
        expect(result.paragraphs[1].content).toBe('Test Paragraph 2');
      });
    });

    it('queryConfiguration should create nested objects for keys with dots', async () => {
      const nestedConfiguration = [
        { key: 'parent.child1', value: 'value1' },
        { key: 'parent.child2', value: 'value2' },
        { key: 'singleLevel', value: 'singleValue' }
      ];
      mockActionGetExecute.mockResolvedValue(nestedConfiguration);

      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryConfiguration();

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
        expect(result).toBeTruthy();
        expect(result.parent).toBeTruthy();
        expect(result.parent.child1).toBe('value1');
        expect(result.parent.child2).toBe('value2');
        expect(result.singleLevel).toBe('singleValue');
      });
    });

    it('queryIdentityByKey should call ActionGet with custom conditions and DataCleaner', async () => {
      mockActionGetExecute.mockResolvedValue([
        { id: '000i123', key: 'user@example.com', active: true, recordnumber: 1, createddate: '2023-01-01' }
      ]);

      dataStorage.setConditionApplicationKey('testApplication');
      let queryPromise = dataStorage.queryIdentityByKey('user@example.com');

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditions).toHaveBeenCalledWith(["key = 'user@example.com'", "active = true"]);
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
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
      let queryPromise = dataStorage.queryIdentityByKey('nonexistent@example.com');

      expect(dataStorage).toBeInstanceOf(DataStorage);
      expect(queryPromise).toBeInstanceOf(Promise);
      queryPromise.then((result) => {
        expect(ActionGet).toHaveBeenCalled();
        expect(mockActionConditions).toHaveBeenCalledWith(["key = 'nonexistent@example.com'", "active = true"]);
        expect(mockActionConditionApplicationKey).toHaveBeenCalledWith('testApplication');
        expect(result).toEqual({});
      });
    });
  });

  describe('Updates', () => {
    let mockActionUpdateExecute;

    beforeEach(() => {
      ActionUpdate.mockImplementation(() => {
        return {
          setPgConnector: jest.fn().mockReturnThis(),
          setTable: jest.fn().mockReturnThis(),
          setValues: jest.fn().mockReturnThis(),
          execute: mockActionUpdateExecute
        };
      });
    });

    it('should successfully update a record', async () => {
      mockActionUpdateExecute = jest.fn().mockResolvedValue([{ id: '1234' }]);

      const dataStorage = new DataStorage(MOCK_ENVIRONMENT);
      const mockPayload = { id: '1234', key: 'testKey', value: 'testValue' };

      dataStorage.updateData('paragraph', mockPayload)
      .then((result) => {
        expect(ActionUpdate).toHaveBeenCalled();
        expect(mockActionUpdateExecute).toHaveBeenCalled();
        expect(result).toEqual({ id: '1234' });
      });
    });

    it('should throw an error if the update fails', async () => {
      mockActionUpdateExecute.mockRejectedValue(new Error('Update failed'));

      const dataStorage = new DataStorage(MOCK_ENVIRONMENT);
      const mockPayload = { id: '1234', key: 'testKey', value: 'testValue' };

      dataStorage.updateData('paragraph', mockPayload)
      .catch((error) => {
        expect(ActionUpdate).toHaveBeenCalled();
        expect(mockActionUpdateExecute).toHaveBeenCalled();
        expect(error.message).toBe('Update failed');
      });
    });
  });
});
