import {
  LitElement,
  html,
  css,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
// `card-container` rendert eine <slds-card> — ohne diesen Import bliebe sie ein
// unbekanntes Element, sobald die Breadcrumbs standalone eingebunden werden.
import '/slds-components/slds-card/slds-card.js';

const OVERFLOW_MARKER = Symbol('overflow');
const MIN_OVERFLOW_LIMIT = 2;

// Größe -> Textklasse und Abstände. Unbekannte Größe fällt geschlossen auf
// `medium` zurück (Textklasse und Abstand liefen sonst auseinander).
const SIZE_MAPPING = {
  small: {
    textClass: 'slds-text-heading_small',
    left: '.8rem',
    right: '.5rem',
  },
  medium: {
    textClass: 'slds-text-heading_medium',
    left: '1rem',
    right: '.75rem',
  },
  large: {
    textClass: 'slds-text-heading_large',
    left: '1.75rem',
    right: '1rem',
  },
};
const DEFAULT_SIZE = 'medium';

class SldsBreadcrumbs extends LitElement {
  static properties = {
    items: { type: Array },
    ariaLabel: { type: String, attribute: 'aria-label' },
    isCardContainer: { type: Boolean, attribute: 'card-container' },
    size: { type: String, reflect: true },
    overflow: { type: Boolean }, // Enable overflow behavior. Overflow will render only a limited number of items
    overflowLimit: { type: Number, attribute: 'overflow_limit' }, // Number of items to show when overflow is enabled.
    lastItemAsLink: { type: Boolean, attribute: 'last-item-as-link' },
  };

  static styles = css`
    .slds-breadcrumb__item a {
      display: inline-block;
      max-width: clamp(4rem, 20vw, 12rem);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }
  `;

  constructor() {
    super();
    this.items = [];
    this.ariaLabel = 'Breadcrumbs';
    this.size = 'medium';
    this.overflow = false;
    this.overflowLimit = 3;
    this.lastItemAsLink = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  get spacing() {
    return SIZE_MAPPING[this.size] ?? SIZE_MAPPING[DEFAULT_SIZE];
  }

  // Die Abstände gehen als Custom Properties an den Host; SLDS liest sie im
  // ShadowDOM aus (`--slds-c-breadcrumbs-spacing-inline-*`). Das gehört nach
  // `updated()` — `render()` muss seiteneffektfrei bleiben.
  updated() {
    const { left, right } = this.spacing;
    this.style.setProperty('--slds-c-breadcrumbs-spacing-inline-start', left);
    this.style.setProperty('--slds-c-breadcrumbs-spacing-inline-end', right);
  }

  get _visibleItems() {
    // Unter 2 sichtbaren Items lässt sich "erstes + … + letztes" nicht darstellen.
    // Ohne diesen Guard liefe `slice(-(limit - 1))` bei limit 1 auf `slice(-0)` und
    // damit auf `slice(0)` hinaus — also auf die komplette Liste.
    const limit = Math.max(MIN_OVERFLOW_LIMIT, this.overflowLimit);
    if (!this.overflow || this.items.length <= limit) {
      return this.items;
    }
    const tail = this.items.slice(-(limit - 1));
    return [this.items[0], OVERFLOW_MARKER, ...tail];
  }

  render() {
    const sizeClass = this.spacing.textClass;

    const content = html`
      <nav
        role="navigation"
        slot="${this.isCardContainer ? 'header' : ''}"
        aria-label="${this.ariaLabel}"
      >
        <ol class="${sizeClass} slds-breadcrumb slds-list_horizontal slds-wrap">
          ${this._visibleItems.map((item, index) =>
            item === OVERFLOW_MARKER
              ? this._renderOverflowIndicator()
              : this._renderItem(
                  item,
                  index,
                  index === this._visibleItems.length - 1
                )
          )}
        </ol>
      </nav>
    `;

    if (!this.isCardContainer) {
      return content;
    }
    return html`<slds-card no-footer>${content}</slds-card>`;
  }

  _renderOverflowIndicator() {
    const spacing = this.spacing;
    return html`
      <li
        class="slds-breadcrumb__item"
        style="padding-left: ${spacing.left}; padding-right: ${spacing.right};"
      >
        <span>…</span>
      </li>
    `;
  }

  _renderItem(item, index, isLast = false) {
    const innerContent =
      isLast && !this.lastItemAsLink
        ? html`<span
            style="padding-left: ${this.spacing.left}; "
            title="${item.label}"
            >${item.label}</span
          >`
        : html`<a
            href="${item.href ?? nothing}"
            title="${item.label}"
            @click="${(event) => this._handleClick(event, item, index)}"
            >${item.label}</a
          >`;

    return html`
      <li
        class="slds-breadcrumb__item"
        aria-current="${isLast ? 'page' : nothing}"
      >
        ${innerContent}
      </li>
    `;
  }

  _handleClick(event, item, index) {
    event.preventDefault();
    event.stopPropagation();
    // Qualifizierter Name statt `click`: ein CustomEvent namens `click` wäre vom
    // nativen Click nicht zu unterscheiden, dessen `detail` die Klickzahl ist.
    this.dispatchEvent(
      new CustomEvent('breadcrumb-select', {
        detail: {
          key: item.key,
          label: item.label,
          href: item.href,
          index,
        },
        bubbles: true,
      })
    );
  }
}

customElements.define('slds-breadcrumbs', SldsBreadcrumbs);
