const { Logging } = require('../../../modules/logging');
const {EndpointLogic} = require('../../EndpointLogic');
const { DataFacade } = require('../../../database2/DataFacade');

class SingleStoryEndpoint extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.SingleStoryEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing single story query', location: LOCATION});

    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'story',
      id: this.requestObject.query.id
    };

    let dataFacade = new DataFacade(this.environment);
    return dataFacade.getData(parameterObject).then(story => {
      Logging.debugMessage({severity:'FINER', message: `Story returned`, location: LOCATION});
      this.responseObject.json(story);
    });
  }
}

module.exports = {SingleStoryEndpoint};
