class EndpointLogic {
  constructor() {}

  setEnvironment(environment) {
    this.environment = environment;
    return this;
  }

  setRequestObject(requestObject) {
    this.requestObject = requestObject;
    return this;
  }

  setResponseObject(responseObject) {
    this.responseObject = responseObject;
    return this;
  }

  execute() {
    return new Promise((resolve, reject) => {
      reject(new Error('Method \'execute\' must be implemented'));
    });
  }

  getClassName() {
    return this.constructor.name;
  }
}

module.exports = { EndpointLogic };
