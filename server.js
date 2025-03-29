// server.js

const { Environment } = require('./private/modules/environment.js');
const express = require('express');

const {Logging} = require('./private/modules/logging.js');
const { DataQueryLogicFactory } = require('./private/endpoints/DataQueryLogicFactory.js');
const WildcardLogicFactory = require('./private/endpoints/WildcardLogicFactory.js');
const MetadataEndpointLogicFactory = require('./private/endpoints/MetadataEndpointLogicFactory.js');

const environment = new Environment().getEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use('/assets', express.static('node_modules/@salesforce-ux/design-system/assets'));

function handleWildcardRequest(req, res, LOCATION) {
  Logging.debugMessage({severity:'INFO', message: `Request received - ${req.url}`, location: LOCATION});
  res.sendFile(__dirname + '/public/index.html');
}

app.get('/metadata', (req, res) => {
  const LOCATION = 'Server.get(\'/metadata\')';

  Logging.debugMessage({severity:'INFO', message: `Metadata Request received - ${req.url}`, location: LOCATION});

  let selectedEndpoint = MetadataEndpointLogicFactory.getProduct(req);
  selectedEndpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute().then(() => {
    Logging.debugMessage({severity:'FINER', message: `Metadata Endpoint executed`, location: LOCATION});
  });
});

app.get('/data/query/*', (req, res) => {
  const LOCATION = 'Server.get(\'/data/query/*\')';

  Logging.debugMessage({severity:'FINER', message: `Request received - params: ${JSON.stringify(req.params)}`, location: LOCATION});
  Logging.debugMessage({severity:'FINER', message: `Request received - query: ${JSON.stringify(req.query)}`, location: LOCATION});

  const selectedEndpoint = DataQueryLogicFactory.getProduct(req);

  Logging.debugMessage({severity:'FINER', message: `Selected Endpoint: ${selectedEndpoint.getClassName()}`, location: LOCATION});

  selectedEndpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute().then(() => {
    Logging.debugMessage({severity:'FINER', message: `Endpoint executed`, location: LOCATION});
  }).catch(error => {
    Logging.debugMessage({severity:'FINER', message: `Error executing endpoint: ${error}`, location: LOCATION});
    handleWildcardRequest(req, res, LOCATION);
  });
});

app.get('/*', (req, res) => {
  const LOCATION = 'Server.get(\'/*\')';

  const selectedEndpoint = WildcardLogicFactory.getProduct(req);

  Logging.debugMessage({severity:'FINER', message: `Request url: ${req.url}`, location: LOCATION});
  Logging.debugMessage({severity:'FINER', message: `Request params: ${JSON.stringify(req.params)}`, location: LOCATION});
  Logging.debugMessage({severity:'FINER', message: `Selected Endpoint: ${selectedEndpoint.getClassName()}`, location: LOCATION});

  selectedEndpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute().then(() => {
    Logging.debugMessage({severity:'FINER', message: `Endpoint executed`, location: LOCATION});
  }).catch(error => {
    Logging.debugMessage({severity:'FINER', message: `Error executing endpoint: ${error}`, location: LOCATION});
    handleWildcardRequest(req, res, LOCATION);
  });
});

app.listen(PORT, () => {
  const environment = new Environment();
  const Application_Key = environment.getEnvironment().APPLICATION_APPLICATION_KEY;
  Logging.debugMessage({severity:'INFO', message: `Application Key: ${Application_Key}`, location: 'Server.listen'});
  const env = environment.getEnvironment();
  const LOCATION = 'Server.listen';
  Logging.debugMessage({severity:'INFO', message: `Server running on port ${PORT}`, location: LOCATION});
});
