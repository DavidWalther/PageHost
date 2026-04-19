import { LitElement, html, nothing } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class SldsBreadcrumbs extends LitElement {
  static properties = {
    items: { type: Array },
    ariaLabel: { type: String, attribute: 'aria-label' },
    isCardContainer: { type: Boolean, attribute: 'card-container' },
  };

  constructor() {
    super();
    this.items = [];
    this.ariaLabel = 'Breadcrumbs';
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    const content = html`
      <nav role="navigation" slot="${this.isCardContainer ? 'header' : ''}" aria-label="${this.ariaLabel}">
        <ol class="slds-breadcrumb slds-list_horizontal slds-wrap">
          ${this.items.map((item, index) => this._renderItem(item, index))}
        </ol>
      </nav>
    `;
    
    if(!this.isCardContainer) {
      return content;
    }
    return html`<slds-card no-footer>${content}</slds-card>`;
  }

  _renderItem(item, index) {
    return html`
      <li class="slds-breadcrumb__item">
        <a
          href="${item.href ?? nothing}"
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
