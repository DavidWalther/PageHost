const { Logging } = require('../../../modules/logging');
const {EndpointLogic} = require('../../EndpointLogic');

class FallbackEndpoint extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.FallbackEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing fallback logic', location: LOCATION});

    return new Promise((resolve) => {
      Logging.debugMessage({severity:'FINER', message: 'No Matching Table found', location: LOCATION});
      const result = { message: 'No Matching Table found' };
      this.responseObject.json(result);
      resolve();
    });
  }
}

module.exports = { FallbackEndpoint };
