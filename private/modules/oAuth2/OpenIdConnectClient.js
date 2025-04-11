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


    let promisArray = [];
    promisArray.push(fetch(this._tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(token_parameters)
    }));
    promisArray.push(fetch(openIdConfig.jwks_uri));
    
    let exchangeResult = await Promise.all(promisArray)
    .then(responseArray => {
      let jsonPromiseArray = [];
      jsonPromiseArray.push(responseArray[0].json());
      jsonPromiseArray.push(responseArray[1].json());
      return Promise.all(jsonPromiseArray);
    })
    .then(jsonArray => {
      let exchangeResponse = jsonArray[0];
      let jwskKendpointResponse = jsonArray[1];

      let decodedIdToken = this.decodeIdToken(exchangeResponse.id_token);
      console.log('Decoded ID Token');
      console.table(decodedIdToken.header);

      console.log('publicKey');
      console.table(jwskKendpointResponse.keys);

      return exchangeResponse;
/*
      let matching_jwksKey = jwskKendpointResponse.keys.find(key => {
        return key.kid === decodedIdToken.header.kid;
      });

      if (!matching_jwksKey) {
        console.error('No matching JWKs key found for the given kid');
        return;
      }
*/
    });

    return exchangeResult;

    // let exchangeResponse = await fetch(this._tokenEndpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded'
    //   },
    //   body: new URLSearchParams(token_parameters)
    // })
    // .then(response => response.json());

    // let jwskKendpointResponse = await fetch(openIdConfig.jwks_uri)
    // .then(response => response.json());


    // let decodedIdToken = this.decodeIdToken(exchangeResponse.id_token);

    // console.log('Decoded ID Token');
    // console.table(decodedIdToken.header);


    // let matching_jwksKey = jwskKendpointResponse.keys.find(key => {
    //   return key.kid === decodedIdToken.header.kid;
    // });

    // if (!matching_jwksKey) {
    //   console.error('No matching JWKs key found for the given kid');
    //   return;
    // }
    
    // return exchangeResponse;
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