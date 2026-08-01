const { Environment } = require('../../../modules/environment.js');
const postgres = require('postgres');
const { PostgresActions } = require('../pgConnector.js');

// jest.mock('../../../modules/environment.js');
// let mockGetEnvironment = jest.fn().mockReturnValue(MOCK_ENVIRONMENT);
// Environment.mockImplementation(() => {
//   return {
//     getEnvironment: mockGetEnvironment
//   };
// });

let mockQueryResult = {
  rows: [
    { id: 1, name: 'test' },
    { id: 2, name: 'test2' },
  ],
};

jest.mock('postgres');
let mockConnect = jest.fn();
let mockUnsafe = jest.fn().mockResolvedValue(mockQueryResult);
let mockEnd = jest.fn();
postgres.mockImplementation(() => {
  return {
    connect: mockConnect,
    unsafe: mockUnsafe,
    end: mockEnd,
  };
});

describe('PostgresActions', () => {
  let MOCK_ENVIRONMENT;
  beforeEach(() => {
    MOCK_ENVIRONMENT = {
      PGHOST: 'localhost',
      PGDATABASE: 'test',
      PGUSER: 'test',
      PGPASSWORD: 'test',
      ENDPOINT_ID: 'test',
      PG_LOCAL_DB: 'true',
    };

    // Environment.mockClear();
    postgres.mockClear();
    mockConnect.mockClear();
    mockUnsafe.mockClear();
    mockEnd.mockClear();
  });

  describe('connect', () => {
    it('should create a new instance of PostgresActions', () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      expect(postgresActions).toBeInstanceOf(PostgresActions);
    });

    it('should call the postgres connect method', () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      expect(postgres).toHaveBeenCalled();
      expect(postgres).toHaveBeenCalledWith({
        host: MOCK_ENVIRONMENT.PGHOST,
        database: MOCK_ENVIRONMENT.PGDATABASE,
        username: MOCK_ENVIRONMENT.PGUSER,
        password: MOCK_ENVIRONMENT.PGPASSWORD,
        port: 5432,
      });
    });

    it('should call the postgres unsafe method', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      await postgresActions.executeSql('SELECT * FROM test');
      expect(mockUnsafe).toHaveBeenCalled();
    });

    it('should call the postgres end method', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      await postgresActions.executeSql('SELECT * FROM test', {
        closeConnection: true,
      });
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('executeParameterizedSql', () => {
    it('bindet die Parameter, statt sie in den String zu setzen', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      const TEST_SQL = 'SELECT * FROM app WHERE name = $1';

      const result = await postgresActions.executeParameterizedSql(TEST_SQL, [
        'testApp',
      ]);

      expect(mockUnsafe).toHaveBeenCalledWith(TEST_SQL, ['testApp']);
      expect(result).toStrictEqual(mockQueryResult);
    });

    it('kommt ohne Parameter aus', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);

      await postgresActions.executeParameterizedSql('SELECT 1');

      expect(mockUnsafe).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('lässt die Verbindung standardmäßig offen', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);

      await postgresActions.executeParameterizedSql('SELECT 1');

      expect(mockEnd).not.toHaveBeenCalled();
    });

    it('schließt die Verbindung nur auf Anforderung', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);

      await postgresActions.executeParameterizedSql('SELECT 1', [], {
        closeConnection: true,
      });

      expect(mockEnd).toHaveBeenCalled();
    });

    it('schließt die Verbindung auch, wenn das Statement scheitert', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      mockUnsafe.mockRejectedValueOnce(new Error('syntax error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        postgresActions.executeParameterizedSql('SELECT', [], {
          closeConnection: true,
        })
      ).rejects.toThrow('syntax error');
      expect(mockEnd).toHaveBeenCalled();

      console.error.mockRestore();
    });
  });

  describe('executeSql', () => {
    it('should return a Promise', () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      expect(postgresActions.executeSql('SELECT * FROM test')).toBeInstanceOf(
        Promise
      );
    });

    it('should execute the SQL statement', async () => {
      const postgresActions = new PostgresActions(MOCK_ENVIRONMENT);
      const TEST_SQL = 'SELECT * FROM test';

      postgresActions.executeSql(TEST_SQL).then((result) => {
        expect(mockUnsafe).toHaveBeenCalledWith(TEST_SQL, undefined);
        expect(result).toBeTruthy();
        expect(result).toStrictEqual(mockQueryResult);
      });
    });
  });
});
