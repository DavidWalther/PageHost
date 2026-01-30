import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import OIDCComponent from "/modules/oIdcComponent.js";

class LoginComponent extends LitElement {

  //===========================
  // LIT - Methods
  //===========================

  static properties = {
  };

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    // will be called to generate new html
    return html`
      <div id="container-login" class="slds-col slds-text-align_right slds-size_1-of-1">
        <button id="button-login" ?hidden=${this.isLoggedIn} @click="${this.handleClickShowLoginModal}">Login</button>
      </div>

      <div id="container-logout" class="slds-col slds-text-align_right slds-size_1-of-1">
        <button id="button-logout" ?hidden=${!this.isLoggedIn} @click="${this.handleClickLogout}">Logout</button>
      </div>

      <slds-modal headless footless>
        <div>
          <oidc-component
            provider-endpoint-openid-configuration="https://accounts.google.com/.well-known/openid-configuration"
            server-endpoint-auth-code-exchange="/api/1.0/oAuth2/codeexchange"
            server-endpoint-auth-state-request="/api/1.0/oAuth2/requestAuthState"
            button-label="Login with Google"
            @authenticated="${this.handleOIDCAuthenticated}"
            @click="${this.handleOIDCClick}"
            @logout="${this.handleLogout}"
            @rejected="${this.handleAuthenticationRejection}"
          >
            <button slot="auth-button-login">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google G logo" width="24" height="24">
            </button>
          </oidc-component>
        </div>
      </slds-modal>
    `;
  }

  updated(changedProperties) {
    // is called on changen of ab attribute
    super.updated(changedProperties);
  }

  disconnectedCallback() {
  }

  //===========================
  // Event handlers
  //===========================

  handleClickShowLoginModal() {
    this.showLoginModal();
  }

  handleClickLogout() {
    this.startLogout();
  }

  // =========== Getter / Setter ==============

  get isLoggedIn() {
    let accessToken = sessionStorage.getItem('code_exchange_response');
    return accessToken !== null;
  }

  // =========== Authentication - Start =================

  saveAuthParameterToStorage() {
    let queryParameters = window.location.search.substring(1).split('&').reduce((aggregate, current) => {
      let temp = current.split('=');
      aggregate[temp[0]] = temp[1];
      return aggregate;
    },{});

    if(!queryParameters.code && !queryParameters.state) { return; }
    let authParameters = {
      code: queryParameters.code,
      state: queryParameters.state
    };
    sessionStorage.setItem('authParameters', JSON.stringify(authParameters));
  }

  async getGoogleAuthConfig() {
    return new Promise((resolve) => {
      fetch('/api/1.0/env/variables')
      .then(response => response.json())
      .then(variables => {
        resolve(variables.auth.google);
      });
    });
  }

  async handleOIDCAuthenticated(event) {
    /**
     * Do something with the authentication result
     * For example, you can store the token in local storage or session storage
     */
    this.clearUrlParameter();

    this.requestUpdate();
  }

  async handleOIDCClick(event) {
    this.hideLoginModal();
    const callback = event.detail.callback;
    const googleAuthConfig = await this.getGoogleAuthConfig();

    callback({
      client_id: googleAuthConfig.clientId,
      redirect_uri: googleAuthConfig.redirect_uri,
      scope: googleAuthConfig.scope,
      response_type: googleAuthConfig.response_type,
    });
  }

  async handleLogout(event) {
    this.hideLoginModal();
    let logoutCallback = event.detail.callback;
    let accessToken = sessionStorage.getItem('code_exchange_response');
    if(!accessToken) { return; }

    accessToken = JSON.parse(accessToken);
    const authHeader = 'Bearer ' + accessToken.authenticationResult.access.access_token;
    await fetch('/api/1.0/auth/logout', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    }).then(() => {
      this.fireToast('Logout successful', 'success');
      logoutCallback();
      this.requestUpdate();
    });
  }

  handleAuthenticationRejection() {
    this.fireToast('Authentication failed', 'error');
    // clear history
    window.history.replaceState({}, '', window.location.pathname);
  }

  // ============  Authentication -End ============

  //===========================
  // Actions
  //===========================

  startLogout() {
    this.shadowRoot.querySelector('oidc-component').logout();
  }

  showLoginModal() {
    let modalCmp = this.shadowRoot.querySelector('slds-modal');
    modalCmp.show();
  }

  hideLoginModal() {
    let modalCmp = this.shadowRoot.querySelector('slds-modal');
    modalCmp.hide();
  }

  clearUrlParameter() {
    window.history.replaceState({}, '', window.location.origin);
  }

  fireToast(message, variant) {
    this.dispatchEvent(
      new CustomEvent('toast', {
      detail: {
        message: message,
        variant: variant
      },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('custom-login-module', LoginComponent);

