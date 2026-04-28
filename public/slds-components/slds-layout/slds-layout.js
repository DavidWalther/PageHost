import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class SldsLayout extends LitElement {
  static properties = {
    gutters: { type: String },
  };

  constructor() {
    super();
    this.gutters = '';
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('slds-grid', 'slds-wrap');
  }

  updated(changedProperties) {
    if (changedProperties.has('gutters')) {
      this._updateClass('slds-gutters_', changedProperties.get('gutters'), this.gutters);
    }
  }

  _updateClass(prefix, oldValue, newValue) {
    if (oldValue) {
      this.classList.remove(`${prefix}${oldValue}`);
    }
    if (newValue) {
      this.classList.add(`${prefix}${newValue}`);
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

customElements.define('slds-layout', SldsLayout);
