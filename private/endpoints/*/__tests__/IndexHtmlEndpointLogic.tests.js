const IndexHtmlEndpointLogic = require('../IndexHtmlEndpointLogic');
const { Logging } = require('../../../modules/logging');

jest.mock('../../../modules/logging');

describe('IndexHtmlEndpointLogic', () => {
  let indexHtmlEndpointLogic;
  let mockResponseObject;
  let mockRequestObject;

  beforeEach(() => {
    mockRequestObject = { url: '/test-url' };
    mockResponseObject = {
      send: jest.fn()
    };
    indexHtmlEndpointLogic = new IndexHtmlEndpointLogic();
    indexHtmlEndpointLogic.setRequestObject(mockRequestObject).setResponseObject(mockResponseObject);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should deliver index.html with correct content', async () => {
    await indexHtmlEndpointLogic.execute();

    expect(mockResponseObject.send).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
    expect(mockResponseObject.send).toHaveBeenCalledWith(expect.stringContaining('<meta charset="UTF-8">'));
    expect(mockResponseObject.send).toHaveBeenCalledWith(expect.stringContaining('<meta name="viewport" content="width=device-width, initial-scale=1">'));
    expect(mockResponseObject.send).toHaveBeenCalledWith(expect.stringContaining('<script src="index.js"></script>'));
    expect(mockResponseObject.send).toHaveBeenCalledWith(expect.stringContaining('<body onload="initializeApp()"></body>'));
  });
});
