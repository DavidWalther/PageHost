import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class CustomChapter extends LitElement {
  labels = {
    labelCreateParagraph: 'Absatz erstellen',
    labelShareChapter: 'Kapitel teilen',
    labelNotifcationLinkCopied: 'Link kopiert',
    labelParagraphCreated: 'Absatzt erstellt',
    labelParagraphCreateError: 'Fehler beim Erstellen des Absatzes',
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
    this.pendingNewParagraphId = null; // Track the id of a paragraph being created
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // Add shared stylesheet
    // Listen for loaded events from paragraphs
    this.addEventListener('loaded', this._onParagraphLoaded, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('loaded', this._onParagraphLoaded, true);
  }

  _onParagraphLoaded = (event) => {
    // - Only handle if we are waiting for a new paragraph
    // - This also ensures the component will new proccess the event it has fired itself
    if (this.pendingNewParagraphId && event.target.id === this.pendingNewParagraphId) {
      this.requestUpdate();
      this.pendingNewParagraphId = null;
    }
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

      this.dispatchEvent(
        new CustomEvent('loaded', {
          detail: { chapterData: data },
          bubbles: true,
          composed: true,
        })
      );

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
    if (!this.chapterData) {
      return html``;
    }

    // Check if user is logged in and has 'create' scope
    const canCreate = this.checkCreatePermission();

    return html`
      <slds-card no-footer>
        <span slot="header">${this.chapterData.name}</span>
        <div slot="actions">
        ${canCreate ? html`
          <slds-button-icon
            icon="utility:add"
            variant="container-filled"
            @click=${this.handleCreateParagraphClick}
          ></slds-button-icon>`
          : ''
        }
        <slds-button-icon
          icon="utility:link"
          variant="container-filled"
          @click=${this.handleShareClick}
        ></slds-button-icon>
        </div>
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

    let renderedParagraphs = paragraphs.map(
      (paragraph) => html`
        <div class="slds-col slds-p-bottom_small">
          <custom-paragraph
            id=${paragraph.id}
            data-name=${paragraph.name || ''}
          ></custom-paragraph>
        </div>
      `
    );

    return renderedParagraphs;
  }

  handleShareClick() {
    const shareUrl = `${location.origin}/${this.id}`;
    this.writeToClipboard(shareUrl);
    this.dispatchEvent(new CustomEvent('toast', {
      detail: {
        message: this.labels.labelNotifcationLinkCopied,
        variant: 'info',
      },
      bubbles: true,
      composed: true,
    }));
  }

  writeToClipboard(value) {
    navigator.clipboard.writeText(value).catch((err) => {
      console.error('Error copying text to clipboard:', err);
    });
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

  checkCreatePermission() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsedData = JSON.parse(authData);
      return parsedData?.authenticationResult.access?.scopes?.includes('create') || false;
    } catch (e) {
      console.error('Failed to parse authenticationResult from sessionStorage:', e);
      return false;
    }
  }

  handleCreateParagraphClick = async () => {
    // Fire a 'create' event with chapterId and storyId, and a callback
    if (!this.chapterData) return;

    const chapterId = this.chapterData.id;
    const storyId = this.chapterData.storyid || null; // Assuming storyId is part of chapterData
    this.fireCreateEvent_Paragraph(chapterId, storyId);
  };

  // ======= Create Event ========

  fireCreateEvent_Paragraph(chapterId, storyId) {
    let eventDatail = {}
    eventDatail.object = 'paragraph';
    eventDatail.payload = {
      chapterId,
      storyId,
      name: '',
      content: '',
      htmlcontent: '<slds-card no-footer><span slot="header">Neuer Absatz</span></slds-card>',
    };
    eventDatail.callback = this.createEventCallback_Paragraph.bind(this);

    this.dispatchEvent(
      new CustomEvent('create', {
        detail: eventDatail,
        bubbles: true,
        composed: true,
      })
    );
  }

  createEventCallback_Paragraph(error, data) {
    if (error) {
      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: this.labels.labelParagraphCreateError, variant: 'error' },
        bubbles: true,
        composed: true,
      }));
      return;
    }
    if(data) {
      let newParagraph = data.result;
      // Add the new paragraph to the list
      if (newParagraph.id) {
        this.dispatchEvent(
          new CustomEvent('toast', {
            detail: { message: this.labels.labelParagraphCreated, variant: 'success' },
            bubbles: true,
            composed: true,
          })
        );
        this.paragraphsData = [...this.paragraphsData, newParagraph];
        this.pendingNewParagraphId = newParagraph.id;
        // Do not call requestUpdate here; wait for loaded event
      }
    }
  }
}

customElements.define('custom-chapter', CustomChapter);
