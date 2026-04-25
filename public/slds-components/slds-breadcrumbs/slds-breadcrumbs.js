import { LitElement, html, css, nothing } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const OVERFLOW_MARKER = Symbol('overflow');

class SldsBreadcrumbs extends LitElement {
  static properties = {
    items: { type: Array },
    ariaLabel: { type: String, attribute: 'aria-label' },
    isCardContainer: { type: Boolean, attribute: 'card-container' },
    size: { type: String, reflect: true },
    overflow: { type: Boolean },
    overflowLimit: { type: Number, attribute: 'overflow_limit' }
  };

  static styles = css`
    .slds-breadcrumb__overflow-indicator_small {
      padding-left: .8rem;
      padding-right: .5rem;
    }

    .slds-breadcrumb__overflow-indicator_medium { 
      padding-left: 1rem;
      padding-right: .75rem;
    }

    .slds-breadcrumb__overflow-indicator_large {
      padding-left: 1.75rem;
      padding-right: 1rem;
    }

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
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  get isSizeSmall() {
    return this.size === 'small';
  }

  get isSizeMedium() {
    return this.size === 'medium';
  }

  get isSizeLarge() {
    return this.size === 'large';
  }

  get spacingStart() {
    if(this.isSizeLarge) {
      return '1.75rem';
    }
    if(this.isSizeMedium) {
      return '1rem';
    }
    return '.8rem';
  }

  get spacingEnd() {
    if(this.isSizeLarge) {
      return '1rem';
    }
    if(this.isSizeMedium) {
      return '.75rem';
    }

    return '.5rem';
  }

  get _visibleItems() {
    if (!this.overflow || this.items.length <= this.overflowLimit) {
      return this.items;
    }
    const tail = this.items.slice(-(this.overflowLimit - 1));
    return [this.items[0], OVERFLOW_MARKER, ...tail];
  }

  render() {
    const sizeClass = this.isSizeSmall ? 'slds-text-heading_small' : this.isSizeMedium ? 'slds-text-heading_medium' : this.isSizeLarge ? 'slds-text-heading_large' : '';
    const spacingWidthStart = this.spacingStart;
    const spacingWidthEnd = this.spacingEnd;
    this.style.setProperty('--slds-c-breadcrumbs-spacing-inline-start', spacingWidthStart);
    this.style.setProperty('--slds-c-breadcrumbs-spacing-inline-end', spacingWidthEnd);

    const content = html`
      <nav role="navigation" slot="${this.isCardContainer ? 'header' : ''}" aria-label="${this.ariaLabel}">
        <ol class="${sizeClass} slds-breadcrumb slds-list_horizontal slds-wrap">
          ${this._visibleItems.map((item, index) =>
            item === OVERFLOW_MARKER
              ? this._renderOverflowIndicator()
              : this._renderItem(item, index)
          )}
        </ol>
      </nav>
    `;

    if(!this.isCardContainer) {
      return content;
    }
    return html`<slds-card no-footer>${content}</slds-card>`;
  }

  _renderOverflowIndicator() {
    let overflowClass = 'slds-breadcrumb__overflow-indicator_medium';
    if(this.isSizeSmall) {
      overflowClass = 'slds-breadcrumb__overflow-indicator_small';
    }
    if(this.isSizeLarge) {
      overflowClass = 'slds-breadcrumb__overflow-indicator_large';
    }
    return html`
      <li class="slds-breadcrumb__item ${overflowClass}">
        <span>…</span>
      </li>
    `;
  }

  _renderItem(item, index) {

    return html`
      <li class="slds-breadcrumb__item ">
        <a
          href="${item.href ?? nothing}"
          title="${item.label}"
          @click="${(event) => this._handleClick(event, item, index)}"
        >${item.label}</a>
      </li>
    `;
  }

  _handleClick(event, item, index) {
    event.preventDefault();
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('click', {
      detail: {
        key: item.key,
        label: item.label,
        href: item.href,
        index
      },
      bubbles: true
    }));
  }
}

customElements.define('slds-breadcrumbs', SldsBreadcrumbs);
