const { Logging } = require('../modules/logging');
const ManifestEndpointLogic = require('./metadata/MetaDataEndpointLogic');
const IndexHtmlEndpointLogic = require('./*/IndexHtmlEndpointLogic');

class MetadataEndpointLogicFactory {
  static getProduct(requestObject) {
    const LOCATION = 'Server.MetadataEndpointLogicFactory.getProduct';
    const url = requestObject.url;
    Logging.debugMessage({severity:'INFO', message: `Url: ${url}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Params: ${JSON.stringify(requestObject.params)}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Query: ${JSON.stringify(requestObject.query)}`, location: LOCATION });
    const query = requestObject.params[0];

    let urlParts = url.split('/');

    switch (urlParts[1]) {
      case 'metadata':
        return new ManifestEndpointLogic();
      default:
        return new IndexHtmlEndpointLogic(); // Will later be replaced with a 'Bad Request'
    }
  }
}

module.exports = MetadataEndpointLogicFactory;