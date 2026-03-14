import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class CustomStory extends LitElement {
  labels = {
    labelNotificationLinkCopied: 'Link kopiert',
  };

  static properties = {
    id: { type: String},
    chapterButtonsNumberMax: { type: Number, attribute: 'chapter-buttons_number-max' },
    selectedChapter: { type: String },
    _bookData: { state: true },
  };

  static styles = css`
    /* Add your component-specific styles here */
    /*.slds-hide { display: none; }
    .slds-button_brand { background-color: #0070d2; color: white; }*/
  `;

  constructor() {
    super();
    this.id = null;
    this.chapterButtonsNumberMax = null;
    this.selectedChapter = null;
    this._bookData = null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
    this.fireQueryEvent(this.id , this.storyChangeCallback.bind(this));
  }

  updated(changedProperties) {
    if (changedProperties.has('id')) {
      this._bookData = null;
      if (this.id) {
        this.fireQueryEvent(this.id, this.storyChangeCallback.bind(this));
      }
    }
  }

  render() {
    return html`
      <slds-spinner size="large" ?hidden=${!!this._bookData}></slds-spinner>
      <div id="content" class="slds-grid slds-wrap ${!this._bookData ? 'slds-hide' : ''}">
        <div class="slds-col slds-size_1-of-1">
          <slds-card no-footer>
            <span id="span-chapter-title" slot="header">${this._bookData?.name || ''}</span>
            <div class="slds-grid" slot="actions">
              <div class="slds-col slds-size_1-of-2">
                <!-- Chapter Edit Component Button will appear here -->
                <custom-chapter-edit
                  story-id="${this.id}"
                  mode="create"
                  .chapters="${this._bookData?.chapters || []}"
                  @chapter-created=${this._handleChapterCreated}
                ></custom-chapter-edit>
              </div>
              <div class="slds-col slds-size_1-of-2">
                <slds-button-icon
                  icon="utility:link"
                  variant="container-filled"
                  @click=${this._handleShareClick}
                ></slds-button-icon>
              </div>
            </div>
            <div id="chapter-list" class="slds-grid slds-gutters slds-wrap">
              ${this._renderChapters()}
            </div>
          </slds-card>
        </div>
      </div>
    `;
  }

  _renderChapters() {
    if (!this._bookData || !this._bookData.chapters) return '';
    const chapters = this._bookData.chapters;
    if (this.chapterButtonsNumberMax && chapters.length > this.chapterButtonsNumberMax) {
      return this._renderCombobox(chapters);
    }
    return chapters.map((chapter) => this._renderChapterButton(chapter));
  }

  _renderChapterButton(chapter) {
    let isSelected = this.selectedChapter === chapter.id;
    return html`
      <div class="slds-col slds-grow-none">
        <button
          class="slds-button slds-button_neutral ${this.selectedChapter === chapter.id ? 'slds-button_brand' : ''}"
          data-chapter-id=${chapter.id}
          @click=${() => this.changeChapter(chapter.id)}
          ?disabled=${isSelected}
        >
          ${chapter.name}
        </button>
      </div>
    `;
  }

  _renderCombobox(chapters) {
    const options = chapters.map((chapter) => ({
      value: chapter.id,
      label: chapter.name,
      title: chapter.name,
    }));

    return html`
      <div class="slds-col slds-size_1-of-1 slds-grow-none">
        <slds-combobox
          options=${JSON.stringify(options)}
          label="Kapitel"
          placeholder="Kapitel auswählen"
          value=${this.selectedChapter}
          @select=${(e) => this.changeChapter(e.detail.value)}
        ></slds-combobox>
      </div>
    `;
  }

  changeChapter(chapterId) {
    this.selectedChapter = chapterId;
    this.dispatchEvent(
      new CustomEvent('navigation', {
        detail: { type: 'chapter', value: chapterId },
        bubbles: true,
        composed: true,
      })
    );
  }

  _handleShareClick() {
    const shareUrl = `${location.origin}/${this.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: this.labels.labelNotificationLinkCopied, variant: 'success' },
          bubbles: true,
          composed: true,
        })
      );
    });
  }

  _handleChapterCreated(event) {
    const newChapter = event.detail.chapterData;
    if (this._bookData && this._bookData.chapters && newChapter.id) {
      // Add the new chapter to the story's chapters list
      this._bookData.chapters = [...this._bookData.chapters, newChapter];
      this.requestUpdate();
    }
  }

  handleChapterUpdated(chapterData) {
    if (!this._bookData?.chapters || !chapterData?.id) return;
    const updated = this._bookData.chapters
      .map(ch => ch.id === chapterData.id ? { ...ch, ...chapterData } : ch)
      .sort((a, b) => (a.sortnumber ?? 0) - (b.sortnumber ?? 0));
    this._bookData = { ...this._bookData, chapters: updated };
    this.requestUpdate();
  }

  handleChapterDeleted(chapterId) {
    if (!this._bookData?.chapters || !chapterId) return;
    this._bookData = {
      ...this._bookData,
      chapters: this._bookData.chapters.filter(ch => ch.id !== chapterId),
    };
    this.requestUpdate();
  }
  storyChangeCallback(error, data) {
    if(Array.isArray(data)) { return; }

    if (error) {
      console.error(error);
      return;
    }
    this._bookData = data;
    this.dispatchEvent(
      new CustomEvent('loaded', {
        detail: { bookData: data },
        bubbles: true,
        composed: true,
      })
    );
    this.requestUpdate();
  }

  fireQueryEvent(storyId, callback) {
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: { payload: { object: 'story', id: storyId }, callback },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-story', CustomStory);
