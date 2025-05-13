const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const { DataFacade } = require('../../database2/DataFacade');

class ManifestEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.ManifestEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing manifest.json request', location: LOCATION});

    const dataFacade = new DataFacade(this.environment);
    const configuration = await dataFacade.getData({ request: { table: 'configuration' } });

    let manifest = {};
    // set Default values
    manifest.name = 'Default manifest name';
    manifest.short_name = 'DefMani';
    manifest.description = "Default manifest description";
    manifest.start_url =  "/";
    manifest.display = "standalone";
    manifest.background_color = "#ffffff";
    manifest.theme_color = "#000000";
    manifest.icons = [];

    // check if configuration is defined
    if(!configuration.manifest) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest configuration is NOT defined`, location: LOCATION});
      this.responseObject.json(manifest);

      Logging.debugMessage({severity:'INFO', message: 'Executed manifest.json request', location: LOCATION});
      return;
    }
    Logging.debugMessage({severity:'FINEST', message: `Manifest configuration is defined`, location: LOCATION});

    // override default values if defined in configuration
    if(configuration.manifest.name !== undefined) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest name is defined in configuration: ${configuration.manifest.name}`, location: LOCATION});
      manifest.name = configuration.manifest.name;
    }
    if(configuration.manifest.short_name !== undefined) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest short_name is defined in configuration: ${configuration.manifest.short_name}`, location: LOCATION});
      manifest.short_name = configuration.manifest.short_name;
    }
    if(configuration.manifest.description !== undefined) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest description is defined in configuration: ${configuration.manifest.description}`, location: LOCATION});
      manifest.description = configuration.manifest.description;
    }
    if(configuration.manifest.start_url !== undefined) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest start_url is defined in configuration: ${configuration.manifest.start_url}`, location: LOCATION});
      manifest.start_url = configuration.manifest.start_url;
    }
    if(configuration.manifest.display !== undefined) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest display is defined in configuration: ${configuration.manifest.display}`, location: LOCATION});
      manifest.display = configuration.manifest.display;
    }
    if(configuration.manifest.background_color !== undefined) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest background_color is defined in configuration: ${configuration.manifest.background_color}`, location: LOCATION});
      manifest.background_color = configuration.manifest.background_color;
    }
    if(configuration.manifest.theme_color !== undefined) {
      Logging.debugMessage({severity:'FINEST', message: `Manifest theme_color is defined in configuration: ${configuration.manifest.theme_color}`, location: LOCATION});
      manifest.theme_color = configuration.manifest.theme_color;
    }
    this.responseObject.json(manifest);

    Logging.debugMessage({severity:'INFO', message: 'Executed manifest.json request', location: LOCATION});
  }
}

module.exports = ManifestEndpointLogic;
