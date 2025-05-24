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
    this.draftChecked = false; // Track draft checkbox state
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
    return html`
      <slds-spinner size="x-small" ?hidden=${!this.spinner}></slds-spinner>
      ${this._paragraphData
        ? (this.editMode
            ? this.renderEditMode()
            : (() => {
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
              })())
        : html``}
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
    const { name, content, htmlcontent, sortnumber } = this._paragraphData;
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
        ${this.draftMode
          ? html`
            <div class="slds-col slds-size_1-of-4">
              <button @click=${this.handleSaveDraftClick}>Save</button>
            </div>
            <div class="slds-col slds-size_1-of-4">
              <button @click=${this.handleCancelEditClick}>Cancel</button>
            </div>
            <div class="slds-col slds-size_1-of-4">
              <button @click=${this.handleApplyDraftClick}>Apply</button>
            </div>
            <div class="slds-col slds-size_1-of-4">
              <button @click=${this.handleDropDraftClick}>Drop</button>
            </div>
          `
          : html`
            <div class="slds-col slds-size_1-of-3">
              <button @click=${this.handleSaveParagraphClick}>Save</button>
            </div>
            <div class="slds-col slds-size_1-of-3">
              <button @click=${this.handleCancelEditClick}>Cancel</button>
            </div>
            <div class="slds-col slds-size_1-of-3">
              <button @click=${this.handleEnableDraftClick}>Enable Draft</button>
            </div>
          `
        }
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
          this.draftChecked = true;
          this.draftMode = true;
        } else {
          this._paragraphData = { ...this._paragraphDataBackup };
          this.draftChecked = false;
          this.draftMode = false;
        }
      } catch {
        this._paragraphData = { ...this._paragraphDataBackup };
        this.draftChecked = false;
        this.draftMode = false;
      }
    } else {
      this._paragraphData = { ...this._paragraphDataBackup };
      this.draftChecked = false;
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

  handleEnableDraftClick() {
    this.enableDraft();
  }

  enableDraft() {
    this.draftMode = true;
    this.draftChecked = true;
    this.requestUpdate();
  }

  handleApplyDraftClick() {
    this.applyDraft();
  }

  applyDraft() {
    // Apply draft to main data, remove draft, exit draft mode
    if (this._paragraphData && this._paragraphData.id) {
      localStorage.removeItem(this._paragraphData.id);
    }
    this.draftMode = false;
    this.draftChecked = false;
    // Save as normal (fire save event)
    this.saveParagraph();
  }

  handleDropDraftClick() {
    this.dropDraft();
  }

  dropDraft() {
    // Remove draft and exit draft mode, restore original data
    if (this._paragraphData && this._paragraphData.id) {
      localStorage.removeItem(this._paragraphData.id);
    }
    this.draftMode = false;
    this.draftChecked = false;
    this._paragraphData = { ...this._paragraphDataBackup };
    this.requestUpdate();
  }

  handleSaveDraftClick() {
    this.saveAsDraft();
  }

  saveAsDraft() {
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
    this.draftMode = false;
    this.requestUpdate();
  }

  handleSaveParagraphClick() {
    this.saveParagraph();
  }

  saveParagraph() {
    delete this._paragraphData.draft; // Remove draft property if it exists
    // Do not remove draft here; remove after successful save
    this.editMode = false; // Exit edit mode
    this.draftMode = false;
    this.fireSaveEvent_Paragraph(); // Trigger save event
    this.requestUpdate();
  }

  handleCancelEditClick() {
    this.cancelEdit();
  }

  cancelEdit() {
    this.editMode = false; // Exit edit mode
    this.draftMode = false;
    this._paragraphData = { ...this._paragraphDataBackup }; // Restore original data
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
