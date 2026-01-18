const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const fs = require('fs');
const path = require('path');

class ServiceWorkerEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.ServiceWorkerEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing service worker request', location: LOCATION});

    try {
      // Get version from environment variable
      const appVersion = this.environment.APP_VERSION;
      
      // Debug logging
      Logging.debugMessage({severity:'INFO', message: `APP_VERSION from environment: ${appVersion}`, location: LOCATION});

      // Read service worker template
      const swTemplatePath = path.join(__dirname, '../../../public/sw.js');
      const swTemplate = fs.readFileSync(swTemplatePath, 'utf8');
      
      // Debug: Check if placeholder exists in template
      Logging.debugMessage({severity:'INFO', message: `Template contains placeholder: ${swTemplate.includes('{{APP_VERSION}}')}`, location: LOCATION});

      // Replace version placeholder
      const swContent = swTemplate.replace(/\{\{APP_VERSION\}\}/g, appVersion);
      
      // Debug: Check if replacement worked
      Logging.debugMessage({severity:'INFO', message: `Replacement successful: ${!swContent.includes('{{APP_VERSION}}')}`, location: LOCATION});

      // Set appropriate headers
      this.responseObject.setHeader('Content-Type', 'application/javascript');
      this.responseObject.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      this.responseObject.setHeader('Pragma', 'no-cache');
      this.responseObject.setHeader('Expires', '0');

      // Send the processed service worker
      this.responseObject.send(swContent);

      Logging.debugMessage({severity:'INFO', message: `Service worker served with version ${appVersion}`, location: LOCATION});
    } catch (error) {
      Logging.debugMessage({severity:'ERROR', message: `Error serving service worker: ${error.message}`, location: LOCATION});
      this.responseObject.status(500).send('Error generating service worker');
    }
  }
}

module.exports = ServiceWorkerEndpointLogic;