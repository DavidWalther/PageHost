import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

let templatePromise = null; // this variable makes sure only the first load results in an actual fetch
const templatePath = 'slds-components/slds-toggle/toggle.html';

class SLDSToggle extends LitElement {
  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    return html`
      <div class="slds-form-element">
        <label class="slds-form-element__label" for="toggle-1">Toggle Label</label>
        <div class="slds-form-element__control">
          <span class="slds-checkbox_toggle slds-grid">
            <span class="slds-checkbox_faux_container" id="toggle-1">
              <span class="slds-checkbox_faux"></span>
              <span class="slds-checkbox_on">Enabled</span>
              <span class="slds-checkbox_off">Disabled</span>
            </span>
            <input type="checkbox" name="options" id="toggle-1" aria-describedby="toggle-1" />
          </span>
        </div>
      </div>
    `;
  }
}

// Define the custom element
customElements.define('slds-toggle', SLDSToggle);
