const { Logging } = require('../../../modules/logging');
const {EndpointLogic} = require('../../EndpointLogic');
const {DataFacade} = require('../../../database2/DataFacade');

class ChapterEndpoint extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.ChapterEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing chapter query', location: LOCATION});

    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'chapter',
      id: this.requestObject.query.id
    };

    let dataFacade = new DataFacade(this.environment);
    return dataFacade.getData(parameterObject).then(chapter => {
      Logging.debugMessage({severity:'FINER', message: `Chapter returned`, location: LOCATION});
      this.responseObject.json(chapter);
    });
  }
}

module.exports = {ChapterEndpoint};