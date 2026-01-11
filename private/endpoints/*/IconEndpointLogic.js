const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const { DataFacade } = require('../../database2/DataFacade');

class IconEndpointLogic extends EndpointLogic {
  constructor() {
    super();
    this.iconHeight = 92;
    this.iconWidth = 92;
  }

  setHeight(newHeight) {
    if( !newHeight ) return;
    this.iconHeight = newHeight;

    return this;
  }

  setWidth( newWidth ) {
    if( !newWidth ) return;
    this.iconWidth = newWidth;

    return this;
  }

  async execute() {
    const LOCATION = 'Server.IconEndpointLogic.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing icon request', location: LOCATION});

    let parameterObject = {};
    parameterObject.returnPromise = true;
    parameterObject.request = {
      table: 'configuration',
    };

    let dataFacade = new DataFacade(this.environment);
    return new Promise((resolve) => {
        dataFacade.getData(parameterObject).then(configuration => {

        let height = this.iconHeight;
        let width = this.iconWidth;

        // Set the proper Content-Type based on the requested file
        const requestedPath = this.requestObject.params[0];
        this.responseObject.setHeader('Content-Type', 'image/svg+xml');

	let svgBody = configuration.icon.icons;
	svgBody = svgBody.replace('${height}', this.iconHeight);
	svgBody = svgBody.replace('${width}', this.iconWidth);
	
        this.responseObject.send(svgBody);
        resolve();
      });
    });
  }
}

module.exports = IconEndpointLogic;

