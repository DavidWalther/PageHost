import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class OIDCComponent extends LitElement {
  static properties = {
    'provider-endpoint-openid-configuration': { type: String },
    'server-endpoint-auth-code-exchange': { type: String },
    'server-endpoint-auth-state-request': { type: String },
    'no-save': { type: Boolean },
    'button-label': { type: String },
    'session-storage-key': { type: String },
    'auth-code': { type: String },
    'auth-state': { type: String },
    _isSessionStored: { type: Boolean, state: true },
    _showLoginButton: { type: Boolean, state: true },
    _showLogoutButton: { type: Boolean, state: true },
  };

  static styles = css`
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
  `;
  constructor() {
    super();
    this._isSessionStored = false;
    this._showLoginButton = true;
    this._showLogoutButton = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
    
    this._updateSessionState();
    this._checkAuthParams();
    this.dispatchEvent(new CustomEvent('ready', {}));
  }

  render() {
    return html`
      <div>
        <div class="button-container">
          <div name="botton-login" class="button-container-item ${this._showLoginButton ? '' : 'hidden'}" role="button" tabindex="0">
            ${this._renderLoginButton()}
          </div>
          <div name="button-logout" class="button-container-item ${this._showLogoutButton ? '' : 'hidden'}">
            ${this._renderLogoutButton()}
          </div>
        </div>
      </div>
    `;
  }

  _renderLoginButton() {
    return html`
      <slot name="auth-button-login" @click=${this.handleClickAuthenticate} @keydown=${this.handleKeyDown}>
        <button @click=${this.handleClickAuthenticate} @keydown=${this.handleKeyDown} tabindex="1">
          ${this.buttonLabel}
        </button>
      </slot>
    `;
  }

  _renderLogoutButton() {
    return html`
      <slot name="auth-button-logout" @click=${this.handleClickLogout}>
        <button @click=${this.handleClickLogout} tabindex="1">
          Logout
        </button>
      </slot>
    `;
  }

  _updateSessionState() {
    this._isSessionStored = this.isSessionStored;
    if (this._isSessionStored) {
      this._showLoginButton = false;
      this._showLogoutButton = true;
    } else {
      this._showLoginButton = true;
      this._showLogoutButton = false;
    }
  }

  _checkAuthParams() {
    const serverEndpoint = this.serverEndpointAuthCodeExchange;
    const authParams = {
      auth_code: new URLSearchParams(window.location.search).get('code'),
      state: new URLSearchParams(window.location.search).get('state')
    };
    
    if (authParams.auth_code !== null && authParams.state !== null) {
      this.exchangeAuthCode(authParams, serverEndpoint);
    }
  }

  // ----------- getters for the attributes ----------------

  get providerEndpointOpenIdConfiguration() {
    return this['provider-endpoint-openid-configuration'];
  }

  get serverEndpointAuthCodeExchange() {
    return this['server-endpoint-auth-code-exchange'];
  }

  get serverEndpointAuthStateRequest() {
    return this['server-endpoint-auth-state-request'];
  }

  get noSave() {
    return this['no-save'];
  }

  get buttonLabel() {
    return this['button-label'] || 'Authenticate';
  }

  get sessionStorageKey() {
    return this['session-storage-key'] || 'code_exchange_response';
  }

  get authCode() {
    return this['auth-code'];
  }

  get authState() {
    return this['auth-state'];
  }

  get isSessionStored() {
    let storedValue = sessionStorage.getItem(this.sessionStorageKey);
    return !!storedValue;
  }

  /**
   * This method is to start the authentication flow from outside the component.
   */
  startAuthCodeExchange() {
    const serverEndpoint = this.serverEndpointAuthCodeExchange;
    const authParams = {
      auth_code: this.authCode || new URLSearchParams(window.location.search).get('code'),
      state: this.authState || new URLSearchParams(window.location.search).get('state')
    };

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
    sessionStorage.removeItem(this.sessionStorageKey);
    this._showLogoutButton = false;
    this._showLoginButton = true;
    this.requestUpdate();
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

      switch (response.status) {
        case 200:
          // Handle success
          this.handleSuccess(response);
          break;
        case 400:
          // Handle bad request
          this.dispatchEvent(new CustomEvent('rejected', { detail: { error: 'Bad Request' } }));
          break;
        case 401:
          // Handle unauthorized
          this.dispatchEvent(new CustomEvent('rejected', { detail: { error: 'Unauthorized' } }));
          break;
        case 403:
          // Handle forbidden
          this.dispatchEvent(new CustomEvent('rejected', { detail: { error: 'Forbidden' } }));
          break;
        case 500:
          // Handle server error
          this.dispatchEvent(new CustomEvent('rejected', { detail: { error: 'Server Error' } }));
          break;
        default:
          console.error('Unexpected response status:', response.status);
      }
    } catch (error) {
      console.error('Error during authentication:', error);
      this.dispatchEvent(new CustomEvent('rejected', { detail: { error: 'Network Error' } }));
    }
  }

  async handleSuccess(response) {
    // Hide the login button and show the logout button
    this._showLoginButton = false;
    this._showLogoutButton = true;

    // Dispatch event with the response
    const exchange_response = await response.json();
    this.dispatchEvent(new CustomEvent('authenticated', { detail: exchange_response }));
    
    // Save the response in session storage
    if (this.noSave) { 
      this.requestUpdate();
      return; 
    }

    let storageKey = this.sessionStorageKey;
    sessionStorage.setItem(storageKey, JSON.stringify(exchange_response));

    // Dispatch event with the storage key
    let eventPayload = {
      storage_key: storageKey,
    };
    let event = new CustomEvent('stored', { detail: eventPayload });
    this.dispatchEvent(event);
    
    this.requestUpdate();
  }
}

customElements.define('oidc-component', OIDCComponent);

export default OIDCComponent;