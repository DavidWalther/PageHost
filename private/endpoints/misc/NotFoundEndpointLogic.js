const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');

class NotFoundEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.NotFoundEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing 404 Not Found request', location: LOCATION});

    return new Promise((resolve) => {
      Logging.debugMessage({severity:'INFO', message: 'Executed 404 Not Found request', location: LOCATION});
      this.responseObject.status(404).send('404 Not Found');
      resolve();
    });
  }
}

module.exports = NotFoundEndpointLogic;
