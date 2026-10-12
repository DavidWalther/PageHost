/**
 * Moving a node: an update whose `parent_node_id` differs from the stored one.
 *
 * Integration test of the write path — `UpsertEndpoint`, the real `DataFacade`
 * and the real `NodeContentRepository`. Only external I/O is mocked: the
 * Postgres connector, the cache, the configuration storage and the logging.
 *
 * The connector answers from a small in-memory `node` table, so the test states
 * a tree and an intent instead of a list of SQL replies:
 *
 *   root-a (legacy L-a)            root-b            feed-root
 *   └─ child-a1 (legacy L-a1)                        └─ feed-1
 *      └─ grandchild-a11                                └─ feed-1-x
 */

jest.mock('../../../../../database2/DataStorage/pgConnector.js');
jest.mock('../../../../../database2/DataStorage/DataStorage.js');
jest.mock('../../../../../database2/DataCache/DataCache.js');
jest.mock('../../../../../modules/logging');

const {
  PostgresActions,
} = require('../../../../../database2/DataStorage/pgConnector.js');
const {
  DataStorage,
} = require('../../../../../database2/DataStorage/DataStorage.js');
const {
  DataCache2,
} = require('../../../../../database2/DataCache/DataCache.js');
const UpsertEndpoint = require('../upsertEndpoint');

const APPLICATION_KEY = 'moveApp';

const ENVIRONMENT = {
  APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']),
};

const TREE = [
  { id: 'root-a', legacy_id: 'L-a', parent_node_id: null },
  { id: 'child-a1', legacy_id: 'L-a1', parent_node_id: 'root-a' },
  { id: 'grandchild-a11', legacy_id: null, parent_node_id: 'child-a1' },
  { id: 'root-b', legacy_id: null, parent_node_id: null },
  { id: 'feed-root', legacy_id: null, parent_node_id: null },
  { id: 'feed-1', legacy_id: null, parent_node_id: 'feed-root' },
  { id: 'feed-1-x', legacy_id: null, parent_node_id: 'feed-1' },
];

/** The in-memory `node` table, reset per test. */
let nodes;
/** Every statement run, `{ sql, parameters }`, in order. */
let executed;
/** Keys removed from the cache, by `del` and `delMany`. */
let clearedKeys;

const findNode = (id) =>
  nodes.find((node) => node.id === id || node.legacy_id === id);

/** Answers a statement from the in-memory table. */
function answer(sql, parameters) {
  if (sql.includes('RECURSIVE ancestors')) {
    const chain = [];
    let current = findNode(parameters[0]);
    while (current && !chain.some((entry) => entry.id === current.id)) {
      chain.push({ id: current.id });
      current = findNode(current.parent_node_id);
    }
    return chain;
  }
  if (sql.includes('FROM node WHERE legacy_id = $1 OR id = $1')) {
    const node = findNode(parameters[0]);
    return node ? [{ id: node.id }] : [];
  }
  if (sql.includes('SELECT parent_node_id FROM node WHERE id = $1')) {
    const node = findNode(parameters[0]);
    return node ? [{ parent_node_id: node.parent_node_id }] : [];
  }
  if (sql.includes('SELECT id, legacy_id FROM node WHERE id = ANY($1)')) {
    return nodes
      .filter((node) => parameters[0].includes(node.id))
      .map(({ id, legacy_id }) => ({ id, legacy_id }));
  }
  if (sql.startsWith('UPDATE node SET')) {
    const node = findNode(parameters[parameters.length - 1]);
    const names = sql
      .slice('UPDATE node SET '.length, sql.indexOf(' WHERE'))
      .split(', ')
      .map((assignment) => assignment.split(' = ')[0]);
    names.forEach((name, index) => {
      node[name] = parameters[index];
    });
    return [{ ...node }];
  }
  return [];
}

beforeEach(() => {
  nodes = TREE.map((node) => ({ ...node, sortnumber: 3 }));
  executed = [];
  clearedKeys = [];

  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    transaction: jest.fn(async (callback) =>
      callback(async (sql, parameters = []) => {
        executed.push({ sql, parameters });
        return answer(sql, parameters);
      })
    ),
    executeParameterizedSql: jest.fn(async (sql, parameters = []) => {
      executed.push({ sql, parameters });
      return answer(sql, parameters);
    }),
  }));

  DataStorage.mockReset();
  DataStorage.mockImplementation(() => ({
    setConditionApplicationKey: jest.fn(),
    queryConfiguration: jest.fn(async () => ({ feedRootNodeId: 'feed-root' })),
  }));

  DataCache2.mockReset();
  DataCache2.mockImplementation(() => ({
    get: jest.fn(async () => null),
    set: jest.fn(async () => {}),
    del: jest.fn(async (key) => {
      clearedKeys.push(key);
    }),
    delMany: jest.fn(async (keys) => {
      clearedKeys.push(...keys);
    }),
  }));
});

/** Sends an update through the endpoint and returns status and body. */
async function update(payload) {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  await new UpsertEndpoint()
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({
      url: '/api/1.0/data/change/',
      body: { object: 'node', payload },
    })
    .setResponseObject(response)
    .execute();
  return {
    status: response.status.mock.calls[0]?.[0],
    body: response.json.mock.calls[0]?.[0],
  };
}

const nodeUpdates = () =>
  executed.filter((entry) => entry.sql.startsWith('UPDATE node SET'));

describe('Moving a node', () => {
  it('moves a node below another node, at the end of its children', async () => {
    const { status } = await update({
      id: 'child-a1',
      parent_node_id: 'root-b',
      sortnumber: null,
    });

    expect(status).toBe(200);
    expect(findNode('child-a1').parent_node_id).toBe('root-b');
    expect(findNode('child-a1').sortnumber).toBeNull();
    expect(nodeUpdates()).toHaveLength(1);
  });

  // Most nodes inherit their visibility. As a root a node has nothing to
  // inherit from, so without a row of its own it would vanish from the app,
  // together with everything below it. Creating a root adds the same row.
  it.failing(
    'moves a node to the top level and includes it in the app',
    async () => {
      const { status } = await update({
        id: 'child-a1',
        parent_node_id: null,
        sortnumber: null,
      });

      expect(status).toBe(200);
      expect(findNode('child-a1').parent_node_id).toBeNull();
      const includes = executed.filter((entry) =>
        entry.sql.includes('INSERT INTO app_node')
      );
      expect(includes).toHaveLength(1);
      expect(includes[0].parameters).toEqual(['child-a1', APPLICATION_KEY]);
    }
  );

  // A node below one of its own descendants hangs off no root any more: the
  // tree is built from the roots down and never reaches it, so the whole
  // subtree would silently drop out.
  describe('below itself', () => {
    it.failing('rejects the node itself as the new parent', async () => {
      const { status, body } = await update({
        id: 'child-a1',
        parent_node_id: 'child-a1',
        sortnumber: null,
      });

      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(nodeUpdates()).toHaveLength(0);
    });

    it.failing('rejects a descendant as the new parent', async () => {
      const { status } = await update({
        id: 'child-a1',
        parent_node_id: 'grandchild-a11',
        sortnumber: null,
      });

      expect(status).toBe(400);
      expect(nodeUpdates()).toHaveLength(0);
    });

    it.failing('rejects a descendant named by its legacy id', async () => {
      const { status } = await update({
        id: 'L-a',
        parent_node_id: 'L-a1',
        sortnumber: null,
      });

      expect(status).toBe(400);
      expect(nodeUpdates()).toHaveLength(0);
    });
  });

  // The feeds are the start page, read as the children of the feed root
  // (`feedRootNodeId`). Nothing moves out of them or into them.
  describe('feeds', () => {
    it.failing('rejects moving the feed root', async () => {
      const { status } = await update({
        id: 'feed-root',
        parent_node_id: 'root-a',
        sortnumber: null,
      });

      expect(status).toBe(400);
      expect(nodeUpdates()).toHaveLength(0);
    });

    it.failing('rejects moving a node below the feed root', async () => {
      const { status } = await update({
        id: 'feed-1-x',
        parent_node_id: 'root-a',
        sortnumber: null,
      });

      expect(status).toBe(400);
      expect(nodeUpdates()).toHaveLength(0);
    });

    it.failing('rejects the feed root as the new parent', async () => {
      const { status } = await update({
        id: 'child-a1',
        parent_node_id: 'feed-root',
        sortnumber: null,
      });

      expect(status).toBe(400);
      expect(nodeUpdates()).toHaveLength(0);
    });

    it.failing('rejects a feed as the new parent', async () => {
      const { status } = await update({
        id: 'child-a1',
        parent_node_id: 'feed-1',
        sortnumber: null,
      });

      expect(status).toBe(400);
      expect(nodeUpdates()).toHaveLength(0);
    });

    // The edit dialog sends the current parent along on every save. Editing
    // a feed is not moving it.
    it('saves a feed whose parent stays the same', async () => {
      const { status } = await update({
        id: 'feed-1',
        name: 'Neuigkeiten',
        parent_node_id: 'feed-root',
      });

      expect(status).toBe(200);
      expect(findNode('feed-1').name).toBe('Neuigkeiten');
    });
  });
});
