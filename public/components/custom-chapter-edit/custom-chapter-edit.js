import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

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
    mode: { type: String }, // 'create' or 'edit' (kept for backward compatibility)
    chapterData: { type: Object },
    chapters: { type: Array }, // Array of existing chapters for sort number calculation
    // The host is the trigger (e.g. the "+" tile of the navigation modal):
    // no button of its own; the host calls openCreate().
    noTrigger: { type: Boolean, attribute: 'no-trigger' },
  };

  static styles = css`
    :host {
      display: block;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `;

  constructor() {
    super();
    this.storyId = null;
    this.chapterId = null;
    this.name = '';
    this.sortNumber = 1;
    this.reversed = false;
    this.mode = 'create';
    this.chapterData = {};
    this.chapters = [];
    this.noTrigger = false;
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
        storyId: this.storyId,
      };
    }
  }

  get _isEditMode() {
    return !!this.chapterId;
  }

  get _isCreateMode() {
    return !this.chapterId;
  }

  render() {
    const canCreate = !this.noTrigger && this.checkCreatePermission();
    const canEdit =
      !this.noTrigger && this._isEditMode && this.checkEditPermission();
    const modalTitle = this._isEditMode
      ? this.labels.modalTitleEdit
      : this.labels.modalTitle;
    const confirmLabel = this._isEditMode
      ? this.labels.saveButton
      : this.labels.createButton;

    return html`
      <!-- Edit Chapter Button -->
      ${
        canEdit
          ? html` <slds-button-icon
              icon="utility:edit"
              variant="container-filled"
              title="${this.labels.labelEditChapter}"
              @click=${this._handleEditButtonClick}
            ></slds-button-icon>`
          : ''
      }

      <!-- Create Chapter Button -->
      ${
        !this._isEditMode && canCreate
          ? html` <slds-button-icon
              icon="utility:add"
              variant="container-filled"
              title="${this.labels.labelCreateChapter}"
              @click=${this._handleCreateButtonClick}
            ></slds-button-icon>`
          : ''
      }

      <!-- Modal -->
      <slds-modal heading="${modalTitle}" @close=${this._handleModalClose}>
        <!-- Modal Content -->
        ${this.renderForm()}

        <!-- Modal Footer -->
        <div slot="footer">
          <button
            class="slds-button slds-button_neutral"
            @click=${this._handleCancel}
          >
            ${this.labels.cancelButton}
          </button>
          <button
            class="slds-button slds-button_brand"
            @click=${this._handleConfirm}
          >
            ${confirmLabel}
          </button>
        </div>
      </slds-modal>
    `;
  }

  /**
   * The form: name, sort number and the reversed order. Publishing is not
   * here — a node is published through its own button (custom-node-view,
   * custom-node), so the dialog has no tabs.
   */
  renderForm() {
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
            value="${this.chapterData?.sortNumber ?? ''}"
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
              @toggle="${this._handleReversedChange}"
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
      return (
        parsedData?.authenticationResult.access?.scopes?.includes('create') ||
        false
      );
    } catch (e) {
      console.error(
        'Failed to parse authenticationResult from sessionStorage:',
        e
      );
      return false;
    }
  }

  checkEditPermission() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsedData = JSON.parse(authData);
      return (
        parsedData?.authenticationResult.access?.scopes?.includes('edit') ||
        false
      );
    } catch (e) {
      console.error(
        'Failed to parse authenticationResult from sessionStorage:',
        e
      );
      return false;
    }
  }

  // ==================================================
  // Event Handlers
  // ==================================================

  _handleCreateButtonClick() {
    this.openCreate();
  }

  /**
   * Opens the dialog in create mode — for a host that is its own trigger
   * (`no-trigger`). Proposes "Neues Kapitel" and the highest sortnumber of
   * `chapters` plus one; the new node becomes a child of `story-id`, or a
   * root without it. Without the create scope nothing opens.
   */
  openCreate() {
    if (!this.checkCreatePermission()) {
      return;
    }
    // Calculate next sort number
    let nextSortNumber = 1;
    if (this.chapters && this.chapters.length > 0) {
      const maxSortNumber = Math.max(
        ...this.chapters.map((ch) => ch.sortnumber || 0)
      );
      nextSortNumber = maxSortNumber + 1;
    }

    // Set default data
    this.setChapterData({
      name: 'Neues Kapitel',
      sortNumber: nextSortNumber,
      reversed: false,
      publishDate: null,
      storyId: this.storyId,
    });

    this.show();
  }

  /**
   * **`??`, not `||`.** An emptied field reports `''`, which is falsy: with `||`
   * the fallback won and the previous name came back silently, so a node could
   * never lose its name — and the check for it could never speak up. A node does
   * need a name (unlike a content), and saying so is `_validate`'s job, not a
   * fallback's.
   */
  _handleNameChange(event) {
    const input = event.detail?.value ?? event.target.value;
    this.chapterData = {
      ...this.chapterData,
      name: input,
    };
  }

  /**
   * **`1` is the silent default, on purpose.** An emptied field and a typed `0`
   * both become `1`; nothing is reported. Unlike the name, where an empty value
   * is a mistake worth a message, a sort number has exactly one sensible
   * smallest value — falling back to it is an answer, not a swallowed error.
   *
   * The check in `_validate` therefore never fires from this form. It stays as a
   * net for a consumer that sets `chapterData` directly.
   *
   * A node **without** a sort number (`null`, a moved node) shows an empty
   * field and keeps `null` as long as the field is not touched.
   */
  _handleSortNumberChange(event) {
    const input = event.detail;
    this.chapterData = {
      ...this.chapterData,
      sortNumber: parseInt(input.value) || 1,
    };
  }

  /**
   * `slds-toggle` reports `toggle` and carries the state in the detail — its
   * host element has no `checked` property to read. The binding used to listen
   * for `change`, which the toggle never dispatches, so the switch flipped on
   * screen while the saved value stayed put.
   */
  _handleReversedChange(event) {
    this.chapterData = {
      ...this.chapterData,
      reversed: event.detail.checked,
    };
  }

  _handleModalClose() {
    this.reset();
    this._dispatchCancelEvent();
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

  /**
   * Die zu setzenden Spalten eines Knotens.
   *
   * Die Namen sind die des Datenmodells (`sortnumber`) — frueher standen hier
   * `sortNumber`/`publishDate`, die die Datenschicht uebersetzen musste.
   * Uebrig bleibt eine Uebersetzung: die Formularfelder heissen intern weiter
   * wie bisher.
   *
   * **No `published_date`.** The form has no field for it; publishing is the
   * publish tab's, through its own endpoint. Sending the form's empty value
   * withdrew a published node on every save.
   */
  _nodeColumns() {
    return {
      name: this.chapterData.name,
      sortnumber: this.chapterData.sortNumber,
      reversed: this.chapterData.reversed || false,
    };
  }

  _validate() {
    const name = this.chapterData?.name?.trim();
    if (!name) {
      return { valid: false, message: this.labels.nameRequired };
    }

    // No sort number at all is allowed: a moved node has none and stands at
    // the end of its siblings. Saving it untouched keeps it there.
    const sortNumber = this.chapterData?.sortNumber ?? null;
    if (sortNumber !== null && !(sortNumber >= 1)) {
      return { valid: false, message: this.labels.sortNumberRequired };
    }

    return { valid: true };
  }

  _createChapter() {
    const eventDetail = {
      object: 'node',
      payload: {
        ...this._nodeColumns(),
        parent_node_id: this.storyId,
      },
      callback: this._createEventCallback.bind(this),
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
      object: 'node',
      payload: {
        id: this.chapterId,
        ...this._nodeColumns(),
      },
      callback: this._updateEventCallback.bind(this),
    };

    // `parent_node_id` nur mitschicken, wenn es einen Elternknoten gibt: bei
    // einem Wurzelknoten waere `null` eine Aussage ("haenge ihn aus"), keine
    // fehlende Angabe.
    const parentId = this.chapterData.storyId || this.storyId;
    if (parentId) {
      eventDetail.payload.parent_node_id = parentId;
    }

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
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: { message, variant },
        bubbles: true,
        composed: true,
      })
    );
  }

  _dispatchChapterCreated(chapterData) {
    this.dispatchEvent(
      new CustomEvent('chapter-created', {
        detail: { chapterData },
        bubbles: true,
        composed: true,
      })
    );
  }

  _dispatchChapterUpdated(chapterData) {
    this.dispatchEvent(
      new CustomEvent('chapter-updated', {
        detail: { chapterData },
        bubbles: true,
        composed: true,
      })
    );
  }

  _dispatchCancelEvent() {
    this.dispatchEvent(
      new CustomEvent('chapter-edit-cancel', {
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-chapter-edit', CustomChapterEdit);
