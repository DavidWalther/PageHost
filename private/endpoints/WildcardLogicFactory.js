const { Logging } = require('../modules/logging');
const WildcardEndpointLogic = require('./*/WildcardEndpointLogic');
const NotFoundEndpointLogic = require('./misc/NotFoundEndpointLogic');
const ManifestEndpointLogic = require('./*/ManifestEndpointLogic');
const RobotsEndpointLogic = require('./*/RobotsEndpointLogic');
const FaviconEndpointLogic = require('./*/FaviconEndpointLogic');
const SitemapEndpointLogic = require('./*/SitemapEndpointLogic');

class WildcardLogicFactory {
  static getProduct(requestObject) {
    const LOCATION = 'Server.WildcardLogicFactory.getProduct';
    const url = requestObject.url;
    Logging.debugMessage({severity:'INFO', message: `Url: ${url}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Params: ${JSON.stringify(requestObject.params)}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Query: ${JSON.stringify(requestObject.query)}`, location: LOCATION });
    const query = requestObject.params[0];

    switch (query) {
      case 'favicon.ico':
        return new FaviconEndpointLogic();
      case 'robots.txt':
        return new RobotsEndpointLogic();
      case 'sitemap.xml':
        return new SitemapEndpointLogic();
      case 'manifest.json':
        return new ManifestEndpointLogic();
      default:
        return new WildcardEndpointLogic(); // Will later be replaced with a 404
    }
  }
}

module.exports = WildcardLogicFactory;
