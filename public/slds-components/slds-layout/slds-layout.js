import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class SldsLayout extends LitElement {
  static properties = {
    // Wrap
    wrap: { type: Boolean, attribute: 'wrap' },
    // Gutters
    gutters: { type: Boolean, attribute: 'gutters' },
    guttersXxSmall: { type: Boolean, attribute: 'gutters-xx-small' },
    guttersXSmall: { type: Boolean, attribute: 'gutters-x-small' },
    guttersSmall: { type: Boolean, attribute: 'gutters-small' },
    guttersMedium: { type: Boolean, attribute: 'gutters-medium' },
    guttersLarge: { type: Boolean, attribute: 'gutters-large' },
    guttersXxLarge: { type: Boolean, attribute: 'gutters-xx-large' },
    // Horizontal align
    alignCenter: { type: Boolean, attribute: 'align-center' },
    alignSpace: { type: Boolean, attribute: 'align-space' },
    alignSpread: { type: Boolean, attribute: 'align-spread' },
    alignEnd: { type: Boolean, attribute: 'align-end' },
    // Vertical align
    verticalAlignStart: { type: Boolean, attribute: 'vertical-align-start' },
    verticalAlignCenter: { type: Boolean, attribute: 'vertical-align-center' },
    verticalAlignEnd: { type: Boolean, attribute: 'vertical-align-end' },
  };

  constructor() {
    super();
    this.wrap = false;
    this.gutters = false;
    this.guttersXxSmall = false;
    this.guttersXSmall = false;
    this.guttersSmall = false;
    this.guttersMedium = false;
    this.guttersLarge = false;
    this.guttersXxLarge = false;
    this.alignCenter = false;
    this.alignSpace = false;
    this.alignSpread = false;
    this.alignEnd = false;
    this.verticalAlignStart = false;
    this.verticalAlignCenter = false;
    this.verticalAlignEnd = false;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('slds-grid');
  }

  updated(changedProperties) {
    const toggle = (prop, cls) => {
      if (changedProperties.has(prop)) this.classList.toggle(cls, this[prop]);
    };

    toggle('wrap', 'slds-wrap');
    toggle('gutters', 'slds-gutters');
    toggle('guttersXxSmall', 'slds-gutters_xx-small');
    toggle('guttersXSmall', 'slds-gutters_x-small');
    toggle('guttersSmall', 'slds-gutters_small');
    toggle('guttersMedium', 'slds-gutters_medium');
    toggle('guttersLarge', 'slds-gutters_large');
    toggle('guttersXxLarge', 'slds-gutters_xx-large');
    toggle('alignCenter', 'slds-grid_align-center');
    toggle('alignSpace', 'slds-grid_align-space');
    toggle('alignSpread', 'slds-grid_align-spread');
    toggle('alignEnd', 'slds-grid_align-end');
    toggle('verticalAlignStart', 'slds-grid_vertical-align-start');
    toggle('verticalAlignCenter', 'slds-grid_vertical-align-center');
    toggle('verticalAlignEnd', 'slds-grid_vertical-align-end');
  }

  render() {
    return html`<slot></slot>`;
  }
}

customElements.define('slds-layout', SldsLayout);
