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
      border-width: medium;
      border-style: solid;
      border-color: rgb(136, 140, 150);
      padding: 5px;
    }

    .editing * {
      width: 100%;
    }

    .editing textarea {
      height: 50vh;
      max-height: 250px;
    }
  `;

  constructor() {
    super();
    this.id = '';
    this._paragraphDataBackup = null;
    this._paragraphData = null;
    this.editMode = false; // Internal flag for edit mode
    this.activeTab = 'text'; // Default active tab
    this.draftChecked = false; // Track draft checkbox state
  }

  get hasDraft() {
    if (!this.id) return false;
    try {
      const draft = localStorage.getItem(this.id);
      return !!draft;
    } catch {
      return false;
    }
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
        ${canEdit ? html`<button @click=${this.handleEditClick}>Bearbeiten</button>` : ''}
      </div>
    `;
  }

  renderHtmlReadonly(htmlcontent) {
    const canEdit = this.checkEditPermission();
    return html`
      <div id="content" class=${canEdit ? 'editable' : ''}>
        <div .innerHTML=${htmlcontent}></div>
        ${canEdit ? html`<button @click=${this.handleEditClick}>Bearbeiten</button>` : ''}
      </div>
    `;
  }

  renderEditMode() {
    const { name, content, htmlcontent, sortnumber} = this._paragraphData;
    return html`
      <div class="slds-grid slds-wrap editing">
        <div class="slds-col slds-size_1-of-1"><label for="edit-name">Name</label></div>
        <div class="slds-col slds-size_1-of-1 slds-m-bottom_medium">
          <input type="text" id="edit-name" .value=${name || ''} @input=${this.handleEditInputChange} />
        </div>
        <div class="slds-col slds-size_1-of-1"><label for="edit-sortnumber">Sort Number</label></div>
        <div class="slds-col slds-size_1-of-1 slds-m-bottom_medium">
          <input type="text" id="edit-sortnumber" .value=${sortnumber || ''} @input=${this.handleEditInputChange} />
        </div>
        <div class="slds-col slds-size_1-of-1">
          <div class="slds-tabs_default">
            <ul class="slds-tabs_default__nav" role="tablist">
              <li class="slds-tabs_default__item ${this.activeTab === 'text' ? 'slds-active slds-has-focus' : ''}" title="Text Input" role="presentation">
                <a class="slds-tabs_default__link" role="tab" tabindex="0" aria-selected=${this.activeTab === 'text'} aria-controls="text-tab" id="text-tab-link" @click=${() => this.switchTab('text')}>Text</a>
              </li>
              <li class="slds-tabs_default__item ${this.activeTab === 'html' ? 'slds-active slds-has-focus' : ''}" title="HTML Input" role="presentation">
                <a class="slds-tabs_default__link" role="tab" tabindex="0" aria-selected=${this.activeTab === 'html'} aria-controls="html-tab" id="html-tab-link" @click=${() => this.switchTab('html')}>HTML</a>
              </li>
            </ul>
            <div id="text-tab" class="slds-tabs_default__content ${this.activeTab === 'text' ? 'slds-show' : 'slds-hide'}" role="tabpanel" aria-labelledby="text-tab-link">
              <textarea id="edit-content" .value=${content || ''} @input=${this.handleEditInputChange}></textarea>
            </div>
            <div id="html-tab" class="slds-tabs_default__content ${this.activeTab === 'html' ? 'slds-show' : 'slds-hide'}" role="tabpanel" aria-labelledby="html-tab-link">
              <textarea id="edit-htmlcontent" .value=${htmlcontent || ''} @input=${this.handleEditInputChange}></textarea>
            </div>
          </div>
        </div>
        <div class="slds-col slds-size_1-of-3">
          <button @click=${this.handleSaveEdit}>Save</button>
        </div>
        <div class="slds-col slds-size_1-of-3">
          <button @click=${this.handleCancelEdit}>Cancel</button>
        </div>
        <div class="slds-col slds-size_1-of-3">
          <div slds-grid slds-wrap>
            <div class="slds-col slds-size_1-of-1" style="text-align: center;">
              <label for="draft-checked">Draft</label><br>
            </div>
            <div class="slds-col slds-size_1-of-1 slds-align_absolute-center">
              <input id="draft-checked" type="checkbox" .checked=${this.draftChecked} @change=${this.handleDraftCheckboxChange} />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  handleEditClick() {
    this.editMode = true; // Enable edit mode
    // Reset draft checkbox to false on entering edit mode
    this.draftChecked = false;
    this.requestUpdate();
  }

  handleEditInputChange(event) {
    const { id, value } = event.target;
    // Update the paragraph data with the new value
    const key = id.replace('edit-', ''); // Remove 'edit-' prefix from id
    this._paragraphData[key] = value; // Update other fields
    this._paragraphData = { ...this._paragraphData, [key]: value };
  }

  handleDraftCheckboxChange(event) {
    this.draftChecked = event.target.checked;
    this.requestUpdate();
  }

  handleSaveEdit() {
    if (this.draftChecked) {
      // Save as draft in localStorage
      if (this._paragraphData && this._paragraphData.id) {
        const draftObj = { ...this._paragraphData, draft: true };
        localStorage.setItem(this._paragraphData.id, JSON.stringify(draftObj));
        this.dispatchEvent(
          new CustomEvent('toast', {
            detail: { message: 'Draft saved locally', variant: 'info' },
            bubbles: true,
            composed: true,
          })
        );
      }
      this.editMode = false;
      this.requestUpdate();
      return;
    }
    this.editMode = false; // Exit edit mode
    this.fireSaveEvent_Paragraph(); // Trigger save event
    this.requestUpdate();
  }

  handleCancelEdit() {
    this.editMode = false; // Exit edit mode
    this._paragraphData = { ...this._paragraphDataBackup }; // Restore original data
    this.requestUpdate();
  }

  handleInputChange(event) {
    const { id, value } = event.target;
    this._paragraphData = { ...this._paragraphData, [id]: value };
    this.requestUpdate();
  }

  handleClickSave() {
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

  switchTab(tab) {
    this.activeTab = tab;
    this.requestUpdate();
  }

// ========== Query Event ==========

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
    this._paragraphDataBackup = { ...data }; // Backup the original data
    this.requestUpdate();
  }

// ========== Save Event ==========

  fireSaveEvent_Paragraph() {
    if (!this._paragraphData) return;

    let eventDetail = {};
    eventDetail.object = 'paragraph';
    eventDetail.payload = this._paragraphData;
    eventDetail.callback = this.saveEventCallback_Paragraph.bind(this);

    this.dispatchEvent(
      new CustomEvent('save', {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      })
    );
  }

  saveEventCallback_Paragraph(error, data) {
    if (error) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: error, variant: 'error' },  
          bubbles: true,
          composed: true,
        })
      );
      return;
    }
    if (data) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: 'Saved', variant: 'success' },  
          bubbles: true,
          composed: true,
        })
      );
      this._paragraphDataBackup = this._paragraphData; // Update the backup with the new 
    }
    this.requestUpdate();
  }
}

customElements.define('custom-paragraph', CustomParagraph);
