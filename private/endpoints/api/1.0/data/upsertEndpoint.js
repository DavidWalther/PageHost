const { EndpointLogic } = require('../../../EndpointLogic.js');
const { Logging } = require('../../../../modules/logging.js');

class UpsertEndpoint extends EndpointLogic {
  async execute() {
    const LOCATION = 'UpsertEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION });

    const environentAllowedDmls = this.environment.APPLICATION_ACTIVE_DMLS || '[]';
    Logging.debugMessage({ severity: 'INFO', message: `Environment variable APPLICATION_ACTIVE_DMLS: ${environentAllowedDmls}`, location: LOCATION });
    let allowedDmls = JSON.parse(environentAllowedDmls).map(permission => permission.toLowerCase());
    Logging.debugMessage({ severity: 'INFO', message: `Parsed allowed DMLs: ${JSON.stringify(allowedDmls)}`, location: LOCATION });
    allowedDmls = new Set(allowedDmls);
    Logging.debugMessage({ severity: 'INFO', message: `Allowed DMLs: ${JSON.stringify(allowedDmls)}`, location: LOCATION });

    let isAllowed_edit = allowedDmls.has('edit');
    Logging.debugMessage({ severity: 'INFO', message: `isAllowed_edit: ${isAllowed_edit}`, location: LOCATION });

    if (!isAllowed_edit) {
      Logging.debugMessage({ severity: 'INFO', message: 'Permission denied for edit operation', location: LOCATION });
      this.responseObject.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    try {
      Logging.debugMessage({ severity: 'INFO', message: 'Upsert operation started', location: LOCATION });

      const data = this.requestObject.body; // Assuming data is sent in the request body
      const result = await this.performUpsert(data);

      this.responseObject.status(200).json({ success: true, result });
      Logging.debugMessage({ severity: 'INFO', message: 'Upsert operation completed successfully', location: LOCATION });
    } catch (error) {
      Logging.debugMessage({ severity: 'ERROR', message: `Upsert operation failed: ${error.message}`, location: LOCATION });
      this.responseObject.status(500).json({ success: false, error: error.message });
    }
  }

  async performUpsert(data) {
    // Implement the actual upsert logic here
    // Example: Interact with a database or other services
    return { message: 'Upsert logic executed', data };
  }
}

module.exports = UpsertEndpoint;
