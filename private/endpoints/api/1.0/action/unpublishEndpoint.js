const { EndpointLogic } = require('../../../EndpointLogic.js');
const { Logging } = require('../../../../modules/logging.js');
const { DataFacade } = require('../../../../database2/DataFacade.js');

/**
 * UnpublishEndpoint handles unpublishing of records by setting their publishDate to null
 * 
 * Request format:
 * {
 *   "object": "paragraph|chapter|story",
 *   "id": "record-id"
 * }
 * 
 * Response format:
 * Success (200): { "success": true }
 * Error (400/404/500): { "success": false, "error": "error message" }
 */
class UnpublishEndpoint extends EndpointLogic {

  /**
   * Main execution method
   * Validates input, checks record existence and publish status, then unpublishes the record
   */
  async execute() {
    const LOCATION = 'UnpublishEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION });

    try {
      // 1. Input validation
      if (!this.validateInput()) {
        Logging.debugMessage({ severity: 'INFO', message: 'Invalid request data', location: LOCATION });
        this.responseObject.status(400).json({ success: false, error: 'Invalid request data' });
        return;
      }

      // 2. Extract payload from request body
      const { object, id } = this.requestObject.body;

      // 3. Get record to check if it exists and current publish status
      const existingRecord = await this.getRecord(object, id);
      if (!existingRecord) {
        Logging.debugMessage({ severity: 'INFO', message: 'Record not found', location: LOCATION });
        this.responseObject.status(404).json({ success: false, error: 'Record not found' });
        return;
      }

      // 4. Check if already unpublished
      if (!existingRecord.publishdate) {
        Logging.debugMessage({ severity: 'INFO', message: 'Record is already unpublished', location: LOCATION });
        this.responseObject.status(400).json({ success: false, error: 'Record is already unpublished' });
        return;
      }

      // 5. Update publishDate to null
      await this.unpublishRecord(object, id);

      // 6. Success response
      this.responseObject.status(200).json({ success: true });

    } catch (error) {
      Logging.debugMessage({severity:'ERROR', message: `Operation failed: ${error.message}`, location: LOCATION});
      this.responseObject.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Validates the request input
   * @returns {boolean} true if input is valid, false otherwise
   */
  validateInput() {
    const LOCATION = 'UnpublishEndpoint.validateInput';

    // Check request body exists
    if (!this.requestObject.body) {
      Logging.debugMessage({ severity: 'INFO', message: 'Missing request body', location: LOCATION });
      return false;
    }

    const { object, id } = this.requestObject.body;

    // Validate object parameter
    if (!object || typeof object !== 'string') {
      Logging.debugMessage({ severity: 'INFO', message: 'Missing or invalid object parameter', location: LOCATION });
      return false;
    }

    // Validate id parameter
    if (!id || typeof id !== 'string') {
      Logging.debugMessage({ severity: 'INFO', message: 'Missing or invalid id in payload', location: LOCATION });
      return false;
    }

    // Validate supported object types
    const supportedObjects = ['paragraph', 'chapter', 'story'];
    if (!supportedObjects.includes(object.toLowerCase())) {
      Logging.debugMessage({ severity: 'INFO', message: `Unsupported object type: ${object}`, location: LOCATION });
      return false;
    }

    return true;
  }

  /**
   * Retrieves a record from the database with cache skipping
   * @param {string} object - The object type (paragraph, chapter, story)
   * @param {string} id - The record ID
   * @returns {Promise<Object|null>} The record if found, null otherwise
   */
  async getRecord(object, id) {
    const LOCATION = 'UnpublishEndpoint.getRecord';

    try {
      // Create DataFacade instance with cache skipping enabled
      const dataFacade = new DataFacade(this.environment).setSkipCache(true);

      // Fetch the record
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

  /**
   * Unpublishes a record by setting publishDate to null
   * @param {string} object - The object type (paragraph, chapter, story)
   * @param {string} id - The record ID
   * @returns {Promise<Object>} The update result
   */
  async unpublishRecord(object, id) {
    const LOCATION = 'UnpublishEndpoint.unpublishRecord';

    try {
      // Create DataFacade instance with cache skipping enabled
      const dataFacade = new DataFacade(this.environment).setSkipCache(true);

      // Prepare update data with null publishDate
      const updateData = {
        object: object.toLowerCase(),
        payload: {
          id: id,
          publishDate: null
        }
      };

      // Execute the update
      const result = await dataFacade.updateData(updateData);

      Logging.debugMessage({ severity: 'INFO', message: `Record unpublished successfully: ${object} ${id}`, location: LOCATION });

      return result;

    } catch (error) {
      Logging.debugMessage({severity:'ERROR', message: `Failed to unpublish record: ${error.message}`, location: LOCATION});
      throw error;
    }
  }
}

module.exports = UnpublishEndpoint;
