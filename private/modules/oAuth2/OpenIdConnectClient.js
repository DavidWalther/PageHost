const jwt = require('jsonwebtoken');
const rsaPemFromModExp = require('rsa-pem-from-mod-exp');

class OpenIdConnectClient {
  constructor() {}

  setClientId(clientId) {
    this._clientId = clientId;
    return this;
  }

  setClientSecret(clientSecret) {
    this._clientSecret = clientSecret;
    return this;
  }

  setRedirectUri(redirectUri) {
    this._redirectUri = redirectUri;
    return this;
  }

  setWellKnownEndpoint(wellKnownEndpoint) {
    this._wellKnownEndpoint = wellKnownEndpoint;
    return this;
  }

  setAuthorizationEndpoint(authorizationEndpoint) {
    this._authorizationEndpoint = authorizationEndpoint;
    return this;
  }

  setUserInfoEndpoint(userInfoEndpoint) {
    this._userInfoEndpoint = userInfoEndpoint;
    return this;
  }

  setTokenEndpoint(tokenEndpoint) {
    this._tokenEndpoint = tokenEndpoint;
    return this;
  }

  setCodeVerifier(codeVerifier) {
    this._codeVerifier = codeVerifier;
    return this;
  }

  async executeCalloutWellKnownConfig() {
    return new Promise((resolve, reject) => {
      if(!this._wellKnownEndpoint) {
        reject('Well Known Endpoint is not set');
        return;
      }

      fetch(this._wellKnownEndpoint)
      .then(response => response.json())
      .then(wellKnownConfig => {
        this._wellKnownConfig = wellKnownConfig;

        // console.log('wellKnownConfig.authorization_endpoint:', wellKnownConfig.authorization_endpoint);
        this.setAuthorizationEndpoint(wellKnownConfig.authorization_endpoint);

        // console.log('wellKnownConfig.token_endpoint:', wellKnownConfig.token_endpoint);
        this.setTokenEndpoint(wellKnownConfig.token_endpoint);

        // console.log('wellKnownConfig.userinfo_endpoint:', wellKnownConfig.userinfo_endpoint);
        this.setUserInfoEndpoint(wellKnownConfig.userinfo_endpoint);

        resolve(wellKnownConfig);
        return;
      })
      .catch(error => {
        reject(error);
        return;
      });
    })
  }

  async exchangeAuthorizationCode(authCode) {
    if(!authCode) { throw new Error('Authorization Code is required'); }
    if(!this._clientId) { throw new Error('Client Id is not set'); }
    if(!this._clientSecret) { throw new Error('Client Secret is not set'); }
    if(!this._redirectUri) { throw new Error('Redirect Uri is not set'); }


    const token_parameters = {
      code: authCode,
      client_id: this._clientId,
      client_secret: this._clientSecret,
      redirect_uri: this._redirectUri,
      code_verifier: this._codeVerifier,
      grant_type: 'authorization_code'
    };

    let openIdConfig = await this.executeCalloutWellKnownConfig(); // fetches the openId configuration and stores it in this._wellKnownConfig


    let exchangeResponse = await fetch(this._tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(token_parameters)
    });
    exchangeResponse = await exchangeResponse.json();
    if (exchangeResponse.error) {
      console.error('Error exchanging authorization code:', exchangeResponse.error);
      return exchangeResponse;
    }
    // Check if the id_token is present in the response
    if (!exchangeResponse.id_token) {
      console.error('No id_token found in the response');
      return { error: 'No id_token found in the response' };
    }

    let decodedIdToken = this.decodeIdToken(exchangeResponse.id_token);

    // ======== Response Validation - Start ========

    // --- simple checks of the id_token ---

    // Check if the id_token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    const clockSkew = 5; // Allow a 2 second clock skew
    if (decodedIdToken.payload.exp + clockSkew < currentTime) { // Allow a 2 second clock skew
      throw new Error('ID token is expired');
    }
    // Check if the id_token is not yet valid
    if (decodedIdToken.payload.iat - clockSkew > currentTime) {
      console.log('payload.iat:', decodedIdToken.payload.iat);
      console.log('currentTime:', currentTime);
      throw new Error('ID token is not yet valid');
    }
    // Check if the id_token is issued for the correct audience
    if (decodedIdToken.payload.iss !== openIdConfig.issuer) {
      throw new Error('Invalid issuer');
    }
    if (decodedIdToken.payload.aud !== this._clientId) {
      throw new Error('Invalid audience');
    }

    // --- complex checks using public key ---

    let jwskKendpointResponse = await fetch(openIdConfig.jwks_uri);
    jwskKendpointResponse = await jwskKendpointResponse.json();
    if (!jwskKendpointResponse.keys || jwskKendpointResponse.keys.length === 0) {
      throw new Error('No keys found in the JWKs response');
    }

    // Check if the kid in the id_token header matches any of the keys in the JWKs response
    let matching_jwksKey = jwskKendpointResponse.keys.find(key => {
      return key.kid === decodedIdToken.header.kid;
    });
    if (!matching_jwksKey) {
      throw new Error('No matching JWKs key found for the given kid');
    }

    // Verify the signature of the id_token using the public key from the JWKs response
    const modulus = matching_jwksKey.n; // Base64URL-encoded modulus
    const exponent = matching_jwksKey.e; // Base64URL-encoded exponent
    const publicKey = rsaPemFromModExp(modulus, exponent);

    try {
      const verifiedPayload = jwt.verify(exchangeResponse.id_token, publicKey, { algorithms: ['RS256'] });
      console.log('Verified ID Token Payload:', verifiedPayload);
    } catch (error) {
      throw new Error('Invalid ID token: Signature verification failed');
    }

    // ======== Response Validation - End ========

    return exchangeResponse;
  }

  decodeIdToken(id_token) {
    const [header, payload, signature] = id_token.split('.');

    const decodeBase64Url = (str) => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const buffer = Buffer.from(base64, 'base64');
      return buffer.toString('utf-8');
    };

    return {
      header: JSON.parse(decodeBase64Url(header)),
      payload: JSON.parse(decodeBase64Url(payload)),
      signature: decodeBase64Url(signature)
    };
  }
}

module.exports = OpenIdConnectClient;