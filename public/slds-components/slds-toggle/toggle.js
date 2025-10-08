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
    checked: { type: Boolean, reflect: true },
    directionReversed: { type: Boolean, attribute: 'direction-reversed' },
    labelPosition: { type: String, attribute: 'label-position'},
    disabled: { type: Boolean, attribute: 'disabled' }
  };

  constructor() {
    super();
    this.labelPosition = 'left';
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    const toggleId = `toggle-${Math.random().toString(36).substring(2, 11)}`;
    const gridClasses = `slds-checkbox_toggle slds-grid${this.directionReversed ? ' slds-grid_reverse' : ''}`;


    const htmlLabel = html`
      <span class="slds-form-element__label slds-m-bottom_none">${this.label}</span>
    `;
    const htmlToggle = html`
          <input
              type="checkbox"
              name="${this.name}"
              id="${toggleId}"
              aria-describedby="${toggleId}"
              .checked="${this.checked}"
              @change="${this._handleToggle}"
              ?disabled="${this.disabled}"
          />
          <span class="slds-checkbox_faux_container" aria-live="assertive">
            <span class="slds-checkbox_faux"></span>
            <span class="slds-checkbox_on">${this.enabledLabel}</span>
            <span class="slds-checkbox_off">${this.disabledLabel}</span>
          </span>
    `;
    const componentArray = [];
    if (this.directionReversed && this.labelPosition === 'left') {
      componentArray.push(htmlToggle);
      componentArray.push(htmlLabel);
    } 
    if (this.directionReversed && this.labelPosition === 'right') {
      componentArray.push(htmlLabel);
      componentArray.push(htmlToggle);
    }
    if (!this.directionReversed && this.labelPosition === 'left') {
      componentArray.push(htmlLabel);
      componentArray.push(htmlToggle);
    }
    if (!this.directionReversed && this.labelPosition === 'right') {
      componentArray.push(htmlToggle);
      componentArray.push(htmlLabel);
    }

    return html`
      <div class="slds-form-element">
        <label class="${gridClasses}" for="${toggleId}">
          ${componentArray}
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
      bubbles: true
    }));
    this.requestUpdate();
  }
}

// Define the custom element
customElements.define('slds-toggle', SLDSToggle);
