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

  button {
    border: 0px;
    background: lightgray;
    padding: 5px;
    border-radius: 5px;
    box-shadow: 0px 0px 3px 0;
    cursor: pointer;
  }

  .hidden {
    display: none;
  }

</style>
<div >
  <div class="button-container">
    <div name="botton-login" class="button-container-item" role="button" tabindex="0" >
      <slot name="auth-button-login"></slot>
    </div>
    <div name="button-logout" class="button-container-item">
      <slot name="auth-button-logout"></slot>
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

  get isSessionStored() {
    let storedValue = sessionStorage.getItem(this.sessionStorageKey);
    if (!storedValue) {
      return false;
    }
    return true;
  }

  // ----------- lifecycle hooks ----------------

  connectedCallback() {
    const providerEndpoint = this.providerEndpointOpenIdConfiguration
    const serverEndpoint = this.serverEndpointAuthCodeExchange

    this.shadowRoot.innerHTML = HTML_TEMPLATE;

    this.createButton_Login();
    this.createButton_Logout();

    // Check for authorization code in URL
    let authParams = {
      auth_code: new URLSearchParams(window.location.search).get('code'),
      state: new URLSearchParams(window.location.search).get('state')
    }
    if (authParams.auth_code !== null && authParams.state !== null) {
      this.exchangeAuthCode(authParams, serverEndpoint);
    }

    if(this.isSessionStored) {
      // if the session storage is not empty, show the logout button
      this.hideLoginButton();
      this.showLogoutButton();
    } else {
      // if the session storage is empty, show the login button
      this.showLoginButton();
      this.hideLogoutButton();
    }
  }

  // ----------- event handlers ----------------


  handleClickAuthenticate(event) {
    event.preventDefault();
    event.stopPropagation();
    this.actionStartAuthentication();
  }

  handleClickLogout(event) {
    event.preventDefault();
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('logout', { detail: {
      callback: this.logoutCallback.bind(this)
    } }));
  }

  handleKeyDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === ' ') {
      this.actionStartAuthentication();
    }
  }

  // ----------- actions ----------------

  logoutCallback() {
    sessionStorage.removeItem(this.sessionStorageKey)
    this.hideLogoutButton();
    this.showLoginButton();
  }

  createButton_Logout() {
    const buttonContainer = this.shadowRoot.querySelector('div[name="button-logout"]');
    let slot = buttonContainer.querySelector('slot');

    // === identify wheather the slot is empty or not ===
    let button_logout;
    if (!slot.assignedNodes().length) {
      // there is nothing defined in the slot.
      // a default button must be created
      button_logout = document.createElement('button')
      button_logout.innerText = 'Logout';
      button_logout.tabIndex = 1;
      buttonContainer.innerHTML = '';
      buttonContainer.appendChild(button_logout);
    }
    else {
      // there is something defined in the slot.
      // the slot must be used
      button_logout = slot.assignedNodes()[0];
    }

    // === add event listeners to the button ===
    button_logout.addEventListener('click', (event) => this.handleClickLogout(event));
  }

  createButton_Login() {
    const buttonContainer = this.shadowRoot.querySelector('div[name="botton-login"]');
    let slot = buttonContainer.querySelector('slot');
    // === identify wheather the slot is empty or not ===
    let button_login;
    if (!slot.assignedNodes().length) {
      // there is nothing defined in the slot.
      // a default button must be created
      button_login = document.createElement('button')
      button_login.innerText = this.buttonLabel;
      button_login.tabIndex = 1;
      buttonContainer.innerHTML = '';
      buttonContainer.appendChild(button_login);
    }
    else {
      // there is something defined in the slot.
      // the slot must be used
      button_login = slot.assignedNodes()[0];
    }
    // === add event listeners to the button ===
    button_login.addEventListener('click', (event) => this.handleClickAuthenticate(event));
    button_login.addEventListener('keydown', (event) => this.handleKeyDown(event));
  }

  showLoginButton() {
    const buttonContainer = this.shadowRoot.querySelector('div[name="botton-login"]');
    const buttonLogin = buttonContainer.querySelector('button');
    buttonLogin.classList.remove('hidden');
  }
  hideLoginButton() {
    const buttonContainer = this.shadowRoot.querySelector('div[name="botton-login"]');
    const buttonLogin = buttonContainer.querySelector('button');
    buttonLogin.classList.add('hidden');
  }
  showLogoutButton() {
    const buttonContainer = this.shadowRoot.querySelector('div[name="button-logout"]');
    const buttonLogout = buttonContainer.querySelector('button');
    buttonLogout.classList.remove('hidden');
  }
  hideLogoutButton() {
    const buttonContainer = this.shadowRoot.querySelector('div[name="button-logout"]');
    const buttonLogout = buttonContainer.querySelector('button');
    buttonLogout.classList.add('hidden');
  }

  // Action to start the authentication flow
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
      
      // Hide the login button and show the logout button
      this.hideLoginButton();
      this.showLogoutButton();

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