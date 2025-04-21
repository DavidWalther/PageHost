const HTML_TEMPLATE = `
<style>
  div.button-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  div.button-container-item {
    text-align: center;
    padding: 5px;
  }

  div[name="botton"] {
    background-color: transparent;
    cursor: pointer;
  }

  div.button-colors {
    background-color:hsl(0, 0.00%, 80.60%);
    color: hsl(0, 0.00%, 30.0%);
  }

  div.button-colors:hover {
    background-color: hsl(0, 0.00%, 30.0%);
    color: hsl(0, 0.00%, 80.0%);
  }

  div.button-border {
    border-color: hsl(0, 0.00%, 30.0%);
    border-style: solid;
    border-width: 2px;
    border-radius: 2px;
  }

  div.button-border:hover {
    border-color: hsl(0, 0.00%, 50.0%);
  }

  div.default-button {
    font-family: Arial, sans-serif;
    font-size: 16px;
    padding: 5px;
  }

  .center {
    display: flex;
    justify-content: center;
    align-items: center;
  }


</style>
<div >
  <div class="button-container">
    <div class="button-container-item" name="botton" role="button" tabindex="0" >
      <slot name="auth-button"></slot>
    </div>
    <div class="button-container-item">
      <button >Logout</button>
    </div>
  </div>
</div>
<template id="tpl-default-button">
  <div class="center button-colors button-border default-button"></div>
</template>
`;

class OIDCComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // ----------- getters for the attributes ----------------

  get providerEndpointOpenIdConfiguration() {
    return this.getAttribute('provider-endpoint-openid-configuration');
  }

  get serverEndpointAuthCodeExchange() {
    return this.getAttribute('server-endpoint-auth-code-exchange');
  }

  get serverEndpointAuthStateRequest() {
    return this.getAttribute('server-endpoint-auth-state-request');
  }

  get noSave() {
    return this.hasAttribute('no-save');
  }

  get buttonLabel() {
    return this.getAttribute('button-label') || 'Authenticate';
  }

  get sessionStorageKey() {
    return this.getAttribute('session-storage-key') || 'code_exchange_response';
  }

  // ----------- lifecycle hooks ----------------

  connectedCallback() {
    const providerEndpoint = this.providerEndpointOpenIdConfiguration
    const serverEndpoint = this.serverEndpointAuthCodeExchange

    this.shadowRoot.innerHTML = HTML_TEMPLATE;

    // add event listeners to authenticate button
    const button = this.shadowRoot.querySelector('div[name="botton"]');
    button.addEventListener('click', (event) => this.handleClickAuthenticate(event).bind(this));
    button.addEventListener('keydown', (event) => this.handleKeyDown(event).bind(this));

    // check if the proided slot is empty
    const slot = this.shadowRoot.querySelector('slot[name="auth-button"]');
    if (!slot.assignedNodes().length) {
      // if the slot is empty, use the default button template
      const template = this.shadowRoot.getElementById('tpl-default-button');
      const clone = document.importNode(template.content, true);
      if (this.buttonLabel) {
        clone.querySelector('div').innerText = this.buttonLabel;
      }
      button.innerHTML = '';
      button.appendChild(clone);
    }

    // Check for authorization code in URL
    let authParams = {
      auth_code: new URLSearchParams(window.location.search).get('code'),
      state: new URLSearchParams(window.location.search).get('state')
    }
    if (authParams.auth_code !== null && authParams.state !== null) {
      this.exchangeAuthCode(authParams, serverEndpoint);
    }
  }

  // ----------- event handlers ----------------


  handleClickAuthenticate(event) {
    event.preventDefault();
    event.stopPropagation();
    this.actionStartAuthentication();
  }

  handleKeyDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === ' ') {
      this.actionStartAuthentication();
    }
  }

  // ----------- actions ----------------

  actionStartAuthentication() {
    this.dispatchEvent(
      new CustomEvent('click', {
        detail: {
          callback: this.startAuthenticationFlow.bind(this)
        }
      })
    );
  }

  // Utility function to generate a random string
  generateRandomString(length = 128) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  // Utility function to generate a code challenge
  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  async startAuthenticationFlow({ client_id, redirect_uri, scope, response_type, authorization_endpoint }) {
    let state;
    if(this.serverEndpointAuthStateRequest ) {
      // if an endpoint to generate the state is provided, use it
      const stateResponse = await fetch(this.serverEndpointAuthStateRequest);
      state  = await stateResponse.json();
    } else {
      // if no endpoint is provided, generate a random state locally
      state = this.generateRandomString();
    }

    // Save the state in session storage
    sessionStorage.setItem('oidc_state', state);

    const codeVerifier = this.generateRandomString();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Save the code verifier in session storage
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);

    const parameters = {
      client_id,
      redirect_uri,
      scope: scope.join(' '),
      response_type,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    };

    if (!authorization_endpoint && this.providerEndpointOpenIdConfiguration) {
      let openIdConfiguration = await fetch(this.providerEndpointOpenIdConfiguration);
      openIdConfiguration = await openIdConfiguration.json();
      authorization_endpoint = openIdConfiguration.authorization_endpoint;
    }

    const url = `${authorization_endpoint}?${new URLSearchParams(parameters).toString()}`;
    window.location = url;
  }

  async exchangeAuthCode(exchangePayload, serverEndpoint) {
    if(sessionStorage.getItem('oidc_state') !== exchangePayload.state) {
      console.error('State mismatch. Possible CSRF attack.');
      return;
    }

    sessionStorage.removeItem('oidc_state');

    // Check if the code_verifier is present in session storage
    exchangePayload.code_verifier = sessionStorage.getItem('pkce_code_verifier');
    sessionStorage.removeItem('pkce_code_verifier');

    try {
      const response = await fetch(serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(exchangePayload)
      });

      // if status_code is 401 dispatch rejected event
      if (response.status === 401) {
        this.dispatchEvent(new CustomEvent('rejected', { detail: { error: 'Unauthorized' } }));
        return;
      }
      // if status_code is 400 dispatch rejected event
      if (response.status === 400) {
        this.dispatchEvent(new CustomEvent('rejected', { detail: { error: 'Bad Request' } }));
        return;
      }

      // Dispatch event with the response
      const exchange_response = await response.json();
      this.dispatchEvent(new CustomEvent('authenticated', { detail: exchange_response }));

      // Save the response in session storage
      if(this.noSave) { return; }

      let storageKey = this.sessionStorageKey;
      sessionStorage.setItem(storageKey, JSON.stringify(exchange_response));

      // Dispatch event with the storage key
      let eventPayload = {
        storage_key: storageKey,
      };
      let event = new CustomEvent('stored', {detail:eventPayload});
      this.dispatchEvent(event);

    } catch (error) {
      console.error('Error exchanging authorization code:', error);
    }
  }
}

customElements.define('oidc-component', OIDCComponent);

export default OIDCComponent;