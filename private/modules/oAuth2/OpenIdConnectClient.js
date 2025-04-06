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
      grant_type: 'authorization_code'
    };

    await this.executeCalloutWellKnownConfig();

    return fetch(this._tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(token_parameters)
    })
    .then(response => response.json());
  }

  decodeIdToken(id_token) {
    const [header, payload, signature] = id_token.split('.');

    const decodeBase64Url = (str) => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const buffer = Buffer.from(base64, 'base64');
      return buffer.toString('utf-8');
    };
    // console.log('recieved header:', header);
    let decodedHeader = decodeBase64Url(header);
    // console.log('recieved decodedHeader:', decodedHeader);
    let parsedHeader = JSON.parse(decodedHeader);
    // console.log('recieved parsedHeader:', parsedHeader);

    return {
      header: parsedHeader,
      payload: JSON.parse(decodeBase64Url(payload)),
      signature: decodeBase64Url(signature)
    };
  }
}

module.exports = OpenIdConnectClient;