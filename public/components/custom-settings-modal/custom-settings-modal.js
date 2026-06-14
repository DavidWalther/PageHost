import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

class SettingsModal extends LitElement {
  //===========================
  // LIT - Methods
  //===========================

  labels = {
    modalTitle: 'Einstellungen',
    placeholder: 'Hier folgen die Einstellungen.',
  };

  static properties = {
    _hasDanger: { state: true },
  };

  static styles = css`
    .danger-zone {
      border: 1px solid var(--slds-color_error, #ba0517);
      border-radius: 0.25rem;
      padding: 0.75rem;
      margin-top: 1rem;
    }
  `;

  constructor() {
    super();
    this._hasDanger = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    return html`
      <slds-modal title="${this.labels.modalTitle}" footless>
        <slot>
          <div class="slds-align_absolute-center slds-p-around_medium">
            <span>${this.labels.placeholder}</span>
          </div>
        </slot>
        <div class="danger-zone" ?hidden="${!this._hasDanger}">
          <slot name="danger" @slotchange="${this._onDangerSlotChange}"></slot>
        </div>
      </slds-modal>
    `;
  }

  firstUpdated() {
    const dangerSlot = this.shadowRoot.querySelector('slot[name="danger"]');
    if (dangerSlot) {
      this._hasDanger =
        dangerSlot.assignedElements({ flatten: true }).length > 0;
    }
  }

  _onDangerSlotChange(event) {
    this._hasDanger =
      event.target.assignedElements({ flatten: true }).length > 0;
  }

  //===========================
  // Actions
  //===========================

  show() {
    this.shadowRoot.querySelector('slds-modal').show();
  }

  hide() {
    this.shadowRoot.querySelector('slds-modal').hide();
  }
}

customElements.define('custom-settings-modal', SettingsModal);
