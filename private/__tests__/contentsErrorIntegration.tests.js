/**
 * Integration tests: the contents endpoint when the data layer fails.
 *
 * Endpoint, `DataFacade` and `NodeContentRepository` run for real; only
 * external I/O is mocked (`pgConnector`, `DataCache2`, logging).
 *
 * A failing query must reach the client as an error — status 500 and a JSON
 * body — not as a page: before, the route answered with `index.html` and
 * status 200, and the navigation could not tell that apart from a tree.
 */

jest.mock('../database2/DataStorage/pgConnector.js');
jest.mock('../database2/DataCache/DataCache.js');
jest.mock('../modules/logging');

const { PostgresActions } = require('../database2/DataStorage/pgConnector.js');
const { DataCache2 } = require('../database2/DataCache/DataCache.js');
const ContentsEndpoint = require('../endpoints/api/1.0/contents/ContentsEndpoint');

const ENVIRONMENT = Object.freeze({
  APPLICATION_APPLICATION_KEY: 'nodeApp',
  CACHE_KEY_PREFIX: 'TEST',
  CACHE_DATA_INCREMENT: '1',
  CACHE_CONTAINER_EXPIRATION_SECONDS: 60,
});

/** A response object that records status and body, chainable like Express. */
function createResponseObject() {
  const responseObject = {
    statusCode: 200,
    body: undefined,
    status: jest.fn((code) => {
      responseObject.statusCode = code;
      return responseObject;
    }),
    json: jest.fn((body) => {
      responseObject.body = body;
      return responseObject;
    }),
    send: jest.fn(),
    sendFile: jest.fn(),
  };
  return responseObject;
}

async function runContents({ scopes } = {}) {
  const responseObject = createResponseObject();
  const endpoint = new ContentsEndpoint();
  endpoint
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({ query: {} })
    .setResponseObject(responseObject);
  if (scopes) {
    endpoint.setScopes(new Set(scopes));
  }
  await endpoint.execute();
  return responseObject;
}

beforeEach(() => {
  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql: jest.fn(async () => {
      throw new Error('connection refused');
    }),
  }));
  DataCache2.mockReset();
  DataCache2.mockImplementation(() => ({
    get: jest.fn(async () => null),
    set: jest.fn(),
    del: jest.fn(),
  }));
});

describe('Contents endpoint when the data layer fails', () => {
  it('answers 500 with a JSON error', async () => {
    const responseObject = await runContents();

    expect(responseObject.statusCode).toBe(500);
    expect(responseObject.body).toEqual({
      error: 'The content tree could not be loaded',
    });
    expect(responseObject.sendFile).not.toHaveBeenCalled();
  });

  it('answers 500 with the edit scope as well', async () => {
    const responseObject = await runContents({ scopes: ['edit'] });

    expect(responseObject.statusCode).toBe(500);
    expect(responseObject.body).toEqual({
      error: 'The content tree could not be loaded',
    });
  });

  it('does not pass the cause on to the client', async () => {
    const responseObject = await runContents();

    expect(JSON.stringify(responseObject.body)).not.toContain(
      'connection refused'
    );
  });
});
