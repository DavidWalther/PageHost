import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class CustomParagraph extends LitElement {
  static properties = {
    id: { type: String },
  };

  static styles = css`
    /* Add SLDS styling for your component here */
    #content {
      position: relative;
    }

    #content button {
      display: none;
    }

    #content.editable:hover {
      border-radius: 5px;
      bolder-width: 1px;
      border-style: solid;
      border-color:#abafb8;
      padding: 3px;
    }

    #content.editable:hover button {
      display: block;
    }
  `;

  constructor() {
    super();
    this.id = '';
    this._paragraphData = null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this.fireQueryEvent_Paragraph(this.id, this.queryEventCallback_Paragraph.bind(this));
  }

  render() {
    if (!this._paragraphData) {
      return html`<slds-spinner size="x-small" ?hidden=${!this.spinner}></slds-spinner>`;
    }

    const { name, htmlcontent, content } = this._paragraphData;
    const displayOption = htmlcontent ? 'html-readonly' : 'text-readonly';

    switch (displayOption) {
      case 'text-readonly':
        return this.renderTextReadonly(name, content);
      case 'html-readonly':
        return this.renderHtmlReadonly(htmlcontent);
      default:
        return html``;
    }
  }

  renderTextReadonly(name, content) {
    const canEdit = this.checkEditPermission();
    return html`
      <div id="content" class=${canEdit ? 'editable' : ''}>
        <p>
          ${name ? html`<b>${name}</b><br>` : ''}
          ${content.split('\n').map((line) => html`${line}<br>`)}
        </p>
        ${canEdit ? html`<button @click=${this.handleClickSave}>Action</button>` : ''}
      </div>
    `;
  }

  renderHtmlReadonly(htmlcontent) {
    const canEdit = this.checkEditPermission();
    return html`
      <div id="content" class=${canEdit ? 'editable' : ''}>
        <div .innerHTML=${htmlcontent}></div>
        ${canEdit ? html`<button @click=${this.handleClickSave}>Action</button>` : ''}
      </div>
    `;
  }

  handleInputChange(event) {
    const { id, value } = event.target;
    this._paragraphData = { ...this._paragraphData, [id]: value };
    this.requestUpdate();
  }

  handleClickSave() {
    console.log('Saving data:', this._paragraphData);
  }

  checkEditPermission() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;

    try {
      const parsedData = JSON.parse(authData);
      return parsedData?.authenticationResult.access?.scopes?.includes('edit') || false;
    } catch (e) {
      console.error('Failed to parse authenticationResult from sessionStorage:', e);
      return false;
    }
  }

  fireQueryEvent_Paragraph(paragraphid, callback) {
    if (!paragraphid) return;
    const payload = { object: 'paragraph', id: paragraphid };
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true,
      })
    );
  }

  queryEventCallback_Paragraph(error, data) {
    if (error) {
      console.error(error);
      return;
    }
    this._paragraphData = data;
    this.requestUpdate();
  }
}

customElements.define('custom-paragraph', CustomParagraph);
