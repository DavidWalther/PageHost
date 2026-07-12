import {
  LitElement,
  html,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

const PANEL_CLASSES =
  'slds-panel slds-size_medium slds-panel_docked slds-panel_docked-left';
const ICON_HREF = '/assets/icons/utility-sprite/svg/symbols.svg#close';

class SldsPanel extends LitElement {
  static properties = {
    // Interner Zustand: die Legacy toggelte dafuer `slds-is-open` bzw.
    // `slds-show`/`slds-hide` per classList. Kein Attribut, wie in der Legacy.
    _open: { state: true },
  };

  constructor() {
    super();
    this._open = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  openPanel() {
    this._open = true;
  }

  closePanel() {
    this._open = false;
  }

  render() {
    const panelClass = [PANEL_CLASSES, this._open ? 'slds-is-open' : '']
      .filter(Boolean)
      .join(' ');
    const screencoverClass = `screencover ${this._open ? 'slds-show' : 'slds-hide'}`;

    return html`
      <div
        class="${panelClass}"
        style="z-index: 100; position: fixed; top: 0; width: 80vw; height: 100%; max-width: 400px;"
      >
        <div class="slds-panel__header">
          <h2
            class="slds-panel__header-title slds-text-heading_small slds-truncate"
            title="Panel Header"
          >
            <slot name="header"></slot>
          </h2>
          <div class="slds-panel__header-actions">
            <button
              class="slds-button slds-button_icon slds-button_icon-small slds-panel__close"
              title="Collapse Panel Header"
              @click=${() => this.closePanel()}
            >
              <svg class="slds-button__icon" aria-hidden="true">
                <use href="${ICON_HREF}"></use>
              </svg>
              <span class="slds-assistive-text">Collapse Panel Header</span>
            </button>
          </div>
        </div>
        <div class="slds-panel__body">
          <slot></slot>
        </div>
      </div>
      <div
        class="${screencoverClass}"
        style="z-index: 90; position: fixed; top: 0; width: 100%; height: 100%; background-color: rgb(0, 0, 0); opacity: 50%;"
        @click=${() => this.closePanel()}
      ></div>
    `;
  }
}

customElements.define('slds-panel', SldsPanel);
