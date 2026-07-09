import {
  LitElement,
  html,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

class SldsGlobalHeader extends LitElement {
  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    return html`
      <header class="slds-global-header_container">
        <div class="slds-global-header">
          <div class="slds-global-header__item">
            <slot name="logo"></slot>
          </div>
          <div class="slds-global-header__item slds-global-header__item_search">
            <slot name="search"></slot>
          </div>
          <div class="slds-global-header__item">
            <slot name="actions"></slot>
          </div>
        </div>
      </header>
    `;
  }
}

customElements.define('slds-global-header', SldsGlobalHeader);
