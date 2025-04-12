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
    const { auth_code, code_verifier } = this.requestObject.body;

    if (!auth_code ){
      this.responseObject.status(400).json({ error: 'Invalid code' });
      Logging.debugMessage({ severity: 'INFO', message: `Missing authentication code`, location: LOCATION });
      return;
    }  
    if(!code_verifier) {
      this.responseObject.status(400).json({ error: 'Invalid code' });
      Logging.debugMessage({ severity: 'INFO', message: `Missing code verifier`, location: LOCATION });
      return;
    }


    // ====== Check if the auth_code is already used - Start ======
    /**
     * Save the auth_code in the cache to prevent replay attacks. 
     * The Cache stores 'used-auth-codes.*'-keys for 20 minutes.
     */
    let cache = new DataCache2(this.environment); // instantiate the cache-module
    let auth_code_cache_key = 'used-auth-codes.' + auth_code; // generate a unique cache key for the auth_code
    let usedAuthCodesCacheKeyGenerator = await cache.get(auth_code_cache_key); // try to get the auth_code from the cache
    if ( usedAuthCodesCacheKeyGenerator ) {
      // If the auth_code was actually found in the cache, it means it was already used
      this.responseObject.status(401).json({ error: 'Authentication code already used' });
      Logging.debugMessage({ severity: 'INFO', message: `Authentication code already used`, location: LOCATION });
      return;
    }
    await cache.set(auth_code_cache_key, true);
    // ====== Check if the auth_code is already used - End =======


    const oidcClient = new OpenIdConnectClient().setRedirectUri(HOST)
      .setClientId(this.environment.GOOGLE_CLIENT_ID)
      .setClientSecret(this.environment.GOOGLE_CLIENT_SECRET)
      .setWellKnownEndpoint(GOOGLE_ENDPOINT_WELLKNOWN)
      .setCodeVerifier(code_verifier); // Set the code verifier for PKCE


    await oidcClient.exchangeAuthorizationCode(auth_code)
    .then(tokenResponse => {
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
    })
    .catch(error => {
      Logging.debugMessage({ severity: 'INFO', message: `Error during token exchange: ${error}`, location: LOCATION });
      this.responseObject.status(400).json({ error: 'Bad Request' });
    });
    Logging.debugMessage({ severity: 'INFO', message: `Code exchange completed`, location: LOCATION });
    return this.responseObject;
  }
}

module.exports = CodeExchangeEndpoint;
