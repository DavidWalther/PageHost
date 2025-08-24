import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

let templatePromise = null; // this variable makes sure only the first load results in an actual fetch
const templatePath = 'slds-components/slds-toggle/toggle.html';

class SLDSToggle extends LitElement {
  static properties = {
    label: { type: String },
    enabledLabel: { type: String },
    disabledLabel: { type: String },
    name: { type: String },
    checked: { type: Boolean, reflect: true }
  };

  constructor() {
    super();
    this.label = 'Toggle Label';
    this.enabledLabel = 'Enabled';
    this.disabledLabel = 'Disabled';
    this.name = 'options';
    this.checked = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    const toggleId = `toggle-${Math.random().toString(36).substring(2, 11)}`;
    
    return html`
      <div class="slds-form-element">
        <label class="slds-form-element__label" for="${toggleId}">${this.label}</label>
        <div class="slds-form-element__control">
          <span class="slds-checkbox_toggle slds-grid">
            <span class="slds-checkbox_faux_container" id="${toggleId}">
              <span class="slds-checkbox_faux"></span>
              <span class="slds-checkbox_on">${this.enabledLabel}</span>
              <span class="slds-checkbox_off">${this.disabledLabel}</span>
            </span>
            <input 
              type="checkbox" 
              name="${this.name}" 
              id="${toggleId}" 
              aria-describedby="${toggleId}"
              .checked="${this.checked}"
              @change="${this._handleToggle}"
            />
          </span>
        </div>
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
  }
}

// Define the custom element
customElements.define('slds-toggle', SLDSToggle);
