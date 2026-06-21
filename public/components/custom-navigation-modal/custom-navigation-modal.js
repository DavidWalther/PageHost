import {
  LitElement,
  html,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

class NavigationModal extends LitElement {
  //===========================
  // LIT - Methods
  //===========================

  labels = {
    modalTitle: 'Navigation',
    placeholder: 'Hier folgt die Navigation.',
  };

  static properties = {
    _stories: { state: true },
  };

  constructor() {
    super();
    this._stories = [];
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this._loadStories();
  }

  //===========================
  // Data
  //===========================

  _loadStories() {
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: {
          payload: { object: 'story' },
          callback: (error, data) => {
            if (error) {
              console.error(error);
              return;
            }
            this._stories = Array.isArray(data) ? data : [];
          },
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <slds-modal title="${this.labels.modalTitle}" footless>
        <slot>
          <div class="slds-align_absolute-center slds-p-around_medium">
            <span>${this.labels.placeholder}</span>
          </div>
        </slot>
      </slds-modal>
    `;
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

customElements.define('custom-navigation-modal', NavigationModal);
