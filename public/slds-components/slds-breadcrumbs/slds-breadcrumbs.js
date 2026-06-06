import { LitElement, html, css, nothing } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const OVERFLOW_MARKER = Symbol('overflow');

class SldsBreadcrumbs extends LitElement {
  static properties = {
    items: { type: Array },
    ariaLabel: { type: String, attribute: 'aria-label' },
    isCardContainer: { type: Boolean, attribute: 'card-container' },
    size: { type: String, reflect: true },
    overflow: { type: Boolean }, // Enable overflow behavior. Overflow will render only a limited number of items
    overflowLimit: { type: Number, attribute: 'overflow_limit' }, // Number of items to show when overflow is enabled.
    lastItemAsLink: { type: Boolean, attribute: 'last-item-as-link' }
  };

  sizeMapping = {
    small: {
      spacingStart: '.8rem',
      spacingEnd: '.5rem'
    },
    medium: {
      spacingStart: '1rem',
      spacingEnd: '.75rem'
    },
    large: {
      spacingStart: '1.75rem',
      spacingEnd: '1rem'
    }
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
    this.lastItemAsLink = false;
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

  get spacing() {
    if (this.isSizeSmall) {
      return {
        "start": this.sizeMapping.small.spacingStart,
        "end": this.sizeMapping.small.spacingEnd
      };
    }
    if (this.isSizeLarge) {
      return {
        "start": this.sizeMapping.large.spacingStart,
        "end": this.sizeMapping.large.spacingEnd
      };
    }
    // Default to medium spacing if size is not small or large
    return {
      "start": this.sizeMapping.medium.spacingStart,
      "end": this.sizeMapping.medium.spacingEnd
    };
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
    const spacingWidthStart = this.spacing.start;
    const spacingWidthEnd = this.spacing.end;
    this.style.setProperty('--slds-c-breadcrumbs-spacing-inline-start', spacingWidthStart);
    this.style.setProperty('--slds-c-breadcrumbs-spacing-inline-end', spacingWidthEnd);

    const content = html`
      <nav role="navigation" slot="${this.isCardContainer ? 'header' : ''}" aria-label="${this.ariaLabel}">
        <ol class="${sizeClass} slds-breadcrumb slds-list_horizontal slds-wrap">
          ${this._visibleItems.map((item, index) =>
            item === OVERFLOW_MARKER
              ? this._renderOverflowIndicator()
              : this._renderItem(item, index, index === this._visibleItems.length - 1)
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

  _renderItem(item, index, isLast = false) {
    const innerContent = (isLast && !this.lastItemAsLink)
      ? html`<span style="padding-left: ${this.spacing.start}; " title="${item.label}">${item.label}</span>`
      : html`<a
          href="${item.href ?? nothing}"
          title="${item.label}"
          @click="${(event) => this._handleClick(event, item, index)}"
        >${item.label}</a>`;

    return html`
      <li class="slds-breadcrumb__item" aria-current="${isLast ? 'page' : nothing}">
        ${innerContent}
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
