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
