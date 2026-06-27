const { DataFacade } = require('../DataFacade.js');
const { Environment } = require('../../modules/environment.js');
const { PostgresActions } = require('../DataStorage/pgConnector.js');

// Integration test (least mocking): real DataFacade + real DataStorage + real
// ActionGet. Only the external I/O boundary (pgConnector) and the environment
// lookup are mocked.
//
// Reproduces the production crash: ActionGet executes every query with
// `closeConnection: true`, so the pgConnector ends its connection after the
// first query. buildContentsTree fired a second query (queryAllChapters) on the
// SAME DataStorage/pgConnector, which then wrote to an already-ended connection
// → `write CONNECTION_ENDED localhost:5432`.

jest.mock('../../modules/environment.js');
jest.mock('../DataStorage/pgConnector.js');

const MOCK_ENVIRONMENT = {
  APPLICATION_APPLICATION_KEY: 'test-key',
  MOCK_DATA_ENABLE: 'false',
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
};

Environment.mockImplementation(() => ({
  getEnvironment: () => MOCK_ENVIRONMENT,
}));

let connectorInstances;

beforeEach(() => {
  connectorInstances = [];

  // Each PostgresActions instance has its own connection lifecycle. A query with
  // `closeConnection: true` ends THIS instance's connection; any further query on
  // the same instance rejects with CONNECTION_ENDED — mirroring `postgres`'
  // behaviour after `sql.end()`.
  PostgresActions.mockImplementation(() => {
    const instance = {
      ended: false,
      executeSql: jest.fn(async (sqlStatement, options) => {
        if (instance.ended) {
          const error = new Error('write CONNECTION_ENDED localhost:5432');
          error.code = 'CONNECTION_ENDED';
          throw error;
        }
        const rows = sqlStatement.includes('FROM Chapter')
          ? [{ id: 'c1', storyid: 's1', name: 'Chapter 1', sortnumber: 1 }]
          : [{ id: 's1', name: 'Story 1', sortnumber: 1 }];
        if (options?.closeConnection) {
          instance.ended = true;
        }
        return rows;
      }),
    };
    connectorInstances.push(instance);
    return instance;
  });
});

describe('DataFacade.buildContentsTree — connection lifecycle', () => {
  it('builds the tree without reusing an already-closed connection', async () => {
    const dataFacade = new DataFacade(MOCK_ENVIRONMENT);

    const tree = await dataFacade
      .setSkipCache(true)
      .getData({ request: { table: 'contents', id: null } });

    // both levels were queried and assembled
    expect(tree.map((story) => story.id)).toEqual(['s1']);
    expect(tree[0].chapters.map((chapter) => chapter.id)).toEqual(['c1']);
  });

  it('does not run the second query on a connection that the first one closed', async () => {
    const dataFacade = new DataFacade(MOCK_ENVIRONMENT);

    await dataFacade
      .setSkipCache(true)
      .getData({ request: { table: 'contents', id: null } });

    // each query gets its own fresh connection (no reuse of a closed one)
    const queriesRun = connectorInstances.reduce(
      (sum, instance) => sum + instance.executeSql.mock.calls.length,
      0
    );
    expect(queriesRun).toBe(2);
    expect(connectorInstances.length).toBeGreaterThanOrEqual(2);
  });
});
