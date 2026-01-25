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
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  connectedCallback() {
    super.connectedCallback();
  }

  render() {
    // will be called to generate new html
    return html``;
  }

  updated(changedProperties) {
    // is called on changen of ab attribute
    super.updated(changedProperties);
  }

  disconnectedCallback() {
  }
}

customElements.define('custom-login-component', LoginComponent);

