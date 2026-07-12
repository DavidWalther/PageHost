import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

// Gültige Größen -> SLDS-Modifier. Unbekannte/fehlende Größe -> keine Klasse.
const SIZE_CLASS_MAP = {
  'xx-small': 'slds-spinner_xx-small',
  'x-small': 'slds-spinner_x-small',
  small: 'slds-spinner_small',
  medium: 'slds-spinner_medium',
  large: 'slds-spinner_large',
};

class SldsSpinner extends LitElement {
  static properties = {
    size: { type: String }, // xx-small | x-small | small | medium | large
    container: { type: Boolean }, // Overlay slds-spinner_container
    // `hidden` ist das native Boolean-Attribut; via :host([hidden]) behandelt.
  };

  static styles = css`
    :host([hidden]) {
      display: none;
    }
  `;

  constructor() {
    super();
    this.container = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    const spinnerClasses = [
      'slds-spinner',
      'slds-spinner_brand',
      SIZE_CLASS_MAP[this.size],
    ]
      .filter(Boolean)
      .join(' ');

    const spinner = html`
      <div role="status" class="${spinnerClasses}">
        <span class="slds-assistive-text">Loading</span>
        <div class="slds-spinner__dot-a"></div>
        <div class="slds-spinner__dot-b"></div>
      </div>
    `;

    const body = this.container
      ? html`<div class="slds-spinner_container">${spinner}</div>`
      : spinner;

    // Zentrierter Placeholder — wie im Legacy-Verhalten immer vorhanden, damit
    // der (per SLDS position:absolute) Spinner mit Mindesthöhe zentriert bleibt.
    return html`
      <div
        class="slds-align_absolute-center"
        style="min-height: 6rem; position: relative;"
      >
        ${body}
      </div>
    `;
  }
}

customElements.define('slds-spinner', SldsSpinner);
