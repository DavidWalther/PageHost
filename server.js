const { Environment } = require('./private/modules/environment.js');
const express = require('express');

const {Logging} = require('./private/modules/logging.js');
const { DataQueryLogicFactory } = require('./private/endpoints/DataQueryLogicFactory.js');
const WildcardLogicFactory = require('./private/endpoints/WildcardLogicFactory.js');
const MetadataEndpointLogicFactory = require('./private/endpoints/MetadataEndpointLogicFactory.js');
const { EnvironmentVariablesEndpoint } = require('./private/endpoints/api/1.0/environmetVariables.js');
const crypto = require('crypto');
const CodeExchangeEndpoint = require('./private/endpoints/api/1.0/auth/oAuth2/CodeExchangeEndpoint.js');
const RequestAuthStateEndpoint = require('./private/endpoints/api/1.0/auth/oAuth2/requestAuthStateEndpoint.js');
const LogoutEndpoint = require('./private/endpoints/api/1.0/auth/LogoutEndpoint.js');
const AccessTokenService = require('./private/modules/oAuth2/AccessTokenService.js');

const environment = new Environment().getEnvironment();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use('/assets', express.static('node_modules/@salesforce-ux/design-system/assets'));

const stateCache = new Map(); // In-memory cache for state values

function generateRandomState(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

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

/**
 * This endpoint provides the frontend with the necessary configuration without exposing sensitive data.
 */
app.get('/api/1.0/env/variables', (req, res) => {
  const LOCATION = 'Server.get(\'/api/1.0/env/variables\')';

  Logging.debugMessage({ severity: 'INFO', message: `Request received - ${req.url}`, location: LOCATION });

  const endpoint = new EnvironmentVariablesEndpoint();
  endpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute().then(() => {
    Logging.debugMessage({ severity: 'FINER', message: `Environment Variables Endpoint executed`, location: LOCATION });
  });
});

app.get('/api/1.0/oAuth2/requestAuthState', async (req, res) => {
  const LOCATION = 'Server.get(\'/api/1.0/oAuth2/requestAuthState\')';
  Logging.debugMessage({ severity: 'INFO', message: `Request received - ${req.url}`, location: LOCATION });

  const endpoint = new RequestAuthStateEndpoint();
  endpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute().then(() => {
    Logging.debugMessage({ severity: 'FINER', message: `RequestAuthState Endpoint executed`, location: LOCATION });
  });
});

app.post('/api/1.0/oAuth2/codeexchange', async (req, res) => {
  const LOCATION = 'Server.post(\'/api/1.0/oAuth2/codeexchange\')';
  Logging.debugMessage({ severity: 'INFO', message: `Request received - ${req.url}`, location: LOCATION });

  const endpoint = new CodeExchangeEndpoint();
  endpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute().then(() => {
    Logging.debugMessage({ severity: 'FINER', message: `Code Exchange Endpoint executed`, location: LOCATION });
  });
});

app.get('/api/1.0/auth/logout', async (req, res) => {
  const LOCATION = 'Server.get(\'/api/1.0/auth/logout\')';
  Logging.debugMessage({ severity: 'INFO', message: 'Logout request received', location: LOCATION });

  const endpoint = new LogoutEndpoint();
  endpoint.setEnvironment(environment).setRequestObject(req).setResponseObject(res).execute().then(() => {
    Logging.debugMessage({ severity: 'FINER', message: `Logout Endpoint executed`, location: LOCATION });
  });
});

app.post('/api/1.0/data/change/*', async (req, res) => {
  const LOCATION = '/api/1.0/data/change/*';
  Logging.debugMessage({ severity: 'FINER', message: `Request received - params: ${JSON.stringify(req.params)}`, location: LOCATION });

  console.log('Request received - headers:', req.headers);

  let bearerToken = req.headers['authorization'];
  if(!bearerToken) {
    console.log('Bearer token not found in headers');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  bearerToken = bearerToken.split(' ')[1];

  const accessTokenService = new AccessTokenService().setEnvironment(environment);
  const isValidBearer = await accessTokenService.isBearerValid(bearerToken);

  if (!isValidBearer) {
    console.log('Invalid bearer token');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  Logging.debugMessage({ severity: 'FINER', message: `Bearer token is valid`, location: LOCATION });


  res.status(200).json({ message: 'Data changed' });
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
