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
    emptyChapters: 'Keine Kapitel vorhanden.',
    back: '< zurück',
  };

  _isOpen = false;

  static styles = css`
    .tile {
      width: 100%;
      aspect-ratio: 2 / 1;
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

    .tile_current {
      background-color: #0176d3;
      border-color: #0176d3;
      color: #ffffff;
    }

    .back-button {
      background: none;
      border: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
    }

    .back-button:hover {
      text-decoration: underline;
    }
  `;

  static properties = {
    currentLocation: { type: String, attribute: 'current-location' },
    _tree: { state: true },
    _selectedStory: { state: true },
  };

  constructor() {
    super();
    this.currentLocation = null;
    this._tree = [];
    this._selectedStory = null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this._loadContents();
  }

  //===========================
  // Data
  //===========================

  _loadContents() {
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: {
          payload: { object: 'contents' },
          callback: (error, data) => {
            if (error) {
              console.error(error);
              return;
            }
            this._tree = Array.isArray(data) ? data : [];
            // If show() ran before the tree was available, pre-position now.
            if (this._isOpen && this._selectedStory === null) {
              this._selectedStory = this._resolveInitialStory();
            }
          },
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  _storyIdForLocation() {
    const location = this.currentLocation;
    if (!location) {
      return null;
    }
    if (location.startsWith('000s')) {
      return location;
    }
    const parentStory = this._tree.find((story) =>
      (story.childnodes || []).some((chapter) => chapter.id === location)
    );
    return parentStory ? parentStory.id : null;
  }

  _resolveInitialStory() {
    // Only a chapter location pre-opens the chapter list of its parent story;
    // a story location (or none) keeps the modal on the story level.
    if (!this.currentLocation || this.currentLocation.startsWith('000s')) {
      return null;
    }
    const storyId = this._storyIdForLocation();
    return this._tree.find((story) => story.id === storyId) || null;
  }

  render() {
    return html`
      <slds-modal title="${this.labels.modalTitle}" footless>
        ${this._selectedStory === null
          ? this._renderStories()
          : this._renderChapters()}
      </slds-modal>
    `;
  }

  _renderStories() {
    if (this._tree.length === 0) {
      return html`
        <div class="slds-align_absolute-center slds-p-around_medium">
          <span>${this.labels.empty}</span>
        </div>
      `;
    }
    const currentStoryId = this._storyIdForLocation();
    return html`
      <slds-layout wrap gutters-small>
        ${this._tree.map(
          (story) => html`
            <slds-layout-item
              size-1-of-2
              medium-size-1-of-3
              large-size-1-of-4
              class="slds-p-vertical_x-small"
            >
              <button
                class="tile ${story.id === currentStoryId
                  ? 'tile_current'
                  : ''}"
                @click="${() => this._handleStoryClick(story)}"
              >
                <span>${story.name}</span>
              </button>
            </slds-layout-item>
          `
        )}
      </slds-layout>
    `;
  }

  _renderChapters() {
    const chapters = this._selectedStory.childnodes || [];
    return html`
      <div class="slds-m-bottom_small">
        <button class="back-button" @click="${this._handleBack}">
          ${this.labels.back}
        </button>
      </div>
      ${chapters.length === 0
        ? html`
            <div class="slds-align_absolute-center slds-p-around_medium">
              <span>${this.labels.emptyChapters}</span>
            </div>
          `
        : html`
            <slds-layout wrap gutters-small>
              ${chapters.map(
                (chapter) => html`
                  <slds-layout-item
                    size-1-of-2
                    medium-size-1-of-3
                    large-size-1-of-4
                    class="slds-p-vertical_x-small"
                  >
                    <button
                      class="tile ${chapter.id === this.currentLocation
                        ? 'tile_current'
                        : ''}"
                      @click="${() => this._handleChapterClick(chapter.id)}"
                    >
                      <span>${chapter.name}</span>
                    </button>
                  </slds-layout-item>
                `
              )}
            </slds-layout>
          `}
    `;
  }

  _handleStoryClick(story) {
    this._selectedStory = story;
    this.dispatchEvent(
      new CustomEvent('story-select', {
        detail: { id: story.id },
        bubbles: true,
        composed: true,
      })
    );
  }

  _handleChapterClick(chapterId) {
    this.dispatchEvent(
      new CustomEvent('chapter-select', {
        detail: { storyId: this._selectedStory.id, chapterId },
        bubbles: true,
        composed: true,
      })
    );
  }

  _handleBack() {
    this._selectedStory = null;
  }

  //===========================
  // Actions
  //===========================

  show() {
    this._isOpen = true;
    this._selectedStory = this._resolveInitialStory();
    this.shadowRoot.querySelector('slds-modal').show();
  }

  hide() {
    this._isOpen = false;
    this.shadowRoot.querySelector('slds-modal').hide();
  }
}

customElements.define('custom-navigation-modal', NavigationModal);
