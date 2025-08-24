import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

let templatePromise = null; // this variable makes sure only the first load results in an actual fetch
const templatePath = 'slds-components/slds-toggle/toggle.html';

class SLDSToggle extends LitElement {
  static properties = {
    label: { type: String },
    enabledLabel: { type: String, attribute: 'enabled-label' },
    disabledLabel: { type: String, attribute: 'disabled-label' },
    name: { type: String },
    checked: { type: Boolean, reflect: true }
  };

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    const toggleId = `toggle-${Math.random().toString(36).substring(2, 11)}`;

    return html`
      <div class="slds-form-element">
        <label class="slds-checkbox_toggle slds-grid" for="${toggleId}">
          <span class="slds-form-element__label slds-m-bottom_none">${this.label}</span>
          <input
              type="checkbox"
              name="${this.name}"
              id="${toggleId}"
              aria-describedby="${toggleId}"
              .checked="${this.checked}"
              @change="${this._handleToggle}"
          />
          <span class="slds-checkbox_faux_container" aria-live="assertive">
            <span class="slds-checkbox_faux"></span>
            <span class="slds-checkbox_on">${this.enabledLabel}</span>
            <span class="slds-checkbox_off">${this.disabledLabel}</span>
          </span>
        </label>
      </div>
    `;
  }

  _handleToggle(event) {
    this.checked = event.target.checked;

    // Dispatch custom event for external listeners
    this.dispatchEvent(new CustomEvent('toggle', {
      detail: {
        checked: this.checked,
        name: this.name
      },
      composed: true,
      bubbles: true
    }));
    this.requestUpdate();
  }
}

// Define the custom element
customElements.define('slds-toggle', SLDSToggle);
