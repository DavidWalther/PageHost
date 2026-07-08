import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

const THEME_DEFAULT = 'info';
const STATES = new Set(['success', 'info', 'warning', 'error']);
const ICON_SPRITE = '/assets/icons/utility-sprite/svg/symbols.svg';

class SldsToast extends LitElement {
  static properties = {
    state: { type: String },
  };

  static styles = css`
    div.slds-notify {
      min-width: fit-content;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    // Ungültiger/fehlender State -> Default `info` (wie Legacy-`state`-Getter).
    const state = STATES.has(this.state) ? this.state : THEME_DEFAULT;

    return html`
      <div class="slds-notify_container slds-is-relative">
        <div
          class="slds-notify slds-notify_toast slds-theme_${state}"
          role="status"
        >
          <span class="slds-assistive-text">${state}</span>
          <span
            class="slds-icon_container slds-icon-utility-${state} slds-m-right_small slds-no-flex slds-align-top"
            title="Description of icon when needed"
          >
            <svg class="slds-icon slds-icon_small" aria-hidden="true">
              <use xlink:href="${ICON_SPRITE}#${state}"></use>
            </svg>
          </span>
          <div class="slds-notify__content">
            <h2 class="slds-text-heading_small"><slot></slot></h2>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('slds-toast', SldsToast);
