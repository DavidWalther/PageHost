const { ActionCreate } = require('../actions/create.js');
const { PostgresActions } = require('../pgConnector.js');
const { TableParagraph } = require('../../tables/paragraph.js');

jest.mock('../pgConnector.js');

const MOCK_ENVIRONMENT = {
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  PGHOST: 'localhost',
  PGDATABASE: 'test',
  PGUSER: 'testUser',
  PGPASSWORD: 'testPassword',
  ENDPOINT_ID: 'testEndpoint',
  PG_LOCAL_DB: 'true'
};

let mockExecuteSql = jest.fn().mockResolvedValue();
PostgresActions.mockImplementation(() => {
  return {
    executeSql: mockExecuteSql,
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue([])
  };
});

describe('SQL-Actions', () => {
  beforeEach(() => {
    process.env = MOCK_ENVIRONMENT;
    PostgresActions.mockClear();
    mockExecuteSql.mockClear();
  });

  describe('create', () => {
    it('should create a proper SQL insert statement', () => {
      mockExecuteSql = jest.fn().mockResolvedValue([{ Id: 1337, Name: 'TestName', Content: 'TestContent' }]);
      const actionCreate = new ActionCreate();
      actionCreate.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionCreate.setTable(new TableParagraph());
      actionCreate.setValue('Id', 1337);
      actionCreate.setValue('Name', 'TestName');
      actionCreate.setValue('Content', 'TestContent');
      let resultPromise = actionCreate.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      expect(mockExecuteSql).toHaveBeenCalled();
      expect(mockExecuteSql.mock.calls[0][0]).toEqual("INSERT INTO Paragraph (Id, Name, Content) VALUES (1337, 'TestName', 'TestContent') RETURNING Id;");
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('should handle null values correctly', () => {
      mockExecuteSql = jest.fn().mockResolvedValue([{ Id: 1337, Name: 'TestName', Content: null }]);
      const actionCreate = new ActionCreate();
      actionCreate.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionCreate.setTable(new TableParagraph());
      actionCreate.setValue('Id', 1337);
      actionCreate.setValue('Name', 'TestName');
      actionCreate.setValue('Content', null);
      let resultPromise = actionCreate.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      expect(mockExecuteSql).toHaveBeenCalled();
      expect(mockExecuteSql.mock.calls[0][0]).toEqual("INSERT INTO Paragraph (Id, Name, Content) VALUES (1337, 'TestName', null) RETURNING Id;");
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });
  });
});
