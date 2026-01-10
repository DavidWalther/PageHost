const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const { DataFacade } = require('../../database2/DataFacade');

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
    return new Promise((resolve) => {
        dataFacade.getData(parameterObject).then(configuration => {

        resolve();
      });
    });
  }
}

module.exports = FaviconEndpointLogic;
