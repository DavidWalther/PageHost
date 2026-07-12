import {
  LitElement,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

// SLDS definiert Spaltenbreiten nur für diese Nenner. Daraus ergeben sich alle
// gültigen Bruchteile (1-of-1, 1-of-2, 2-of-2, … 12-of-12) — genau die 48, die im
// Stylesheet stehen. Generiert statt gepflegt: eine Handliste war unvollständig
// (die komplette Siebtel-Familie und 2-of-2, 3-of-3, … fehlten).
const DENOMINATORS = [1, 2, 3, 4, 5, 6, 7, 8, 12];
const SIZE_FRACTIONS = new Set(
  DENOMINATORS.flatMap((denominator) =>
    Array.from(
      { length: denominator },
      (_, index) => `${index + 1}-of-${denominator}`
    )
  )
);

const BREAKPOINTS = [
  { prop: 'size', classPrefix: 'slds-size_' },
  { prop: 'smallSize', classPrefix: 'slds-small-size_' },
  { prop: 'mediumSize', classPrefix: 'slds-medium-size_' },
  { prop: 'largeSize', classPrefix: 'slds-large-size_' },
];

const BUMP_CLASSES = {
  bumpLeft: 'slds-col_bump-left',
  bumpRight: 'slds-col_bump-right',
  bumpTop: 'slds-col_bump-top',
  bumpBottom: 'slds-col_bump-bottom',
};

const ALIGN_CLASSES = {
  alignTop: 'slds-align-top',
  alignMiddle: 'slds-align-middle',
  alignBottom: 'slds-align-bottom',
};

class SldsLayoutItem extends LitElement {
  static properties = {
    // Ein String je Breakpoint (`size="1-of-2"`). Früher stand hier ein Boolean je
    // Bruchteil UND Breakpoint — 136 Properties für dieselbe Funktion.
    size: { type: String },
    smallSize: { type: String, attribute: 'small-size' },
    mediumSize: { type: String, attribute: 'medium-size' },
    largeSize: { type: String, attribute: 'large-size' },

    bumpLeft: { type: Boolean, attribute: 'bump-left' },
    bumpRight: { type: Boolean, attribute: 'bump-right' },
    bumpTop: { type: Boolean, attribute: 'bump-top' },
    bumpBottom: { type: Boolean, attribute: 'bump-bottom' },

    alignTop: { type: Boolean, attribute: 'align-top' },
    alignMiddle: { type: Boolean, attribute: 'align-middle' },
    alignBottom: { type: Boolean, attribute: 'align-bottom' },
  };

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('slds-col');
  }

  updated(changedProperties) {
    for (const breakpoint of BREAKPOINTS) {
      if (!changedProperties.has(breakpoint.prop)) {
        continue;
      }

      // Light DOM: die classList gehört uns nicht allein — Consumer setzen dort
      // eigene Klassen (z. B. slds-m-bottom--medium). Deshalb gezielt die zuvor
      // gesetzte Klasse entfernen statt pauschal aufzuräumen.
      const previous = changedProperties.get(breakpoint.prop);
      if (previous) {
        this.classList.remove(`${breakpoint.classPrefix}${previous}`);
      }

      const current = this[breakpoint.prop];
      // Unbekannter Bruchteil -> keine Klasse (statt still einer wirkungslosen).
      if (SIZE_FRACTIONS.has(current)) {
        this.classList.add(`${breakpoint.classPrefix}${current}`);
      }
    }

    for (const [prop, className] of Object.entries({
      ...BUMP_CLASSES,
      ...ALIGN_CLASSES,
    })) {
      if (changedProperties.has(prop)) {
        this.classList.toggle(className, this[prop]);
      }
    }
  }

  // Light DOM (siehe createRenderRoot) — kein <slot>, siehe slds-layout.js.
  render() {
    return nothing;
  }
}

customElements.define('slds-layout-item', SldsLayoutItem);
