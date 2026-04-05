/**
 * Endpoint Integration Tests
 *
 * Mocking strategy:
 *   - DataStorage (Postgres) and DataCache2 (Redis) are mocked — these are external I/O
 *   - All other modules (DataFacade, DataFacadeSync, EndpointLogic, DataCleaner, etc.) are real
 *   - OpenIdConnectClient is also mocked in auth tests to avoid real HTTP calls to Google
 */

const { DataStorage } = require('../database2/DataStorage/DataStorage');
const { DataCache2 } = require('../database2/DataCache/DataCache');

jest.mock('../database2/DataStorage/DataStorage');
jest.mock('../database2/DataCache/DataCache');

// ─── Shared helpers ─────────────────────────────────────────────────────────

const ENVIRONMENT = Object.freeze({
  APPLICATION_APPLICATION_KEY: 'test-key',
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['login', 'create', 'edit', 'delete', 'publish']),
  MOCK_DATA_ENABLE: 'false',
  CACHE_KEY_PREFIX: 'TEST',
  CACHE_DATA_INCREMENT: '1',
  CACHE_CONTAINER_EXPIRATION_SECONDS: 60,
  AUTH_SERVER_SECRET: 'test-secret',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
});

function createResMock() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
}

let mockCacheGet;
let mockCacheSet;
let mockCacheDel;
let mockQueryAllStories;
let mockQueryStory;
let mockQueryChapter;
let mockQueryParagraphs;
let mockQueryIdentityByKey;
let mockUpdateData;
let mockCreateRecord;
let mockDeleteData;

function setupDataCacheMock() {
  DataCache2.mockImplementation(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
    del: mockCacheDel,
  }));
}

function setupDataStorageMock() {
  DataStorage.mockImplementation(() => ({
    setConditionApplicationKey: jest.fn().mockReturnThis(),
    setConditionPublishDate: jest.fn().mockReturnThis(),
    queryAllStories: mockQueryAllStories,
    queryStory: mockQueryStory,
    queryChapter: mockQueryChapter,
    queryParagraphs: mockQueryParagraphs,
    queryIdentityByKey: mockQueryIdentityByKey,
    updateData: mockUpdateData,
    createRecord: mockCreateRecord,
    deleteData: mockDeleteData,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();

  mockCacheGet = jest.fn().mockResolvedValue(null); // always cache miss by default
  mockCacheSet = jest.fn().mockResolvedValue(undefined);
  mockCacheDel = jest.fn().mockResolvedValue(undefined);

  mockQueryAllStories = jest.fn().mockResolvedValue([]);
  mockQueryStory = jest.fn().mockResolvedValue({});
  mockQueryChapter = jest.fn().mockResolvedValue({});
  mockQueryParagraphs = jest.fn().mockResolvedValue({});
  mockQueryIdentityByKey = jest.fn().mockResolvedValue({});
  mockUpdateData = jest.fn().mockResolvedValue({});
  mockCreateRecord = jest.fn().mockResolvedValue({});
  mockDeleteData = jest.fn().mockResolvedValue(undefined);

  setupDataCacheMock();
  setupDataStorageMock();
});

// ─── Step 1: Data Query Endpoints ───────────────────────────────────────────

const { AllStoriesEndpoint } = require('../endpoints/data/query/AllStoriesEndpoint');
const { SingleStoryEndpoint } = require('../endpoints/data/query/SingleStoryEndpoint');
const { ChapterEndpoint } = require('../endpoints/data/query/ChapterEndpoint');
const { ParagraphEndpoint } = require('../endpoints/data/query/ParagraphEndpoint');

describe('AllStoriesEndpoint Integration', () => {
  it('should fetch stories from DataStorage on a cache miss', async () => {
    const mockStories = [
      { id: '000s001', title: 'Story One', applicationIncluded: 'test-key' },
      { id: '000s002', title: 'Story Two', applicationIncluded: 'test-key' },
    ];
    mockQueryAllStories.mockResolvedValue(mockStories);

    const res = createResMock();
    await new AllStoriesEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: {} })
      .setResponseObject(res)
      .execute();

    expect(mockQueryAllStories).toHaveBeenCalledTimes(1);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveLength(2);
    expect(responseData[0].id).toBe('000s001');
  });

  it('should strip applicationIncluded from the response via DataCleaner', async () => {
    mockQueryAllStories.mockResolvedValue([
      { id: '000s001', title: 'Story One', applicationIncluded: 'test-key' },
    ]);

    const res = createResMock();
    await new AllStoriesEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: {} })
      .setResponseObject(res)
      .execute();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData[0]).not.toHaveProperty('applicationIncluded');
  });

  it('should return an empty array when no stories exist', async () => {
    mockQueryAllStories.mockResolvedValue([]);

    const res = createResMock();
    await new AllStoriesEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: {} })
      .setResponseObject(res)
      .execute();

    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('SingleStoryEndpoint Integration', () => {
  it('should fetch a story from DataStorage on a cache miss', async () => {
    const mockStory = { id: '000s001', title: 'Story One', chapters: [] };
    mockQueryStory.mockResolvedValue(mockStory);

    const res = createResMock();
    await new SingleStoryEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000s001' } })
      .setResponseObject(res)
      .execute();

    expect(mockQueryStory).toHaveBeenCalledWith('000s001');
    expect(res.json).toHaveBeenCalledWith(mockStory);
  });

  it('should bypass the cache and query DataStorage directly when the edit scope is present', async () => {
    const mockStory = { id: '000s001', title: 'Unpublished Story', chapters: [] };
    mockQueryStory.mockResolvedValue(mockStory);

    const res = createResMock();
    await new SingleStoryEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000s001' } })
      .setResponseObject(res)
      .setScopes(new Set(['edit']))
      .execute();

    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockQueryStory).toHaveBeenCalledWith('000s001');
    expect(res.json).toHaveBeenCalledWith(mockStory);
  });

  it('should return an empty object when the story is not found', async () => {
    mockQueryStory.mockResolvedValue({});

    const res = createResMock();
    await new SingleStoryEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000s999' } })
      .setResponseObject(res)
      .execute();

    expect(res.json).toHaveBeenCalledWith({});
  });
});

describe('ChapterEndpoint Integration', () => {
  it('should fetch a chapter from DataStorage on a cache miss', async () => {
    const mockChapter = { id: '000c001', title: 'Chapter One', paragraphs: [] };
    mockQueryChapter.mockResolvedValue(mockChapter);

    const res = createResMock();
    await new ChapterEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000c001' } })
      .setResponseObject(res)
      .execute();

    expect(mockQueryChapter).toHaveBeenCalledWith('000c001');
    expect(res.json).toHaveBeenCalledWith(mockChapter);
  });

  it('should bypass the cache when the edit scope is present', async () => {
    const mockChapter = { id: '000c001', title: 'Chapter One', paragraphs: [] };
    mockQueryChapter.mockResolvedValue(mockChapter);

    const res = createResMock();
    await new ChapterEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000c001' } })
      .setResponseObject(res)
      .setScopes(new Set(['edit']))
      .execute();

    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockQueryChapter).toHaveBeenCalledWith('000c001');
  });

  it('should return an empty object when the chapter is not found', async () => {
    mockQueryChapter.mockResolvedValue({});

    const res = createResMock();
    await new ChapterEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000c999' } })
      .setResponseObject(res)
      .execute();

    expect(res.json).toHaveBeenCalledWith({});
  });
});

describe('ParagraphEndpoint Integration', () => {
  it('should fetch a paragraph from DataStorage on a cache miss', async () => {
    const mockParagraph = { id: '000p001', content: 'Some content' };
    mockQueryParagraphs.mockResolvedValue(mockParagraph);

    const res = createResMock();
    await new ParagraphEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000p001' } })
      .setResponseObject(res)
      .execute();

    expect(mockQueryParagraphs).toHaveBeenCalledWith('000p001');
    expect(res.json).toHaveBeenCalledWith(mockParagraph);
  });

  it('should bypass the cache when the edit scope is present', async () => {
    const mockParagraph = { id: '000p001', content: 'Unpublished content' };
    mockQueryParagraphs.mockResolvedValue(mockParagraph);

    const res = createResMock();
    await new ParagraphEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000p001' } })
      .setResponseObject(res)
      .setScopes(new Set(['edit']))
      .execute();

    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockQueryParagraphs).toHaveBeenCalledWith('000p001');
  });

  it('should return an empty object when the paragraph is not found', async () => {
    mockQueryParagraphs.mockResolvedValue({});

    const res = createResMock();
    await new ParagraphEndpoint()
      .setEnvironment(ENVIRONMENT)
      .setRequestObject({ query: { id: '000p999' } })
      .setResponseObject(res)
      .execute();

    expect(res.json).toHaveBeenCalledWith({});
  });
});

// ─── Step 2: Data Mutation Endpoints ────────────────────────────────────────

const UpsertEndpoint = require('../endpoints/api/1.0/data/upsertEndpoint');
const DeleteEndpoint = require('../endpoints/api/1.0/data/deleteEndpoint');

describe('UpsertEndpoint Integration — create', () => {
  const ENV_WITH_CREATE = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['create', 'edit']) };

  it('should create a record and return 200 with the result', async () => {
    const createdRecord = { id: 'new-p001', content: 'New paragraph' };
    mockCreateRecord.mockResolvedValue(createdRecord);

    const req = {
      url: '/api/1.0/data/change/paragraph',
      body: { object: 'paragraph', payload: { content: 'New paragraph' } },
    };
    const res = createResMock();

    await new UpsertEndpoint()
      .setEnvironment(ENV_WITH_CREATE)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(mockCreateRecord).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, result: createdRecord });
  });

  it('should set applicationIncluded on the payload before creating', async () => {
    mockCreateRecord.mockResolvedValue({ id: 'new-p001' });

    const req = {
      url: '/api/1.0/data/change/paragraph',
      body: { object: 'paragraph', payload: { content: 'New paragraph' } },
    };
    const res = createResMock();

    await new UpsertEndpoint()
      .setEnvironment(ENV_WITH_CREATE)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    const callArgs = mockCreateRecord.mock.calls[0][1];
    expect(callArgs).toHaveProperty('applicationIncluded', ENVIRONMENT.APPLICATION_APPLICATION_KEY);
  });

  it('should return 403 when create is not in allowed actions', async () => {
    const envWithoutCreate = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']) };

    const req = {
      url: '/api/1.0/data/change/paragraph',
      body: { object: 'paragraph', payload: { content: 'New paragraph' } },
    };
    const res = createResMock();

    await new UpsertEndpoint()
      .setEnvironment(envWithoutCreate)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
    expect(mockCreateRecord).not.toHaveBeenCalled();
  });
});

describe('UpsertEndpoint Integration — update', () => {
  const ENV_WITH_EDIT = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['create', 'edit']) };

  it('should update a record and return 200 with the result', async () => {
    const updatedRecord = { id: '000s001', title: 'Updated Title' };
    mockUpdateData.mockResolvedValue(updatedRecord);

    const req = {
      url: '/api/1.0/data/change/story',
      body: { object: 'story', payload: { id: '000s001', title: 'Updated Title' } },
    };
    const res = createResMock();

    await new UpsertEndpoint()
      .setEnvironment(ENV_WITH_EDIT)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(mockUpdateData).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, result: updatedRecord });
  });

  it('should return 403 when edit is not in allowed actions', async () => {
    const envWithoutEdit = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['create']) };

    const req = {
      url: '/api/1.0/data/change/story',
      body: { object: 'story', payload: { id: '000s001', title: 'Updated Title' } },
    };
    const res = createResMock();

    await new UpsertEndpoint()
      .setEnvironment(envWithoutEdit)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
    expect(mockUpdateData).not.toHaveBeenCalled();
  });

  it('should return 400 when payload is missing', async () => {
    const req = {
      url: '/api/1.0/data/change/story',
      body: { object: 'story' },
    };
    const res = createResMock();

    await new UpsertEndpoint()
      .setEnvironment(ENV_WITH_EDIT)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
  });
});

describe('DeleteEndpoint Integration', () => {
  const ENV_WITH_DELETE = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['delete']) };

  it('should delete a record and return 200', async () => {
    mockDeleteData.mockResolvedValue(undefined);

    const req = {
      url: '/api/1.0/data/delete',
      query: { object: 'paragraph', id: '000p001' },
    };
    const res = createResMock();

    await new DeleteEndpoint()
      .setEnvironment(ENV_WITH_DELETE)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(mockDeleteData).toHaveBeenCalledWith('paragraph', '000p001');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should return 400 when object is missing', async () => {
    const req = { url: '/api/1.0/data/delete', query: { id: '000p001' } };
    const res = createResMock();

    await new DeleteEndpoint()
      .setEnvironment(ENV_WITH_DELETE)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Missing object or id' });
  });

  it('should return 400 when id is missing', async () => {
    const req = { url: '/api/1.0/data/delete', query: { object: 'paragraph' } };
    const res = createResMock();

    await new DeleteEndpoint()
      .setEnvironment(ENV_WITH_DELETE)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Missing object or id' });
  });

  it('should return 403 when delete is not in allowed actions', async () => {
    const envWithoutDelete = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']) };

    const req = {
      url: '/api/1.0/data/delete',
      query: { object: 'paragraph', id: '000p001' },
    };
    const res = createResMock();

    await new DeleteEndpoint()
      .setEnvironment(envWithoutDelete)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
    expect(mockDeleteData).not.toHaveBeenCalled();
  });
});

// ─── Step 3: Action Endpoints ────────────────────────────────────────────────

const PublishEndpoint = require('../endpoints/api/1.0/action/publishEndpoint');
const UnpublishEndpoint = require('../endpoints/api/1.0/action/unpublishEndpoint');

describe('PublishEndpoint Integration', () => {
  const ENV_WITH_PUBLISH = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['publish', 'edit']) };

  it('should publish a record and return 200', async () => {
    const existingRecord = { id: '000s001', title: 'Story One' }; // no publishDate
    const updatedRecord = { id: '000s001', title: 'Story One', publishDate: '2026-01-01T00:00:00.000Z' };
    mockQueryStory.mockResolvedValue(existingRecord);
    mockUpdateData.mockResolvedValue(updatedRecord);

    const req = {
      url: '/api/1.0/actions/publish',
      body: { object: 'story', id: '000s001' },
    };
    const res = createResMock();

    await new PublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(mockUpdateData).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should return 403 when publish is not in allowed actions', async () => {
    const envWithoutPublish = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']) };

    const req = {
      url: '/api/1.0/actions/publish',
      body: { object: 'story', id: '000s001' },
    };
    const res = createResMock();

    await new PublishEndpoint()
      .setEnvironment(envWithoutPublish)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
    expect(mockUpdateData).not.toHaveBeenCalled();
  });

  it('should return 400 when request body is invalid (missing id)', async () => {
    const req = {
      url: '/api/1.0/actions/publish',
      body: { object: 'story' },
    };
    const res = createResMock();

    await new PublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
  });

  it('should return 404 when record does not exist', async () => {
    mockQueryStory.mockResolvedValue(null);

    const req = {
      url: '/api/1.0/actions/publish',
      body: { object: 'story', id: '000s999' },
    };
    const res = createResMock();

    await new PublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record not found' });
  });

  it('should return 400 when the record is already published', async () => {
    mockQueryStory.mockResolvedValue({ id: '000s001', publishDate: '2025-01-01' });

    const req = {
      url: '/api/1.0/actions/publish',
      body: { object: 'story', id: '000s001' },
    };
    const res = createResMock();

    await new PublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record is already published' });
    expect(mockUpdateData).not.toHaveBeenCalled();
  });
});

describe('UnpublishEndpoint Integration', () => {
  const ENV_WITH_PUBLISH = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['publish', 'edit']) };

  it('should unpublish a record and return 200', async () => {
    const existingRecord = { id: '000s001', publishdate: '2025-01-01' };
    const updatedRecord = { id: '000s001', publishdate: null };
    mockQueryStory.mockResolvedValue(existingRecord);
    mockUpdateData.mockResolvedValue(updatedRecord);

    const req = {
      url: '/api/1.0/actions/unpublish',
      body: { object: 'story', id: '000s001' },
    };
    const res = createResMock();

    await new UnpublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(mockUpdateData).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should return 403 when publish is not in allowed actions', async () => {
    const envWithoutPublish = { ...ENVIRONMENT, APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['edit']) };

    const req = {
      url: '/api/1.0/actions/unpublish',
      body: { object: 'story', id: '000s001' },
    };
    const res = createResMock();

    await new UnpublishEndpoint()
      .setEnvironment(envWithoutPublish)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Permission denied' });
    expect(mockUpdateData).not.toHaveBeenCalled();
  });

  it('should return 400 when request body is invalid (missing id)', async () => {
    const req = {
      url: '/api/1.0/actions/unpublish',
      body: { object: 'story' },
    };
    const res = createResMock();

    await new UnpublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid request data' });
  });

  it('should return 404 when the record does not exist', async () => {
    mockQueryStory.mockResolvedValue(null);

    const req = {
      url: '/api/1.0/actions/unpublish',
      body: { object: 'story', id: '000s999' },
    };
    const res = createResMock();

    await new UnpublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record not found' });
  });

  it('should return 400 when the record is already unpublished', async () => {
    mockQueryStory.mockResolvedValue({ id: '000s001' }); // no publishdate

    const req = {
      url: '/api/1.0/actions/unpublish',
      body: { object: 'story', id: '000s001' },
    };
    const res = createResMock();

    await new UnpublishEndpoint()
      .setEnvironment(ENV_WITH_PUBLISH)
      .setRequestObject(req)
      .setResponseObject(res)
      .execute();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record is already unpublished' });
    expect(mockUpdateData).not.toHaveBeenCalled();
  });
});
