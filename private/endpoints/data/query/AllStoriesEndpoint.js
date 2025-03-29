const { Logging } = require('../../../modules/logging');
const { EndpointLogic } = require('../../EndpointLogic');
const { DataFacade } = require('../../../database2/DataFacade');
const { DataCleaner } = require('../../../modules/DataCleaner');

class AllStoriesEndpoint extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.AllStoriesEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing all stories query', location: LOCATION});

    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'story',
      id: null
    };

    let dataFacade = new DataFacade(this.environment);
    return dataFacade.getData(parameterObject).then(stories => {
      Logging.debugMessage({severity:'FINER', message: `Stories returned`, location: LOCATION});
      
      let dataCleaner = new DataCleaner();
      dataCleaner.removeApplicationKeys(stories); // Clean data here

      this.responseObject.json(stories);
    });
  }
}

module.exports = {AllStoriesEndpoint};