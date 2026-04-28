import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class SldsLayoutItem extends LitElement {
  static properties = {
    size: { type: String },
    sizeSmall: { type: String },
    sizeMedium: { type: String },
    sizeLarge: { type: String },
    bump: { type: String },
  };

  constructor() {
    super();
    this.size = '';
    this.sizeSmall = '';
    this.sizeMedium = '';
    this.sizeLarge = '';
    this.bump = '';
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
      this._updateClass('slds-size_', changedProperties.get('size'), this.size);
    }
    if (changedProperties.has('sizeSmall')) {
      this._updateClass('slds-small-size_', changedProperties.get('sizeSmall'), this.sizeSmall);
    }
    if (changedProperties.has('sizeMedium')) {
      this._updateClass('slds-medium-size_', changedProperties.get('sizeMedium'), this.sizeMedium);
    }
    if (changedProperties.has('sizeLarge')) {
      this._updateClass('slds-large-size_', changedProperties.get('sizeLarge'), this.sizeLarge);
    }
    if (changedProperties.has('bump')) {
      this._updateClass('slds-col_bump-', changedProperties.get('bump'), this.bump);
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

customElements.define('slds-layout-item', SldsLayoutItem);
