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

    .editable.hasDraft {
      border-color:rgb(255, 78, 78);
      border-width: 1px;
      border-style: solid;
      border-radius: 5px;
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
    this._paragraphDataBackup = null; // Backup of the original data from the server
    this._paragraphData = null; // Data to be displayed in the component
    this.editMode = false; // Internal flag for edit mode
    this.activeTab = 'text'; // Default active tab
    this.spinner = true; // Spinner visible by default
    this.draftMode = false; // Track if user is in draft mode
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
    this.spinner = true; // Show spinner when loading starts
    this.fireQueryEvent_Paragraph(this.id, this.queryEventCallback_Paragraph.bind(this));
  }

  render() {
    // Always render spinner, but toggle its visibility
    let content = html``;
    if (this._paragraphData) {
      if (this.editMode) {
        content = this.renderEditMode();
      } else {
        let localdraft = localStorage.getItem(this.id);
        let paragraphData = localdraft ? JSON.parse(localdraft) : this._paragraphData;
        const { name, content: textContent, htmlcontent } = paragraphData;
        const displayOption = htmlcontent ? 'html-readonly' : 'text-readonly';
        if (displayOption === 'text-readonly') {
          content = this.renderTextReadonly(name, textContent);
        } else if (displayOption === 'html-readonly') {
          content = this.renderHtmlReadonly(htmlcontent);
        }
      }
    }
    return html`
      <slds-spinner size="x-small" ?hidden=${!this.spinner}></slds-spinner>
      ${content}
    `;
  }

  renderTextReadonly(name, content) {
    const canEdit = this.checkEditPermission();
    let classesStringList = [];
    classesStringList.push('slds-grid');
    classesStringList.push('slds-wrap');
    classesStringList.push(canEdit ? 'editable' : '');
    classesStringList.push(this.hasDraft ? 'hasDraft' : '');
    const classesString = classesStringList.join(' ');
    return html`
      <div id="content" class=${classesString}>
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
    let classesStringList = [];
    classesStringList.push(canEdit ? 'editable' : '');
    classesStringList.push(this.hasDraft ? 'hasDraft' : '');
    const classesString = classesStringList.join(' ');
    return html`
      <div id="content" class=${classesString}>
        <div .innerHTML=${htmlcontent}></div>
        ${canEdit ? html`<button @click=${this.handleEditClick}>Bearbeiten</button>` : ''}
      </div>
    `;
  }

  renderEditMode() {
    let localdraft = localStorage.getItem(this.id);
    localdraft = localdraft ? JSON.parse(localdraft) : null;
    let paragraphData = localdraft || this._paragraphData;

    const { name, content, htmlcontent, sortnumber } = paragraphData;
    let buttons;
    if (this.draftMode) {
      buttons = html`
        <div class="slds-col slds-size_1-of-4">
          <button @click=${this.handleDraftSaveClick}>Save</button>
        </div>
        <div class="slds-col slds-size_1-of-4">
          <button @click=${this.handleDraftCancelClick}>Cancel</button>
        </div>
        <div class="slds-col slds-size_1-of-4">
          <button @click=${this.handleDraftApplyClick}>Apply</button>
        </div>
        <div class="slds-col slds-size_1-of-4">
          <button @click=${this.handleDraftDropClick}>Drop</button>
        </div>
      `;
    } else {
      buttons = html`
        <div class="slds-col slds-size_1-of-3">
          <button @click=${this.handleEditSaveClick}>Save</button>
        </div>
        <div class="slds-col slds-size_1-of-3">
          <button @click=${this.handleEditCancelClick}>Cancel</button>
        </div>
        <div class="slds-col slds-size_1-of-3">
          <button @click=${this.handleDraftEnableClick}>Enable Draft</button>
        </div>
      `;
    }
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
        ${buttons}
      </div>
    `;
  }

  handleEditClick() {
    this.enterEditMode();
  }

  enterEditMode() {
    this.editMode = true;
    if (this.hasDraft) {
      try {
        const draft = JSON.parse(localStorage.getItem(this.id));
        if (draft) {
          this._paragraphData = { ...draft };
          this.draftMode = true;
        } else {
          this._paragraphData = { ...this._paragraphDataBackup };
          this.draftMode = false;
        }
      } catch {
        this._paragraphData = { ...this._paragraphDataBackup };
        this.draftMode = false;
      }
    } else {
      this._paragraphData = { ...this._paragraphDataBackup };
      this.draftMode = false;
    }
    this.requestUpdate();
  }

  handleEditInputChange(event) {
    const { id, value } = event.target;
    // Update the paragraph data with the new value
    const key = id.replace('edit-', ''); // Remove 'edit-' prefix from id
    this._paragraphData[key] = value; // Update other fields
    this._paragraphData = { ...this._paragraphData, [key]: value };
  }

  handleEditSaveClick() {
    this.editSaveAction();
  }
  editSaveAction() {
    this.editMode = false;
    this.draftMode = false;
    this.fireSaveEvent_Paragraph();
    this.requestUpdate();
  }

  handleEditCancelClick() {
    this.editCancelAction();
  }
  editCancelAction() {
    this._paragraphData = { ...this._paragraphDataBackup };
    this.editMode = false;
    this.draftMode = false;
    this.requestUpdate();
  }

  handleDraftEnableClick() {
    this.draftEnableAction();
  }
  draftEnableAction() {
    // Save paragraphData to localStorage
    if (this._paragraphData && this._paragraphData.id) {
      const draftObj = { ...this._paragraphData, draft: true };
      localStorage.setItem(this._paragraphData.id, JSON.stringify(draftObj));
    }
    this.draftMode = true;
    this.requestUpdate();
  }

  handleDraftDropClick() {
    this.draftDropAction();
  }
  draftDropAction() {
    // Remove data from localStorage and restore backup
    if (this._paragraphData && this._paragraphData.id) {
      localStorage.removeItem(this._paragraphData.id);
    }
    this._paragraphData = { ...this._paragraphDataBackup };
    this.editMode = false;
    this.draftMode = false;
    this.requestUpdate();
  }

  handleDraftSaveClick() {
    this.draftSaveAction();
  }
  draftSaveAction() {
    // Write paragraphData to localStorage
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
    this.draftMode = false;
    this.requestUpdate();
  }

  handleDraftCancelClick() {
    this.draftCancelAction();
  }
  draftCancelAction() {
    this._paragraphData = { ...this._paragraphDataBackup };
    const draftStr = localStorage.getItem(this._paragraphData.id);
    if (draftStr) {
      this._paragraphData = JSON.parse(draftStr);
    }
    this.editMode = false;
    this.draftMode = false;
    this.requestUpdate();
  }

  handleDraftApplyClick() {
    this.draftApplyAction();
  }
  draftApplyAction() {
    // Fire save-event with localStorage, then remove localStorage
    let draft = null;
    if (this._paragraphData && this._paragraphData.id) {
      const draftStr = localStorage.getItem(this._paragraphData.id);
      if (draftStr) {
        draft = JSON.parse(draftStr);
      }
    }
    if (draft) {
      this.editMode = false;
      this.draftMode = false;
      this.fireSaveEvent_Paragraph(draft);
      localStorage.removeItem(this._paragraphData.id);
    } else {
      // fallback: just save current data
      this.editMode = false;
      this.draftMode = false;
      this.fireSaveEvent_Paragraph();
    }
    this.requestUpdate();
  }

  handleInputChange(event) {
    const { id, value } = event.target;
    this._paragraphData = { ...this._paragraphData, [id]: value };
    this.requestUpdate();
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
      this.spinner = false;
      return;
    }
    this._paragraphData = data;
    this._paragraphDataBackup = { ...data }; // Backup the original data
    this.spinner = false; // Hide spinner when data is loaded
    this.requestUpdate();
  }

// ========== Save Event ==========

  fireSaveEvent_Paragraph(paragraphData) {
    if (!paragraphData && !this._paragraphData) return;

    let paragraphdataToSave = paragraphData || this._paragraphData;
    delete paragraphdataToSave.draft; // Remove draft flag if present

    let eventDetail = {};
    eventDetail.object = 'paragraph';
    eventDetail.payload = paragraphdataToSave;
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
      // Remove draft after successful save
      if (this._paragraphData && this._paragraphData.id) {
        localStorage.removeItem(this._paragraphData.id);
      }
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
