const { AllStoriesEndpoint } = require('../AllStoriesEndpoint');
const { DataFacade } = require('../../../../database2/DataFacade');
const { DataCleaner } = require('../../../../modules/DataCleaner');
const { Logging } = require('../../../../modules/logging');

jest.mock('../../../../database2/DataFacade');
jest.mock('../../../../modules/logging');

describe('AllStoriesEndpoint', () => {
  let allStoriesEndpoint;
  let mockResponseObject;
  let mockEnvironment;
  let mockDataCleaner;

  beforeEach(() => {
    mockEnvironment = { APPLICATION_APPLICATION_KEY: 'test-key' };
    mockResponseObject = {
      json: jest.fn()
    };
    mockDataCleaner = new DataCleaner();
    jest.spyOn(mockDataCleaner, 'removeApplicationKeys');

    allStoriesEndpoint = new AllStoriesEndpoint();
    allStoriesEndpoint.setEnvironment(mockEnvironment).setResponseObject(mockResponseObject);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a JSON list of stories', async () => {
    const mockStories = [
      { id: 1, title: 'Story 1', applicationIncluded: true },
      { id: 2, title: 'Story 2', applicationExcluded: false }
    ];

    DataFacade.mockImplementation(() => ({
      getData: jest.fn().mockResolvedValue(mockStories)
    }));

    await allStoriesEndpoint.execute();

    expect(mockResponseObject.json).toHaveBeenCalledWith(mockStories);
  });

  it('should clean the stories using DataCleaner before returning', async () => {
    const mockStories = [
      { id: 1, title: 'Story 1', applicationIncluded: true },
      { id: 2, title: 'Story 2', applicationExcluded: false }
    ];

    DataFacade.mockImplementation(() => ({
      getData: jest.fn().mockResolvedValue(mockStories)
    }));

    await allStoriesEndpoint.execute();

//    expect(mockDataCleaner.removeApplicationKeys).toHaveBeenCalledWith(mockStories);
    expect(mockResponseObject.json).toHaveBeenCalledWith([
      { id: 1, title: 'Story 1' },
      { id: 2, title: 'Story 2' }
    ]);
  });
});
