const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const NotFoundEndpointLogic = require('../misc/NotFoundEndpointLogic');

class SitemapEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.SitemapEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing sitemap.xml request', location: LOCATION});
    Logging.debugMessage({severity:'INFO', message: 'Redirecting to 404 Not Found request', location: LOCATION});

    const notFoundEndpoint = new NotFoundEndpointLogic();
    return notFoundEndpoint.setEnvironment(this.environment).setRequestObject(this.requestObject).setResponseObject(this.responseObject).execute();
  }
}

module.exports = SitemapEndpointLogic;
