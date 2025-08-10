import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class GlobalHeader extends LitElement {
  constructor() {
    super();
  }

  async connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // Add shared stylesheet
  }

  render() {
    return html`
      <div class="slds-grid">
        <!-- Left column slot -->
        <div class="slds-col slds-size_1-of-12">
            <slot name="left"></slot>
        </div>
        
        <!-- Middle column slot -->
        <div class="slds-col slds-size_8-of-12">
            <slot name="mid"></slot>
        </div>

        <!-- Right column slot -->
        <div class="slds-col slds-size_3-of-12">
            <slot name="right"></slot>
        </div>
      </div>
    `;
  }
}

customElements.define('custom-global-header', GlobalHeader);
