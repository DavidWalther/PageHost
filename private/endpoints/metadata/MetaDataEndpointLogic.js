const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const { DataFacade } = require('../../database2/DataFacade');
const { DataCleaner } = require('../../modules/DataCleaner');

class MetaDataEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.MetaDataEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing metadata query', location: LOCATION});

    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'configuration'
    };

    let dataFacade = new DataFacade(this.environment);
    return new Promise((resolve) => {
      dataFacade.getData(parameterObject).then(metadata => {
        Logging.debugMessage({severity:'FINER', message: `Metadata returned`, location: LOCATION});

        let dataCleaner = new DataCleaner();
        dataCleaner.removeApplicationKeys(metadata); // Clean data here

        this.responseObject.json(metadata);
        resolve();
      });
    });
  }
}

module.exports = MetaDataEndpointLogic;
