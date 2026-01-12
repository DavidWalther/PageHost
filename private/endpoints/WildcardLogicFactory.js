const { Logging } = require('../modules/logging');
const IndexHtmlEndpointLogic = require('./*/IndexHtmlEndpointLogic');
const NotFoundEndpointLogic = require('./misc/NotFoundEndpointLogic');
const ManifestEndpointLogic = require('./*/ManifestEndpointLogic');
const RobotsEndpointLogic = require('./*/RobotsEndpointLogic');
const FaviconEndpointLogic = require('./*/FaviconEndpointLogic');
const IconEndpointLogic = require('./*/IconEndpointLogic');
const SitemapEndpointLogic = require('./*/SitemapEndpointLogic');

class WildcardLogicFactory {
  static getProduct(requestObject) {
    const LOCATION = 'Server.WildcardLogicFactory.getProduct';
    const url = requestObject.url;
    Logging.debugMessage({severity:'INFO', message: `Url: ${url}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Params: ${JSON.stringify(requestObject.params)}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Query: ${JSON.stringify(requestObject.query)}`, location: LOCATION });
    let query = requestObject.params[0];
    query = query.toLowerCase();

    switch (query) {
      case 'favicon.ico':
      case 'favicon.svg':
        return new FaviconEndpointLogic();
      case 'icon-192.svg':
        return new IconEndpointLogic().setHeight(192).setWidth(192);
      case 'icon-512.svg':
        return new IconEndpointLogic().setHeight(512).setWidth(512);
      case 'robots.txt':
        return new RobotsEndpointLogic();
      case 'sitemap.xml':
        return new SitemapEndpointLogic();
      case 'manifest.json':
        return new ManifestEndpointLogic();
      case 'index.html':
        return new IndexHtmlEndpointLogic();
      default:
        return new IndexHtmlEndpointLogic(); // Will later be replaced with a 404
    }
  }
}

module.exports = WildcardLogicFactory;
