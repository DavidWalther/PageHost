const DeleteEndpoint = require('../deleteEndpoint');
const { DataFacade } = require('../../../../../database2/DataFacade.js');
const { Logging } = require('../../../../../modules/logging');

jest.mock('../../../../../database2/DataFacade');
jest.mock('../../../../../modules/logging');

describe('DeleteEndpoint', () => {
  let req, res, environment, deleteData, setSkipCache;

  beforeEach(() => {
    environment = {
      APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit', 'Delete']),
    };
    req = {
      url: '/api/1.0/data/delete?object=node&id=n-1',
      query: { object: 'node', id: 'n-1' },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    deleteData = jest.fn().mockResolvedValue({ nodes: [], contents: [] });
    setSkipCache = jest.fn().mockReturnThis();
    DataFacade.mockClear();
    DataFacade.mockImplementation(() => ({ setSkipCache, deleteData }));
    Logging.debugMessage.mockClear();
  });

  function run() {
    return new DeleteEndpoint()
      .setEnvironment(environment)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();
  }

  it('deletes the record through the facade, past the cache', async () => {
    await run();

    expect(setSkipCache).toHaveBeenCalledWith(true);
    expect(deleteData).toHaveBeenCalledWith({ object: 'node', id: 'n-1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('reads the active actions case-insensitively', async () => {
    environment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['DELETE']);

    await run();

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    ['object', { id: 'n-1' }],
    ['id', { object: 'node' }],
  ])('answers 400 without %s and deletes nothing', async (_missing, query) => {
    req.query = query;

    await run();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Missing object or id',
    });
    expect(deleteData).not.toHaveBeenCalled();
  });

  it('answers 403 when delete is not an active action', async () => {
    environment.APPLICATION_ACTIVE_ACTIONS = JSON.stringify(['edit']);

    await run();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Permission denied',
    });
    expect(deleteData).not.toHaveBeenCalled();
  });

  it('answers 403 when no actions are configured at all', async () => {
    delete environment.APPLICATION_ACTIVE_ACTIONS;

    await run();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(deleteData).not.toHaveBeenCalled();
  });

  it('answers 500 with the message when the facade fails', async () => {
    deleteData.mockRejectedValue(new Error('Database down'));

    await run();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Database down',
    });
  });
});
