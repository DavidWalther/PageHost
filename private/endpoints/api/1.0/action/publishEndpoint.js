const { EndpointLogic } = require('../../../EndpointLogic.js');
const { Logging } = require('../../../../modules/logging.js');
const { DataFacade } = require('../../../../database2/DataFacade.js');

class PublishEndpoint extends EndpointLogic {
  async execute() {
    const LOCATION = 'PublishEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION });

    const environmentAllowedDmls = this.environment.APPLICATION_ACTIVE_ACTIONS || '[]';
    let allowedDmls = JSON.parse(environmentAllowedDmls).map(permission => permission.toLowerCase());
    Logging.debugMessage({ severity: 'INFO', message: `Parsed allowed DMLs: ${JSON.stringify(allowedDmls)}`, location: LOCATION });
    this._allowedDmls = new Set(allowedDmls);

    try {
      // check whether publish is allowed in application settings
      if (!this.isAllowedPublish) {
        Logging.debugMessage({ severity: 'INFO', message: 'Permission denied for publish operation', location: LOCATION });
        this.responseObject.status(403).json({ success: false, error: 'Permission denied' });
        return;
      }

      // 1. Input validation
      if (!this.validateInput()) {
        this.responseObject.status(400).json({ success: false, error: 'Invalid request data' });
        return;
      }

      // 2. Extract payload from request body
      const { object, id } = this.requestObject.body;

      // 3. Get record to check if it exists and current publish status
      const existingRecord = await this.getRecord(object, id);
      if (!existingRecord) {
        this.responseObject.status(404).json({ success: false, error: 'Record not found' });
        return;
      }

      // 4. Check if already published
      if (existingRecord.publishDate) {
        this.responseObject.status(400).json({ success: false, error: 'Record is already published' });
        return;
      }

      // 5. Update publishDate to NOW
      await this.publishRecord(object, id);

      // 6. Success response
      this.responseObject.status(200).json({ success: true });

    } catch (error) {
      Logging.debugMessage({severity:'ERROR', message: `Operation failed: ${error.message}`, location: LOCATION});
      this.responseObject.status(500).json({ success: false, error: error.message });
    }
  }

  get isAllowedPublish() {
    const LOCATION = 'PublishEndpoint.isAllowedPublish';
    Logging.debugMessage({ severity: 'FINEST', message: `Checking if publish is allowed`, location: LOCATION });
    return this._allowedDmls.has('publish');
  }

  validateInput() {
    const LOCATION = 'PublishEndpoint.validateInput';

    if (!this.requestObject.body) {
      Logging.debugMessage({ severity: 'INFO', message: 'Missing request body', location: LOCATION });
      return false;
    }

    const { object, id } = this.requestObject.body;

    if (!object || typeof object !== 'string') {
      Logging.debugMessage({ severity: 'INFO', message: 'Missing or invalid object parameter', location: LOCATION });
      return false;
    }

    if (!id || typeof id !== 'string') {
      Logging.debugMessage({ severity: 'INFO', message: 'Missing or invalid id in payload', location: LOCATION });
      return false;
    }

    // Validate that object is one of the supported table types
    const supportedObjects = ['paragraph', 'chapter', 'story'];
    if (!supportedObjects.includes(object.toLowerCase())) {
      Logging.debugMessage({ severity: 'INFO', message: `Unsupported object type: ${object}`, location: LOCATION });
      return false;
    }

    return true;
  }

  async getRecord(object, id) {
    const LOCATION = 'PublishEndpoint.getRecord';

    try {
      const dataFacade = new DataFacade(this.environment).setSkipCache(true);

      const result = await dataFacade.getData({
        request: {
          table: object.toLowerCase(),
          id: id
        }
      });

      return result;

    } catch (error) {
      Logging.debugMessage({severity:'ERROR', message: `Failed to get record: ${error.message}`, location: LOCATION});
      throw error;
    }
  }

  async publishRecord(object, id) {
    const LOCATION = 'PublishEndpoint.publishRecord';

    try {
      const dataFacade = new DataFacade(this.environment).setSkipCache(true);

      const updateData = {
        object: object.toLowerCase(),
        payload: {
          id: id,
          publishDate: new Date().toISOString()
        }
      };

      const result = await dataFacade.updateData(updateData);

      Logging.debugMessage({ severity: 'INFO', message: `Record published successfully: ${object} ${id}`, location: LOCATION });

      return result;

    } catch (error) {
      Logging.debugMessage({severity:'ERROR', message: `Failed to publish record: ${error.message}`, location: LOCATION});
      throw error;
    }
  }
}

module.exports = PublishEndpoint;
