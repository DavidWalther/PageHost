import {
  LitElement,
  html,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

const VARIANT_CLASSES = {
  'icon-only': 'slds-button_icon-container',
  'container-transparent': 'slds-button_icon-border',
  'container-filled': 'slds-button_icon-border-filled',
};
const VARIANT_DEFAULT = 'container-filled';
const SIZES = ['large', 'small', 'x-small', 'xx-small'];

class SLDSButtonIcon extends LitElement {
  static properties = {
    icon: { type: String },
    size: { type: String },
    variant: { type: String },
    disabled: { type: Boolean },
    // Not `title`: a global HTML attribute with a native property — on the host
    // it never reaches the inner button, which keeps title="" (no tooltip).
    label: { type: String },
  };

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    // Variant: fehlt (null/undefined) -> Default container-filled; ungueltig -> keine Klasse.
    const variantKey = this.variant == null ? VARIANT_DEFAULT : this.variant;
    const variantClass = VARIANT_CLASSES[variantKey] || '';
    const sizeClass = SIZES.includes(this.size)
      ? `slds-button_icon-${this.size}`
      : '';

    const buttonClass = [
      'slds-button',
      'slds-button_icon',
      variantClass,
      sizeClass,
    ]
      .filter(Boolean)
      .join(' ');

    // icon "type:name": Sprite aus type, Assistive = name kapitalisiert.
    // Fehlt icon oder name -> href/Assistive leer (defensiv, statt zu werfen).
    const [type, name] = (this.icon || '').split(':');
    const href =
      type && name
        ? `/assets/icons/${type}-sprite/svg/symbols.svg#${name}`
        : '';
    // A label names the button; without one the icon name does, as before.
    const assistive =
      this.label || (name ? name.charAt(0).toUpperCase() + name.slice(1) : '');

    return html`
      <button
        class="${buttonClass}"
        title="${this.label || ''}"
        ?disabled=${this.disabled}
      >
        <svg class="slds-button__icon" aria-hidden="true">
          <use href="${href}"></use>
        </svg>
        <span class="slds-assistive-text">${assistive}</span>
      </button>
    `;
  }
}

customElements.define('slds-button-icon', SLDSButtonIcon);
