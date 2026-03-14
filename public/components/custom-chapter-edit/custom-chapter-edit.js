import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import '/components/custom-publishing/custom-publishing.js';

class CustomChapterEdit extends LitElement {
  labels = {
    modalTitle: 'Kapitel erstellen',
    modalTitleEdit: 'Kapitel bearbeiten',
    labelCreateChapter: 'Kapitel erstellen',
    labelEditChapter: 'Kapitel bearbeiten',
    chapterName: 'Kapitelname',
    sortNumber: 'Sortierung',
    reversed: 'Reihenfolge umkehren',
    publishDate: 'Veröffentlichungsdatum',
    namePlaceholder: 'Name des Kapitels eingeben...',
    sortNumberPlaceholder: '1',
    createButton: 'Erstellen',
    saveButton: 'Speichern',
    cancelButton: 'Abbrechen',
    nameRequired: 'Kapitelname ist erforderlich',
    sortNumberRequired: 'Sortierung muss mindestens 1 sein',
    chapterCreated: 'Kapitel erstellt',
    chapterCreateError: 'Fehler beim Erstellen des Kapitels',
    chapterUpdated: 'Kapitel gespeichert',
    chapterUpdateError: 'Fehler beim Speichern des Kapitels',
    chapterLoadError: 'Fehler beim Laden des Kapitels',
  };

  static properties = {
    storyId: { type: String, attribute: 'story-id' },
    chapterId: { type: String, attribute: 'chapter-id' },
    name: { type: String, attribute: 'name' },
    sortNumber: { type: Number, attribute: 'sort-number' },
    reversed: { type: Boolean, attribute: 'reversed' },
    publishDate: { type: String, attribute: 'publish-date' },
    mode: { type: String }, // 'create' or 'edit' (kept for backward compatibility)
    chapterData: { type: Object },
    chapters: { type: Array }, // Array of existing chapters for sort number calculation
    _activeTab: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }

    .form-row {
      margin-bottom: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .form-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 768px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }

    .tab-panel {
      padding-top: 1rem;
    }
  `;

  constructor() {
    super();
    this.storyId = null;
    this.chapterId = null;
    this.name = '';
    this.sortNumber = 1;
    this.reversed = false;
    this.publishDate = null;
    this.mode = 'create';
    this.chapterData = {};
    this.chapters = [];
    this._activeTab = 'edit';
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
    this.initializeFormData();
  }

  initializeFormData() {
    if (this.mode === 'create') {
      this.chapterData = {
        name: '',
        sortNumber: 1,
        reversed: false,
        publishDate: null,
        storyId: this.storyId
      };
    }
  }

  get _isEditMode() {
    return !!this.chapterId;
  }

  render() {
    const canCreate = this.checkCreatePermission();
    const canEdit = this._isEditMode && this.checkEditPermission();
    const modalTitle = this._isEditMode ? this.labels.modalTitleEdit : this.labels.modalTitle;
    const confirmLabel = this._isEditMode ? this.labels.saveButton : this.labels.createButton;

    return html`
      <!-- Edit Chapter Button -->
      ${canEdit ? html`
        <slds-button-icon
          icon="utility:edit"
          variant="container-filled"
          title="${this.labels.labelEditChapter}"
          @click=${this._handleEditButtonClick}
        ></slds-button-icon>`
        : ''
      }

      <!-- Create Chapter Button -->
      ${!this._isEditMode && canCreate ? html`
        <slds-button-icon
          icon="utility:add"
          variant="container-filled"
          title="${this.labels.labelCreateChapter}"
          @click=${this._handleCreateButtonClick}
        ></slds-button-icon>`
        : ''
      }

      <!-- Modal -->
      <slds-modal title="${modalTitle}" @close=${this._handleModalClose}>

        <!-- Tabs Navigation -->
        <div class="slds-tabs_default">
          <ul class="slds-tabs_default__nav" role="tablist">
            <li
              class="slds-tabs_default__item ${this._activeTab === 'edit' ? 'slds-is-active' : ''}"
              role="presentation"
            >
              <a class="slds-tabs_default__link" role="tab" @click=${() => this._setTab('edit')}>
                Edits
              </a>
            </li>
            ${this._isEditMode ? html`
              <li
                class="slds-tabs_default__item ${this._activeTab === 'publish' ? 'slds-is-active' : ''}"
                role="presentation"
              >
                <a class="slds-tabs_default__link" role="tab" @click=${() => this._setTab('publish')}>
                  Publish
                </a>
              </li>
            ` : ''}
          </ul>

          <!-- Edits Tab Panel -->
          <div class="slds-tabs_default__content tab-panel ${this._activeTab === 'edit' ? 'slds-show' : 'slds-hide'}">
            ${this.renderEditTab()}
          </div>

          <!-- Publish Tab Panel -->
          ${this._isEditMode ? html`
            <div class="slds-tabs_default__content tab-panel ${this._activeTab === 'publish' ? 'slds-show' : 'slds-hide'}">
              <custom-publishing
                record-id="${this.chapterId}"
                object-name="chapter"
                publish-date="${this.publishDate || ''}"
              ></custom-publishing>
            </div>
          ` : ''}
        </div>

        <!-- Modal Footer -->
        <div slot="footer">
          <button class="slds-button slds-button_neutral" @click=${this._handleCancel}>
            ${this.labels.cancelButton}
          </button>
          ${this._activeTab === 'edit' ? html`
            <button class="slds-button slds-button_brand" @click=${this._handleConfirm}>
              ${confirmLabel}
            </button>
          ` : ''}
        </div>
      </slds-modal>
    `;
  }

  renderEditTab() {
    return html`
      <!-- Name Field -->
      <div class="slds-grid slds-wrap slds-grid_vertical-align-end">
        <div class="slds-col slds-size_1-of-1">
          <slds-input
            type="text"
            label="${this.labels.chapterName}"
            placeholder="${this.labels.namePlaceholder}"
            value="${this.chapterData?.name || ''}"
            @change="${this._handleNameChange}"
            required
          ></slds-input>
        </div>

        <div class="slds-col slds-size_1-of-4">
           <slds-input
            type="number"
            label="${this.labels.sortNumber}"
            placeholder="${this.labels.sortNumberPlaceholder}"
            value="${this.chapterData?.sortNumber || 1}"
            @change="${this._handleSortNumberChange}"
            min="1"
            required
          ></slds-input>
        </div>

        <div class="slds-col slds-size_2-of-4 slds-col_bump-left">
          <div class="slds-grid slds-wrap">
            <slds-toggle
              label="${this.labels.reversed}"
              ?checked="${this.chapterData?.reversed || false}"
              @change="${this._handleReversedChange}"
            ></slds-toggle>
          </div>
        </div>
      </div>
    `;
  }

  // ==================================================
  // Public API Methods
  // ==================================================

  show() {
    const modal = this.shadowRoot.querySelector('slds-modal');
    if (modal) {
      modal.show();
    }
  }

  hide() {
    const modal = this.shadowRoot.querySelector('slds-modal');
    if (modal) {
      modal.hide();
    }
  }

  setChapterData(data) {
    this.chapterData = { ...data };
    this.requestUpdate();
  }

  reset() {
    this.initializeFormData();
    this.requestUpdate();
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

  // ==================================================
  // Event Handlers
  // ==================================================

  _handleCreateButtonClick() {
    // Calculate next sort number
    let nextSortNumber = 1;
    if (this.chapters && this.chapters.length > 0) {
      const maxSortNumber = Math.max(...this.chapters.map(ch => ch.sortnumber || 0));
      nextSortNumber = maxSortNumber + 1;
    }

    // Set default data
    this.setChapterData({
      name: 'Neues Kapitel',
      sortNumber: nextSortNumber,
      reversed: false,
      publishDate: null,
      storyId: this.storyId
    });

    this.show();
  }

  _handleNameChange(event) {
    const input =  event.detail.value || event.target.value;
    this.chapterData = {
      ...this.chapterData,
      name: input
    };
  }

  _handleSortNumberChange(event) {
    const input = event.detail;
    this.chapterData = {
      ...this.chapterData,
      sortNumber: parseInt(input.value) || 1
    };
  }

  _handlePublishDateChange(event) {
    const input = event.detail;
    this.chapterData = {
      ...this.chapterData,
      publishDate: input.value || null
    };
  }

  _handleReversedChange(event) {
    this.chapterData = {
      ...this.chapterData,
      reversed: event.target.checked
    };
  }

  _handleModalClose() {
    this._activeTab = 'edit';
    this.reset();
    this._dispatchCancelEvent();
  }

  _setTab(tabName) {
    this._activeTab = tabName;
  }

  _handleCancel() {
    this.hide();
  }

  _handleEditButtonClick() {
    this.setChapterData({
      id: this.chapterId,
      name: this.name,
      sortNumber: this.sortNumber,
      reversed: this.reversed,
      publishDate: null,
      storyId: this.storyId,
    });
    this.show();
  }

  _handleConfirm() {
    // Validate form
    const validation = this._validate();
    if (!validation.valid) {
      this._dispatchToast(validation.message, 'error');
      return;
    }

    if (this._isEditMode) {
      this._updateChapter();
    } else {
      this._createChapter();
    }
    this.hide();
  }

  // ==================================================
  // Private Methods
  // ==================================================

  _validate() {
    const name = this.chapterData?.name?.trim();
    if (!name) {
      return { valid: false, message: this.labels.nameRequired };
    }

    const sortNumber = this.chapterData?.sortNumber;
    if (!sortNumber || sortNumber < 1) {
      return { valid: false, message: this.labels.sortNumberRequired };
    }

    return { valid: true };
  }

  _createChapter() {
    const eventDetail = {
      object: 'chapter',
      payload: {
        storyId: this.storyId,
        name: this.chapterData.name,
        sortNumber: this.chapterData.sortNumber,
        reversed: this.chapterData.reversed || false,
        publishDate: this.chapterData.publishDate || null
      },
      callback: this._createEventCallback.bind(this)
    };

    this.dispatchEvent(
      new CustomEvent('create', {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      })
    );
  }

  _createEventCallback(error, data) {
    if (error) {
      this._dispatchToast(this.labels.chapterCreateError, 'error');
      return;
    }

    if (data) {
      const newChapter = data.result;
      if (newChapter.id) {
        this._dispatchToast(this.labels.chapterCreated, 'success');
        this._dispatchChapterCreated(newChapter);
      }
    }
  }

  _updateChapter() {
    const eventDetail = {
      object: 'chapter',
      payload: {
        id: this.chapterId,
        storyId: this.chapterData.storyId || this.storyId,
        name: this.chapterData.name,
        sortNumber: this.chapterData.sortNumber,
        reversed: this.chapterData.reversed || false,
        publishDate: this.chapterData.publishDate || null,
      },
      callback: this._updateEventCallback.bind(this)
    };

    this.dispatchEvent(
      new CustomEvent('save', {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      })
    );
  }

  _updateEventCallback(error, data) {
    if (error) {
      this._dispatchToast(this.labels.chapterUpdateError, 'error');
      return;
    }

    if (data) {
      const updatedChapter = data.result;
      if (updatedChapter.id) {
        this._dispatchToast(this.labels.chapterUpdated, 'success');
        this._dispatchChapterUpdated(updatedChapter);
        this.requestUpdate();
      }
    }
  }

  _formatDateForInput(dateValue) {
    if (!dateValue) return '';

    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else {
      return '';
    }

    return date.toISOString().split('T')[0];
  }

  _dispatchToast(message, variant) {
    this.dispatchEvent(new CustomEvent('toast', {
      detail: { message, variant },
      bubbles: true,
      composed: true,
    }));
  }

  _dispatchChapterCreated(chapterData) {
    this.dispatchEvent(new CustomEvent('chapter-created', {
      detail: { chapterData },
      bubbles: true,
      composed: true,
    }));
  }

  _dispatchChapterUpdated(chapterData) {
    this.dispatchEvent(new CustomEvent('chapter-updated', {
      detail: { chapterData },
      bubbles: true,
      composed: true,
    }));
  }

  _dispatchCancelEvent() {
    this.dispatchEvent(new CustomEvent('chapter-edit-cancel', {
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('custom-chapter-edit', CustomChapterEdit);