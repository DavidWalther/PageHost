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

    let dataFacade = new DataFacade(this.environment);
    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'chapter',
      id: this.requestObject.query.id
    };

    if(this.scopes?.has('edit')) {
      parameterObject.request.publishDate = null;
      dataFacade.setSkipCache(true);
    }

    return dataFacade.getData(parameterObject).then(chapter => {
      Logging.debugMessage({severity:'FINER', message: `Chapter returned`, location: LOCATION});
      this.responseObject.json(chapter);
    });
  }
}

module.exports = {ChapterEndpoint};