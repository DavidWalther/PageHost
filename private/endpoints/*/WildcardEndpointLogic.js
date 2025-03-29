const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');

const RELATIVE_FILE_PATH = '/private/endpoints/*';
const ABSOLUTE_FILE_PATH = __dirname;

class WildcardEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.WildcardEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing wildcard logic', location: LOCATION});

    return new Promise((resolve) => {
      Logging.debugMessage({severity:'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION});
      Logging.debugMessage({severity:'FINER', message: 'Executed wildcard request', location: LOCATION});

      let indexPath = ABSOLUTE_FILE_PATH.replace(RELATIVE_FILE_PATH, '') + '/public/index.html';
      this.responseObject.sendFile(indexPath);
      resolve();
    });
  }
}

module.exports = WildcardEndpointLogic
