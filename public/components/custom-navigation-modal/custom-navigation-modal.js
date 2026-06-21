import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

class NavigationModal extends LitElement {
  //===========================
  // LIT - Methods
  //===========================

  labels = {
    modalTitle: 'Navigation',
    empty: 'Keine Stories vorhanden.',
  };

  static styles = css`
    .tile {
      width: 100%;
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0.5rem;
      border: 1px solid #c9c9c9;
      border-radius: 0.25rem;
      background-color: var(--panel-background-color);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .tile:hover {
      border-color: #0176d3;
    }
  `;

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
            this._stories = Array.isArray(data)
              ? data.sort(
                  (firstEntry, secondEntry) =>
                    firstEntry.sortnumber - secondEntry.sortnumber
                )
              : [];
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
        ${this._stories.length === 0
          ? html`
              <div class="slds-align_absolute-center slds-p-around_medium">
                <span>${this.labels.empty}</span>
              </div>
            `
          : html`
              <slds-layout wrap gutters-small>
                ${this._stories.map(
                  (story) => html`
                    <slds-layout-item
                      size-1-of-2
                      medium-size-1-of-3
                      large-size-1-of-4
                      class="slds-p-vertical_x-small"
                    >
                      <button
                        class="tile"
                        @click="${() => this._handleTileClick(story.id)}"
                      >
                        <span>${story.name}</span>
                      </button>
                    </slds-layout-item>
                  `
                )}
              </slds-layout>
            `}
      </slds-modal>
    `;
  }

  _handleTileClick(id) {
    this.dispatchEvent(
      new CustomEvent('story-select', {
        detail: { id },
        bubbles: true,
        composed: true,
      })
    );
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
