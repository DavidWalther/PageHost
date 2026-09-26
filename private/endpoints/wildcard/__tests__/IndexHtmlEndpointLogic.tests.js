const IndexHtmlEndpointLogic = require('../IndexHtmlEndpointLogic');
const { Logging } = require('../../../modules/logging');
const fs = require('fs');
const path = require('path');

jest.mock('../../../modules/logging');

describe('IndexHtmlEndpointLogic', () => {
  let indexHtmlEndpointLogic;
  let mockResponseObject;
  let mockRequestObject;

  beforeEach(() => {
    mockRequestObject = { url: '/test-url' };
    mockResponseObject = {
      send: jest.fn(),
    };
    indexHtmlEndpointLogic = new IndexHtmlEndpointLogic();
    indexHtmlEndpointLogic
      .setRequestObject(mockRequestObject)
      .setResponseObject(mockResponseObject);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should deliver index.html with correct content', async () => {
    await indexHtmlEndpointLogic.execute();

    expect(mockResponseObject.send).toHaveBeenCalledWith(
      expect.stringContaining('<!DOCTYPE html>')
    );
    expect(mockResponseObject.send).toHaveBeenCalledWith(
      expect.stringContaining('<meta charset="UTF-8">')
    );
    expect(mockResponseObject.send).toHaveBeenCalledWith(
      expect.stringContaining(
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
      )
    );
    expect(mockResponseObject.send).toHaveBeenCalledWith(
      expect.stringContaining('<script type="module" src="index.js"></script>')
    );
    expect(mockResponseObject.send).toHaveBeenCalledWith(
      expect.stringContaining('<body onload="initializeApp()"></body>')
    );
  });

  /**
   * Eine Komponente, die hier fehlt, gibt es im Browser nicht: Die Shell ist
   * die einzige Stelle, die Module laedt (es gibt keinen Bundler). Das faellt
   * sonst erst auf, wenn ein Tag stumm nichts rendert.
   */
  it('should load the content editing components', async () => {
    await indexHtmlEndpointLogic.execute();

    expect(mockResponseObject.send).toHaveBeenCalledWith(
      expect.stringContaining(
        '<script type="module" src="components/custom-content-edit/custom-content-edit.js"></script>'
      )
    );
    expect(mockResponseObject.send).toHaveBeenCalledWith(
      expect.stringContaining(
        '<script type="module" src="components/custom-content-publish/custom-content-publish.js"></script>'
      )
    );
  });

  /**
   * Every script the shell delivers must exist under `public/`. There is no
   * bundler and no build step that would notice a path that leads nowhere: the
   * browser simply fetches a 404 and the module silently never runs.
   */
  it('should only reference scripts that exist in public', async () => {
    await indexHtmlEndpointLogic.execute();

    const html = mockResponseObject.send.mock.calls[0][0];
    const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
      (match) => match[1]
    );
    const publicDir = path.join(__dirname, '../../../../public');

    expect(sources.length).toBeGreaterThan(0);

    const missing = sources.filter(
      (source) => !fs.existsSync(path.join(publicDir, source))
    );
    expect(missing).toEqual([]);
  });
});
