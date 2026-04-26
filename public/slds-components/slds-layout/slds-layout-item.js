import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class SldsLayoutItem extends LitElement {
  static properties = {
    size: { type: String },
  };

  constructor() {
    super();
    this.size = '';
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('slds-col');
  }

  updated(changedProperties) {
    if (changedProperties.has('size')) {
      this._updateSizeClass(changedProperties.get('size'), this.size);
    }
  }

  _updateSizeClass(oldSize, newSize) {
    if (oldSize) {
      this.classList.remove(`slds-size_${oldSize}`);
    }
    if (newSize) {
      this.classList.add(`slds-size_${newSize}`);
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

customElements.define('slds-layout-item', SldsLayoutItem);
