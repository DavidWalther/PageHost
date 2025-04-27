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

    #content.editable:hover,
    #content.editable:focus-within {
      border-radius: 5px;
      bolder-width: 1px;
      border-style: solid;
      border-color:rgb(69, 111, 209);
      padding: 3px;
    }

    #content.editable:hover button,
    #content.editable:focus-within button {
      display: block;
    }

    .editing {
      border-radius: 5px;
      bolder-width: 1px;
      border-style: solid;
      border-color: rgb(136, 140, 150);
      padding: 3px;
    }

    .editing * {
      width: 100%;
    }
  `;

  constructor() {
    super();
    this.id = '';
    this._paragraphData = null;
    this.editMode = false; // Internal flag for edit mode
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

    if (this.editMode) {
      let markup = this.renderEditMode(); // Render edit mode if the flag is set
      return markup;
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
        ${canEdit ? html`<button @click=${this.handleActionClick}>Action</button>` : ''}
      </div>
    `;
  }

  renderHtmlReadonly(htmlcontent) {
    const canEdit = this.checkEditPermission();
    return html`
      <div id="content" class=${canEdit ? 'editable' : ''}>
        <div .innerHTML=${htmlcontent}></div>
        ${canEdit ? html`<button @click=${this.handleActionClick}>Action</button>` : ''}
      </div>
    `;
  }

  renderEditMode() {
    const { name, content } = this._paragraphData;
    return html`
      <div class="slds-grid slds-wrap editing">
        <div class="slds-col slds-size_1-of-1 "><label for="edit-name">Name</label></div>
        <div class="slds-col slds-size_1-of-1 slds-m-bottom_medium"><input type="text" id="edit-name" .value=${name || ''} @input=${this.handleEditInputChange} /></div>
        <div class="slds-col slds-size_1-of-1 "><label for="edit-content">Content</label></div>
        <div class="slds-col slds-size_1-of-1 "><textarea id="edit-content" .value=${content || ''} @input=${this.handleEditInputChange}></textarea></div>
        <div class="slds-col slds-size_1-of-2 ">
          <button @click=${this.handleSaveEdit}>Save</button>
        </div>
        <div class="slds-col slds-size_1-of-2 ">
          <button @click=${this.handleCancelEdit}>Cancel</button>
        </div>
      </div>
    `;
  }

  handleActionClick() {
    this.editMode = true; // Enable edit mode
    this.requestUpdate();
  }

  handleEditInputChange(event) {
    const { id, value } = event.target;
    const key = id === 'edit-name' ? 'name' : 'content';
    this._paragraphData = { ...this._paragraphData, [key]: value };
  }

  handleSaveEdit() {
    console.log('Saving edited data:', this._paragraphData);
    this.editMode = false; // Exit edit mode
    this.requestUpdate();
  }

  handleCancelEdit() {
    console.log('Edit canceled');
    this.editMode = false; // Exit edit mode
    this.requestUpdate();
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
    return true; // Always return true for edit permission // this must be removed after testing
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
