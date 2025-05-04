const { ChapterEndpoint } = require('../ChapterEndpoint');
const { DataFacade } = require('../../../../database2/DataFacade');
const { Logging } = require('../../../../modules/logging');

jest.mock('../../../../database2/DataFacade');
jest.mock('../../../../modules/logging');

describe('ChapterEndpoint', () => {
  let chapterEndpoint;
  let mockResponseObject;
  let mockRequestObject;
  let mockEnvironment;
  let mockFacadeGetData;
  let mockFacadeSetSkipCache;

  beforeEach(() => {
    mockEnvironment = { APPLICATION_APPLICATION_KEY: 'test-key' };
    mockResponseObject = { json: jest.fn() };
    mockRequestObject = { query: { id: '123' } };
    mockFacadeGetData = jest.fn().mockResolvedValue({ id: '123', title: 'Test Chapter' });
    mockFacadeSetSkipCache = jest.fn().mockReturnThis();

    chapterEndpoint = new ChapterEndpoint();
    chapterEndpoint
      .setEnvironment(mockEnvironment)
      .setRequestObject(mockRequestObject)
      .setResponseObject(mockResponseObject);

    DataFacade.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call DataFacade with the correct parameter object', async () => {
    const mockChapter = { id: '123', title: 'Test Chapter' };
    DataFacade.mockImplementation(() => ({
      setScopes: jest.fn().mockReturnThis(),
      getData: mockFacadeGetData,
    }));

    await chapterEndpoint.execute();

    expect(DataFacade).toHaveBeenCalledWith(mockEnvironment);
    expect(mockResponseObject.json).toHaveBeenCalledWith(mockChapter);
    expect(mockFacadeGetData).toHaveBeenCalledWith({
      returnPromise: true,
      request: { table: 'chapter', id: '123' },
    });
  });

  it('should set skipCache on DataFacade when the "edit" scope is set', async () => {
    const mockChapter = { id: '123', title: 'Test Chapter' };
    DataFacade.mockImplementation(() => ({
      setScopes: jest.fn().mockReturnThis(),
      setSkipCache: mockFacadeSetSkipCache,
      getData: mockFacadeGetData,
    }));

    chapterEndpoint.setScopes(new Set(['edit']));
    await chapterEndpoint.execute();

    expect(mockFacadeSetSkipCache).toHaveBeenCalledWith(true);
    expect(mockResponseObject.json).toHaveBeenCalledWith(mockChapter);
  });
});
