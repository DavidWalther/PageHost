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

    Logging.debugMessage({
      severity: 'INFO',
      message: 'Executing service worker request',
      location: LOCATION,
    });

    try {
      // Get version from environment variable
      const appVersion = this.environment.APPLICATION_SERVICEWORKER_VERSION;

      Logging.debugMessage({
        severity: 'FINEST',
        message: `APPLICATION_SERVICEWORKER_VERSION from environment: ${appVersion}`,
        location: LOCATION,
      });

      // Read service worker template
      const swTemplatePath = path.join(__dirname, '../../../public/sw.js');
      const swTemplate = fs.readFileSync(swTemplatePath, 'utf8');

      // Replace version placeholder
      const swContent = swTemplate.replace(
        /\{\{APPLICATION_SERVICEWORKER_VERSION\}\}/g,
        appVersion
      );

      // Set appropriate headers
      this.responseObject.setHeader('Content-Type', 'application/javascript');
      this.responseObject.setHeader(
        'Cache-Control',
        'no-cache, no-store, must-revalidate'
      );
      this.responseObject.setHeader('Pragma', 'no-cache');
      this.responseObject.setHeader('Expires', '0');

      // Send the processed service worker
      this.responseObject.send(swContent);

      Logging.debugMessage({
        severity: 'INFO',
        message: `Service worker served with version ${appVersion}`,
        location: LOCATION,
      });
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        message: `Error serving service worker: ${error.message}`,
        location: LOCATION,
      });
      this.responseObject.status(500).send('Error generating service worker');
    }
  }
}

module.exports = { ServiceWorkerEndpointLogic };
