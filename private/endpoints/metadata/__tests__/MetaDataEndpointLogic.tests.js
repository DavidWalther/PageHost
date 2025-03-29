const MetaDataEndpointLogic  = require('../MetaDataEndpointLogic');
const { DataFacade } = require('../../../database2/DataFacade');
const { Logging } = require('../../../modules/logging');

jest.mock('../../../database2/DataFacade');
jest.mock('../../../modules/logging');

describe('MetaDataEndpointLogic', () => {
  let metaDataEndpointLogic;
  let mockResponseObject;
  let mockEnvironment;
  let mockDataCleaner;

  beforeEach(() => {
    mockEnvironment = { APPLICATION_APPLICATION_KEY: 'test-key' };
    mockResponseObject = {
      json: jest.fn()
    };

    metaDataEndpointLogic = new MetaDataEndpointLogic();
    metaDataEndpointLogic.setEnvironment(mockEnvironment).setResponseObject(mockResponseObject);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a JSON configuration object', async () => {
    const mockConfiguration = {
      key1: 'value1',
      key2: 'value2',
      applicationIncluded: true
    };

    DataFacade.mockImplementation(() => ({
      getData: jest.fn().mockResolvedValue(mockConfiguration)
    }));

    await metaDataEndpointLogic.execute();

    expect(mockResponseObject.json).toHaveBeenCalledWith(mockConfiguration);
  });

  it('should clean the configuration using DataCleaner before returning', async () => {
    const mockConfiguration = {
      key1: 'value1',
      key2: 'value2',
      applicationIncluded: true
    };

    DataFacade.mockImplementation(() => ({
      getData: jest.fn().mockResolvedValue(mockConfiguration)
    }));

    await metaDataEndpointLogic.execute();

    expect(mockResponseObject.json).toHaveBeenCalledWith({
      key1: 'value1',
      key2: 'value2'
    });
  });
});
