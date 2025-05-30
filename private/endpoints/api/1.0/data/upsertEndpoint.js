const { EndpointLogic } = require('../../../EndpointLogic.js');
const { Logging } = require('../../../../modules/logging.js');
const { DataFacade } = require('../../../../database2/DataFacade.js');

class UpsertEndpoint extends EndpointLogic {
  async execute() {
    const LOCATION = 'UpsertEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION });

    const environentAllowedDmls = this.environment.APPLICATION_ACTIVE_DMLS || '[]';
    let allowedDmls = JSON.parse(environentAllowedDmls).map(permission => permission.toLowerCase());
    Logging.debugMessage({ severity: 'INFO', message: `Parsed allowed DMLs: ${JSON.stringify(allowedDmls)}`, location: LOCATION });
    this._allowedDmls = new Set(allowedDmls);

    let data = this.requestObject.body;

    if(!data || !data.payload) {
      Logging.debugMessage({ severity: 'INFO', message: 'Invalid request data', location: LOCATION });
      this.responseObject.status(400).json({ success: false, error: 'Invalid request data' });
      return;
    }


    let dmlUseCase;
    if(!data.payload.id) {
      dmlUseCase = 'create';
    } else {
      dmlUseCase = 'update';
    }

    Logging.debugMessage({ severity: 'INFO', message: `DML Use Case: ${dmlUseCase}`, location: LOCATION });

    switch (dmlUseCase) {
      case 'create': {
        if (!this.isAllowedCreate) {
          Logging.debugMessage({ severity: 'INFO', message: 'Permission denied for create operation', location: LOCATION });
          this.responseObject.status(403).json({ success: false, error: 'Permission denied' });
          return;
        }
        // Proceed with create operation
        let result = await this.excuteCreate();

        Logging.debugMessage({ severity: 'INFO', message: 'Create operation completed successfully', location: LOCATION });
        break;
      }
      case 'update': {
        if (!this.isAllowedEdit) {
          Logging.debugMessage({ severity: 'INFO', message: 'Permission denied for update operation', location: LOCATION });
          this.responseObject.status(403).json({ success: false, error: 'Permission denied' });
          return;
        }
        // Proceed with update operation
        await this.executeUpdate();
        Logging.debugMessage({ severity: 'INFO', message: 'Update operation completed successfully', location: LOCATION });
        break;
      }
      default: {
        Logging.debugMessage({ severity: 'INFO', message: 'Invalid DML use case', location: LOCATION });
        this.responseObject.status(400).json({ success: false, error: 'Invalid DML use case' });
        return;
      }
    }
  }

  async executeUpdate() {
    const LOCATION = 'UpsertEndpoint.executeUpdate';
    Logging.debugMessage({ severity: 'INFO', message: `Executing update operation`, location: LOCATION });

    try {
      Logging.debugMessage({ severity: 'INFO', message: 'Upsert operation started', location: LOCATION });

      const data = this.requestObject.body; // Assuming data is sent in the request body

      let dataFacade = new DataFacade(this.environment).setSkipCache(true);
      let result = await dataFacade.updateData(data);

      this.responseObject.status(200).json({ success: true, result });
      Logging.debugMessage({ severity: 'INFO', message: 'Upsert operation completed successfully', location: LOCATION });
    } catch (error) {
      Logging.debugMessage({ severity: 'ERROR', message: `Upsert operation failed: ${error.message}`, location: LOCATION });
      this.responseObject.status(500).json({ success: false, error: error.message });
    }
  }

  async excuteCreate() {
    const LOCATION = 'UpsertEndpoint.executeCreate';
    Logging.debugMessage({ severity: 'INFO', message: `Executing create operation`, location: LOCATION });

    try {
      Logging.debugMessage({ severity: 'INFO', message: 'Upsert operation started', location: LOCATION });

      const data = this.requestObject.body; // Assuming data is sent in the request body
      data.payload.applicationIncluded = this.environment.APPLICATION_APPLICATION_KEY;

      let dataFacade = new DataFacade(this.environment).setSkipCache(true);
      let result = await dataFacade.createData(data);

      this.responseObject.status(200).json({ success: true, result });
      Logging.debugMessage({ severity: 'INFO', message: 'Upsert operation completed successfully', location: LOCATION });
    } catch (error) {
      Logging.debugMessage({ severity: 'ERROR', message: `Upsert operation failed: ${error.message}`, location: LOCATION });
      this.responseObject.status(500).json({ success: false, error: error.message });
    }
  }

  get isAllowedEdit() {
    const LOCATION = 'UpsertEndpoint.isAllowedEdit';
    Logging.debugMessage({ severity: 'FINEST', message: `Checking if edit is allowed`, location: LOCATION });
    return this._allowedDmls.has('edit');
  }
  get isAllowedCreate() {
    const LOCATION = 'UpsertEndpoint.isAllowedCreate';
    Logging.debugMessage({ severity: 'FINEST', message: `Checking if create is allowed`, location: LOCATION });
    return this._allowedDmls.has('create');
  }
}

module.exports = UpsertEndpoint;
