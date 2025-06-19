const { EndpointLogic } = require('../../../EndpointLogic.js');
const { Logging } = require('../../../../modules/logging.js');
const { DataFacade } = require('../../../../database2/DataFacade.js');

class DeleteEndpoint extends EndpointLogic {
  async execute() {
    const LOCATION = 'DeleteEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION });

    const environentAllowedDmls = this.environment.APPLICATION_ACTIVE_ACTIONS || '[]';
    let allowedDmls = JSON.parse(environentAllowedDmls).map(permission => permission.toLowerCase());
    Logging.debugMessage({ severity: 'INFO', message: `Parsed allowed DMLs: ${JSON.stringify(allowedDmls)}`, location: LOCATION });
    this._allowedDmls = new Set(allowedDmls);

    const { object, id } = this.requestObject.query;
    if (!object || !id) {
      Logging.debugMessage({ severity: 'INFO', message: 'Missing object or id in query', location: LOCATION });
      this.responseObject.status(400).json({ success: false, error: 'Missing object or id' });
      return;
    }

    if (!this.isAllowedDelete) {
      Logging.debugMessage({ severity: 'INFO', message: 'Permission denied for delete operation', location: LOCATION });
      this.responseObject.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    try {
      let dataFacade = new DataFacade(this.environment).setSkipCache(true);
      await dataFacade.deleteData({ object, id });
      this.responseObject.status(200).json({ success: true });
      Logging.debugMessage({ severity: 'INFO', message: 'Delete operation completed successfully', location: LOCATION });
    } catch (error) {
      Logging.debugMessage({ severity: 'ERROR', message: `Delete operation failed: ${error.message}`, location: LOCATION });
      this.responseObject.status(500).json({ success: false, error: error.message });
    }
  }

  get isAllowedDelete() {
    const LOCATION = 'DeleteEndpoint.isAllowedDelete';
    Logging.debugMessage({ severity: 'FINEST', message: `Checking if delete is allowed`, location: LOCATION });
    return this._allowedDmls.has('delete');
  }
}

module.exports = DeleteEndpoint;
