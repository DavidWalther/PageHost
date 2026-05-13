import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

// Supported SLDS size fractions
const SIZE_FRACTIONS = [
  '1-of-1', '1-of-2',
  '1-of-3', '2-of-3',
  '1-of-4', '2-of-4', '3-of-4',
  '1-of-5', '2-of-5', '3-of-5', '4-of-5',
  '1-of-6', '2-of-6', '3-of-6', '4-of-6', '5-of-6',
  '1-of-8', '2-of-8', '3-of-8', '4-of-8', '5-of-8', '6-of-8', '7-of-8',
  '1-of-12', '2-of-12', '3-of-12', '4-of-12', '5-of-12', '6-of-12',
  '7-of-12', '8-of-12', '9-of-12', '10-of-12', '11-of-12', '12-of-12',
];

const BREAKPOINTS = [
  { prefix: 'size', attrPrefix: 'size', classPrefix: 'slds-size_' },
  { prefix: 'smallSize', attrPrefix: 'small-size', classPrefix: 'slds-small-size_' },
  { prefix: 'mediumSize', attrPrefix: 'medium-size', classPrefix: 'slds-medium-size_' },
  { prefix: 'largeSize', attrPrefix: 'large-size', classPrefix: 'slds-large-size_' },
];

// Converts a hyphenated fraction string to a camelCase suffix, e.g. "1-of-2" -> "1Of2"
function fractionToCamel(fraction) {
  return fraction.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// Build the full prop name and attribute name for a breakpoint + fraction
function propName(breakpointPrefix, fraction) {
  return `${breakpointPrefix}${fractionToCamel('-' + fraction)}`;
}

function attrName(attrPrefix, fraction) {
  return `${attrPrefix}-${fraction}`;
}

class SldsLayoutItem extends LitElement {
  static get properties() {
    const props = {};

    // Size fraction booleans per breakpoint
    for (const bp of BREAKPOINTS) {
      for (const frac of SIZE_FRACTIONS) {
        props[propName(bp.prefix, frac)] = { type: Boolean, attribute: attrName(bp.attrPrefix, frac) };
      }
    }

    // Bump variants
    props.bumpLeft   = { type: Boolean, attribute: 'bump-left' };
    props.bumpRight  = { type: Boolean, attribute: 'bump-right' };
    props.bumpTop    = { type: Boolean, attribute: 'bump-top' };
    props.bumpBottom = { type: Boolean, attribute: 'bump-bottom' };

    // Align variants
    props.alignTop    = { type: Boolean, attribute: 'align-top' };
    props.alignMiddle = { type: Boolean, attribute: 'align-middle' };
    props.alignBottom = { type: Boolean, attribute: 'align-bottom' };

    return props;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('slds-col');
  }

  updated(changedProperties) {
    // Size fractions
    for (const bp of BREAKPOINTS) {
      for (const frac of SIZE_FRACTIONS) {
        const prop = propName(bp.prefix, frac);
        if (changedProperties.has(prop)) {
          this.classList.toggle(`${bp.classPrefix}${frac}`, this[prop]);
        }
      }
    }

    // Bump
    const bumpMap = {
      bumpLeft: 'slds-col_bump-left',
      bumpRight: 'slds-col_bump-right',
      bumpTop: 'slds-col_bump-top',
      bumpBottom: 'slds-col_bump-bottom',
    };
    for (const [prop, cls] of Object.entries(bumpMap)) {
      if (changedProperties.has(prop)) this.classList.toggle(cls, this[prop]);
    }

    // Align
    const alignMap = {
      alignTop: 'slds-align-top',
      alignMiddle: 'slds-align-middle',
      alignBottom: 'slds-align-bottom',
    };
    for (const [prop, cls] of Object.entries(alignMap)) {
      if (changedProperties.has(prop)) this.classList.toggle(cls, this[prop]);
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

customElements.define('slds-layout-item', SldsLayoutItem);
