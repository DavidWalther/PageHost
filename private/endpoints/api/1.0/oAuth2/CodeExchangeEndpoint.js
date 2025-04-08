const { Logging } = require('../../../../modules/logging');
const OpenIdConnectClient = require('../../../../modules/oAuth2/OpenIdConnectClient');
const { DataCache2 } = require('../../../../database2/DataCache/DataCache.js');
const crypto = require('crypto');

const GOOGLE_ENDPOINT_WELLKNOWN = 'https://accounts.google.com/.well-known/openid-configuration';

class CodeExchangeEndpoint {
  constructor() {
    this.environment = null;
    this.requestObject = null;
    this.responseObject = null;
  }

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

  async execute() {
    const LOCATION = 'CodeExchangeEndpoint.execute';
    Logging.debugMessage({ severity: 'INFO', message: `Executing code exchange`, location: LOCATION });

    const HOST = this.environment.HOST || `${this.requestObject.protocol}://${this.requestObject.get('host')}`;
    const { auth_code } = this.requestObject.body;

    if (!auth_code) {
      this.responseObject.status(400).json({ error: 'Missing authentication code' });
      Logging.debugMessage({ severity: 'INFO', message: `Missing authentication code`, location: LOCATION });
      return;
    }

    let cache = new DataCache2(this.environment);
    let auth_code_cache_key = 'used-auth-codes.' + auth_code;
    let usedAuthCodesCacheKeyGenerator = await cache.get(auth_code_cache_key);

    if ( usedAuthCodesCacheKeyGenerator ) {
      this.responseObject.status(401).json({ error: 'Authentication code already used' });
      Logging.debugMessage({ severity: 'INFO', message: `Authentication code already used`, location: LOCATION });
      return;
    }
    await cache.set(auth_code_cache_key, true);

    const oidcClient = new OpenIdConnectClient().setRedirectUri(HOST)
      .setClientId(process.env.GOOGLE_CLIENT_ID)
      .setClientSecret(process.env.GOOGLE_CLIENT_SECRET)
      .setWellKnownEndpoint(GOOGLE_ENDPOINT_WELLKNOWN);

    const tokenResponse = await oidcClient.exchangeAuthorizationCode(auth_code);

    if (tokenResponse.error) {
      this.responseObject.status(401).json(tokenResponse);
      return;
    }

    const [tokenHeader, tokenPayload] = tokenResponse.id_token.split('.').map(part => Buffer.from(part, 'base64').toString());
    const randomToken = crypto.randomBytes(128).toString('hex');

    const response = {
      server_token: randomToken,
      providerResponse: {
        providedInfo: tokenResponse,
        tokenPayload: JSON.parse(tokenPayload)
      }
    };

    this.responseObject.json(response);
  }
}

module.exports = CodeExchangeEndpoint;
