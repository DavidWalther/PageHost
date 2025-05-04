const { Logging } = require('../../../modules/logging');
const {EndpointLogic} = require('../../EndpointLogic');
const {DataFacade} = require('../../../database2/DataFacade');

class ParagraphEndpoint extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.ParagraphEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing paragraph query', location: LOCATION});

    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'paragraph',
      id: this.requestObject.query.id
    };
    if(this.scopes?.has('edit')) {
      parameterObject.request.publishDate = null;
    }

    let dataFacade = new DataFacade(this.environment);
    return dataFacade.setScopes(this.scopes).getData(parameterObject).then(paragraph => {
      Logging.debugMessage({severity:'FINER', message: `Paragraph returned`, location: LOCATION});
      this.responseObject.json(paragraph);
    });
  }
}

module.exports = {ParagraphEndpoint};