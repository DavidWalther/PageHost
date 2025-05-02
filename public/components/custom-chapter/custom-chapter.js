import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'components/custom-chapter/custom-chapter.html';

class CustomChapter extends LitElement {
  labels = {
    labelNotifcationLinkCopied: 'Link copied to clipboard',
  };

  static properties = {
    id: { type: String },
    chapterData: { type: Object },
    paragraphsData: { type: Array },
    loading: { type: Boolean },
  };

  static styles = css`
    /* Add SLDS styling for your component here */
    :host {
      display: block;
    }
    #chapter-content {
      margin-top: 1rem;
    }
  `;

  constructor() {
    super();
    this.id = null;
    this.chapterData = null;
    this.paragraphsData = [];
    this.loading = false;
    this.templatePromise = null;
    this.loadedMarkUp = null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // Add shared stylesheet
  }

  updated(changedProperties) {
    if (changedProperties.has('id')) {
      this.handleIdChange(this.id);
    }
  }

  async handleIdChange(newId) {
    if (!newId || newId === 'null') {
      this.clearContent();
    } else {
      this.loading = true;
      this.chapterData = null;
      this.paragraphsData = [];
      this.fetchAndDisplayChapter(newId);
    }
  }

  async fetchAndDisplayChapter(chapterId) {
    if (!chapterId) return;

    this.fireQueryEvent_Chapter(chapterId, (error, data) => {
      if (error) {
        console.error('Error fetching chapter data:', error);
        this.loading = false;
        return;
      }

      this.chapterData = data;
      this.paragraphsData = data.paragraphs || [];
      this.loading = false;
    });
  }

  clearContent() {
    this.chapterData = null;
    this.paragraphsData = [];
  }

  render() {
    if (this.loading) {
      return html`<slds-spinner size="large"></slds-spinner>`;
    }

    return html`
      <slds-card no-footer>
        <span slot="header">${this.chapterData.name}</span>
        <slds-button-icon
          slot="actions"
          icon="utility:link"
          variant="container-filled"
          @click=${this.handleShareClick}
        ></slds-button-icon>
        <div id="chapter-content">
          ${this.renderParagraphs()}
        </div>
      </slds-card>
    `;
  }

  renderParagraphs() {
    const paragraphs = this.chapterData?.reversed
      ? [...this.paragraphsData].reverse()
      : this.paragraphsData;

    return paragraphs.map(
      (paragraph) => html`
        <div class="slds-col slds-p-bottom_small">
          <custom-paragraph
            id=${paragraph.id}
            data-name=${paragraph.name || ''}
          ></custom-paragraph>
        </div>
      `
    );
  }

  handleShareClick() {
    const shareUrl = `${location.origin}/${this.id}`;
    this.writeToClipboard(shareUrl);
    this.showToast(this.label.labelNotifcationLinkCopied, 'info');
  }

  writeToClipboard(value) {
    navigator.clipboard.writeText(value).catch((err) => {
      console.error('Error copying text to clipboard:', err);
    });
  }

  showToast(message, state) {
    const toastElement = document.createElement('slds-toast');
    toastElement.setAttribute('state', state);
    toastElement.textContent = message;

    const toastContainer = document.createElement('div');
    toastContainer.style.width = '90%';
    toastContainer.style.textAlign = 'center';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '10%';
    toastContainer.style.zIndex = '10';
    toastContainer.appendChild(toastElement);

    this.shadowRoot.appendChild(toastContainer);

    setTimeout(() => {
      toastContainer.remove();
    }, 900);
  }

  fireQueryEvent_Chapter(chapterId, callback) {
    const payload = { object: 'chapter', id: chapterId };
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-chapter', CustomChapter);
