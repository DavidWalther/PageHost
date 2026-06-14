import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

class SettingsModal extends LitElement {
  //===========================
  // LIT - Methods
  //===========================

  labels = {
    modalTitle: 'Einstellungen',
    placeholder: 'Hier folgen die Einstellungen.',
  };

  static properties = {};

  static styles = css`
    /* Add component-specific styles here */
  `;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    return html`
      <slds-modal title="${this.labels.modalTitle}" footless>
        <slot>
          <div class="slds-align_absolute-center slds-p-around_medium">
            <span>${this.labels.placeholder}</span>
          </div>
        </slot>
      </slds-modal>
    `;
  }

  //===========================
  // Actions
  //===========================

  show() {
    this.shadowRoot.querySelector('slds-modal').show();
  }

  hide() {
    this.shadowRoot.querySelector('slds-modal').hide();
  }
}

customElements.define('custom-settings-modal', SettingsModal);
