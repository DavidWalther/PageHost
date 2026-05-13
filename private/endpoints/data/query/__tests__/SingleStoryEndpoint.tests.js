const { SingleStoryEndpoint } = require('../SingleStoryEndpoint');
const { DataFacade } = require('../../../../database2/DataFacade');
const { Logging } = require('../../../../modules/logging');

jest.mock('../../../../database2/DataFacade');
jest.mock('../../../../modules/logging');

describe('SingleStoryEndpoint', () => {
  let singleStoryEndpoint;
  let mockResponseObject;
  let mockRequestObject;
  let mockEnvironment;
  let mockFacadeGetData;
  let mockFacadeSetSkipCache;
  let mockFacadeSetScopes;

  beforeEach(() => {
    mockEnvironment = { APPLICATION_APPLICATION_KEY: 'test-key' };
    mockResponseObject = { json: jest.fn() };
    mockRequestObject = { query: { id: '123' } };
    mockFacadeGetData = jest.fn().mockResolvedValue({
      id: '123',
      title: 'Test Story',
      chapters: [
        { id: 'c1', name: 'Chapter 1' },
        { id: 'c2', name: 'Chapter 2' }
      ]
    });
    mockFacadeSetSkipCache = jest.fn().mockReturnThis();
    mockFacadeSetScopes = jest.fn().mockReturnThis();

    singleStoryEndpoint = new SingleStoryEndpoint();
    singleStoryEndpoint
      .setEnvironment(mockEnvironment)
      .setRequestObject(mockRequestObject)
      .setResponseObject(mockResponseObject);

    DataFacade.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call DataFacade with the correct parameter object', async () => {
    const mockStory = {
      id: '123',
      title: 'Test Story',
      chapters: [{ id: 'c1', name: 'Chapter 1' }]
    };
    DataFacade.mockImplementation(() => ({
      getData: mockFacadeGetData.mockResolvedValue(mockStory),
    }));

    await singleStoryEndpoint.execute();

    expect(DataFacade).toHaveBeenCalledWith(mockEnvironment);
    expect(mockResponseObject.json).toHaveBeenCalledWith(mockStory);
    expect(mockFacadeGetData).toHaveBeenCalledWith({
      returnPromise: true,
      request: { table: 'story', id: '123' },
    });
  });

  it('should set skipCache and scopes on DataFacade when the "edit" scope is set', async () => {
    const mockStory = {
      id: '123',
      title: 'Test Story',
      chapters: [
        { id: 'c1', name: 'Published Chapter', publishDate: '2026-01-01' },
        { id: 'c2', name: 'Future Chapter', publishDate: '2026-12-01' }
      ]
    };
    DataFacade.mockImplementation(() => ({
      setSkipCache: mockFacadeSetSkipCache,
      setScopes: mockFacadeSetScopes,
      getData: mockFacadeGetData.mockResolvedValue(mockStory),
    }));

    singleStoryEndpoint.setScopes(new Set(['edit']));
    await singleStoryEndpoint.execute();

    expect(mockFacadeSetSkipCache).toHaveBeenCalledWith(true);
    expect(mockFacadeSetScopes).toHaveBeenCalledWith(['edit']);
    expect(mockFacadeGetData).toHaveBeenCalledWith({
      returnPromise: true,
      request: { table: 'story', id: '123', publishDate: null },
    });
    expect(mockResponseObject.json).toHaveBeenCalledWith(mockStory);
  });

  it('should not set skipCache or scopes on DataFacade when no edit scope is set', async () => {
    const mockStory = {
      id: '123',
      title: 'Test Story',
      chapters: [{ id: 'c1', name: 'Published Chapter', publishDate: '2026-01-01' }]
    };
    DataFacade.mockImplementation(() => ({
      setSkipCache: mockFacadeSetSkipCache,
      setScopes: mockFacadeSetScopes,
      getData: mockFacadeGetData.mockResolvedValue(mockStory),
    }));

    await singleStoryEndpoint.execute();

    expect(mockFacadeSetSkipCache).not.toHaveBeenCalled();
    expect(mockFacadeSetScopes).not.toHaveBeenCalled();
    expect(mockFacadeGetData).toHaveBeenCalledWith({
      returnPromise: true,
      request: { table: 'story', id: '123' },
    });
    expect(mockResponseObject.json).toHaveBeenCalledWith(mockStory);
  });

  it('should not set skipCache or scopes on DataFacade when other scopes are set but not edit', async () => {
    const mockStory = {
      id: '123',
      title: 'Test Story',
      chapters: [{ id: 'c1', name: 'Published Chapter' }]
    };
    DataFacade.mockImplementation(() => ({
      setSkipCache: mockFacadeSetSkipCache,
      setScopes: mockFacadeSetScopes,
      getData: mockFacadeGetData.mockResolvedValue(mockStory),
    }));

    singleStoryEndpoint.setScopes(new Set(['create', 'delete']));
    await singleStoryEndpoint.execute();

    expect(mockFacadeSetSkipCache).not.toHaveBeenCalled();
    expect(mockFacadeSetScopes).not.toHaveBeenCalled();
    expect(mockFacadeGetData).toHaveBeenCalledWith({
      returnPromise: true,
      request: { table: 'story', id: '123' },
    });
    expect(mockResponseObject.json).toHaveBeenCalledWith(mockStory);
  });
});