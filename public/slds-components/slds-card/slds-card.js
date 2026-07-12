import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

class Card extends LitElement {
  static properties = {
    // Legacy-API: `no-header` (No-Op wie Legacy), `no-footer`, `no-border`.
    noHeader: { type: Boolean, attribute: 'no-header' },
    noFooter: { type: Boolean, attribute: 'no-footer' },
    noBorder: { type: Boolean, attribute: 'no-border' },
  };

  static styles = css`
    .no-border {
      border: none !important;
      box-shadow: unset !important;
    }
    /* wie Legacy applyGlobalStyles(): Card-Hintergrund per CSS-Variable. */
    article.slds-card {
      background-color: var(--slds-c-card-color-background) !important;
    }
  `;

  constructor() {
    super();
    this.noHeader = false;
    this.noFooter = false;
    this.noBorder = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    const articleClasses = ['slds-card', this.noBorder ? 'no-border' : '']
      .filter(Boolean)
      .join(' ');

    // Header wird immer gerendert — `no-header` ist ein No-Op (wie Legacy).
    return html`
      <article class="${articleClasses}">
        <div class="slds-card__header slds-grid">
          <header class="slds-media slds-media_center slds-has-flexi-truncate">
            <div class="slds-media__body">
              <h2 class="slds-card__header-title">
                <span><slot name="header"></slot></span>
              </h2>
            </div>
            <div class="slds-no-flex">
              <slot name="actions"></slot>
            </div>
          </header>
        </div>
        <div class="slds-card__body slds-card__body_inner"><slot></slot></div>
        ${
          this.noFooter
            ? ''
            : html`
                <footer class="slds-card__footer">
                  <a class="slds-card__footer-action" href="#"
                    >View All
                    <span class="slds-assistive-text"
                      ><slot name="footer"></slot
                    ></span>
                  </a>
                </footer>
              `
        }
      </article>
    `;
  }
}

customElements.define('slds-card', Card);
