import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class SldsLayout extends LitElement {
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('slds-grid', 'slds-wrap');
  }

  render() {
    return html`<slot></slot>`;
  }
}

customElements.define('slds-layout', SldsLayout);
