const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const { DataFacade } = require('../../database2/DataFacade');
const NotFoundEndpointLogic = require('../misc/NotFoundEndpointLogic');

class FaviconEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.FaviconEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing favicon request', location: LOCATION});

    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'configuration',
      id: this.requestObject.query.id
    };

    let dataFacade = new DataFacade(this.environment);

    let configuration = await dataFacade.getData(parameterObject);

    if(!configuration.icon || !configuration.icon.favicon) {
      Logging.debugMessage({severity:'INFO', message: 'Icons are not defined', location: LOCATION});
      const notFoundEndpoint = new NotFoundEndpointLogic();
      return notFoundEndpoint.setEnvironment(this.environment).setRequestObject(this.requestObject).setResponseObject(this.responseObject).execute();
    }

    // Set the proper Content-Type based on the requested file
    const requestedPath = this.requestObject.params[0];
    if (requestedPath === 'favicon.svg') {
       this.responseObject.setHeader('Content-Type', 'image/svg+xml');
    } else if (requestedPath === 'favicon.ico') {
       this.responseObject.setHeader('Content-Type', 'image/x-icon');
    }

    this.responseObject.send(configuration.icon.favicon);
  }
}

module.exports = FaviconEndpointLogic;
