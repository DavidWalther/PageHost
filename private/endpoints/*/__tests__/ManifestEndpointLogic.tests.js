const ManifestEndpointLogic = require('../ManifestEndpointLogic');
const { DataFacade } = require('../../../database2/DataFacade');
const { DataCleaner } = require('../../../modules/DataCleaner');
const { Logging } = require('../../../modules/logging');

jest.mock('../../../database2/DataFacade');
jest.mock('../../../modules/logging');

const MOCK_CONFIGURATION = {
  manifest: {
    name: 'Test App',
    short_name: 'Test',
    description: 'Test Description',
    start_url: '/test',
    display: 'fullscreen',
    background_color: '#123456',
    theme_color: '#654321'
  },
  some_other_key: 'some_other_value',
  some_other_nested_object: {
    key1: 'value1',
    key2: 'value2'
  }
};



let mockFacadeGetData = jest.fn().mockResolvedValue(MOCK_CONFIGURATION);

DataFacade.mockImplementation(() => {
  return {
    getData: mockFacadeGetData
  };
});

describe('ManifestEndpointLogic', () => {
  let manifestEndpointLogic;
  let mockResponseObject;
  let mockEnvironment;

  beforeEach(() => {
    mockEnvironment = { APPLICATION_APPLICATION_KEY: 'test-key' };
    mockResponseObject = {
      json: jest.fn()
    };
    manifestEndpointLogic = new ManifestEndpointLogic();
    manifestEndpointLogic.setEnvironment(mockEnvironment).setResponseObject(mockResponseObject);
  });

  afterEach(() => {
    DataFacade.mockClear();
  });

  it('should deliver manifest.json with configuration from DataFacade', async () => {
    DataFacade.getData = jest.fn().mockResolvedValue(MOCK_CONFIGURATION);

    await manifestEndpointLogic.execute();

    expect(mockFacadeGetData).toHaveBeenCalledWith({ request: { table: 'configuration' } });
    expect(mockResponseObject.json).toHaveBeenCalledWith({
      name: 'Test App',
      short_name: 'Test',
      description: 'Test Description',
      start_url: '/test',
      display: 'fullscreen',
      background_color: '#123456',
      theme_color: '#654321'
    });
  });
});
