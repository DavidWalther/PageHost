import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class CustomStory extends LitElement {
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
      this.fireQueryEvent(this.id, this.storyChangeCallback.bind(this));
    }
  }
  
  render() {
    return html`
      <slds-spinner size="large" ?hidden=${!!this._bookData}></slds-spinner>
      <div id="content" class="slds-grid slds-wrap ${!this._bookData ? 'slds-hide' : ''}">
        <div class="slds-col slds-size_1-of-1">
          <slds-card no-footer>
            <span id="span-chapter-title" slot="header">${this._bookData?.name || ''}</span>
            <div id="chapter-list" class="slds-grid slds-gutters slds-wrap">
              ${this._renderChapters()}
            </div>
            <slds-button-icon
              icon="utility:link"
              variant="container-filled"
              slot="actions"
              @click=${this._handleShareClick}
            ></slds-button-icon>
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
          detail: { message: 'Link kopiert', variant: 'success' },
          bubbles: true,
          composed: true,
        })
      );
    });
  }
  
  storyChangeCallback(error, data) {
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
