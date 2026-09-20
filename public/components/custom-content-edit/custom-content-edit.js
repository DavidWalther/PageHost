import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

/**
 * Die Fassungen, in denen ein Inhalt vorliegen kann.
 *
 * Eine **feste** Liste, nicht die der vorhandenen Items: Sonst ließe sich eine
 * Fassung, die es noch nicht gibt, nie anlegen. Kommt später ein Typ dazu, steht
 * er hier — die Auswahl wächst mit, ohne dass das Formular sich ändert.
 */
const VERSION_OPTIONS = [
  { value: 'text', label: 'Text', title: 'Text' },
  { value: 'html', label: 'HTML', title: 'HTML' },
];

/** Feld im Datensatz, in dem die jeweilige Fassung steht. */
const FIELD_BY_VERSION = {
  text: 'content',
  html: 'htmlcontent',
};

class CustomContentEdit extends LitElement {
  labels = {
    modalTitle: 'Absatz bearbeiten',
    labelEditContent: 'Absatz bearbeiten',
    name: 'Name',
    namePlaceholder: 'Name des Absatzes eingeben...',
    sortNumber: 'Sortierung',
    version: 'Fassung',
    content: 'Inhalt',
    cancelButton: 'Abbrechen',
    saveButton: 'Speichern',
    draftCreate: 'Entwurf anlegen',
    draftUpdate: 'Entwurf aktualisieren',
    draftDrop: 'Entwurf verwerfen',
    draftHint: 'Speichern übernimmt einen Entwurf und räumt ihn weg.',
    draftSaved: 'Entwurf lokal gesichert',
    draftDropped: 'Entwurf verworfen',
    nameRequired: 'Ein Name ist erforderlich',
    contentSaved: 'Gespeichert',
    contentSaveError: 'Fehler beim Speichern',
  };

  static properties = {
    /** Der geladene Datensatz. Wird gereicht, nicht geholt. */
    contentData: { type: Object, attribute: false },
    _form: { state: true },
    _activeType: { state: true },
    _hasDraft: { state: true },
  };

  static styles = css`
    :host {
      display: inline-block;
    }

    /* Abgesetzt: Was hier steht, wirkt lokal und geht nicht an den Server. */
    .draft-bar {
      border-top: 1px solid var(--slds-color-border, #e5e5e5);
    }
  `;

  constructor() {
    super();
    this.contentData = null;
    this._form = {};
    this._activeType = 'text';
    this._hasDraft = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    if (!this.checkEditPermission()) {
      return html``;
    }

    return html`
      <slds-button-icon
        icon="utility:edit"
        variant="container-filled"
        size="x-small"
        title="${this.labels.labelEditContent}"
        @click=${this.show}
      ></slds-button-icon>

      <slds-modal
        heading="${this.labels.modalTitle}"
        size="full"
        @close=${this._handleModalClose}
      >
        ${this.renderForm()} ${this.renderDraftBar()}

        <div slot="footer">
          <button
            class="slds-button slds-button_neutral"
            @click=${this._handleCancel}
          >
            ${this.labels.cancelButton}
          </button>
          <button
            class="slds-button slds-button_brand"
            @click=${this._handleSave}
          >
            ${this.labels.saveButton}
          </button>
        </div>
      </slds-modal>
    `;
  }

  renderForm() {
    return html`
      <div class="slds-grid slds-wrap slds-gutters_x-small">
        <div class="slds-col slds-size_1-of-1">
          <slds-input
            type="text"
            label="${this.labels.name}"
            placeholder="${this.labels.namePlaceholder}"
            value="${this._form.name || ''}"
            @change=${this._handleNameChange}
          ></slds-input>
        </div>

        <div class="slds-col slds-size_1-of-2">
          <slds-input
            type="number"
            label="${this.labels.sortNumber}"
            value="${this._form.sortnumber ?? ''}"
            min="1"
            @change=${this._handleSortNumberChange}
          ></slds-input>
        </div>

        <div class="slds-col slds-size_1-of-2">
          <slds-combobox
            label="${this.labels.version}"
            options=${JSON.stringify(VERSION_OPTIONS)}
            value="${this._activeType}"
            @combobox-select=${this._handleVersionChange}
          ></slds-combobox>
        </div>

        <div class="slds-col slds-size_1-of-1 slds-m-top_x-small">
          <div class="slds-form-element">
            <label class="slds-form-element__label" for="content-input">
              ${this.labels.content}
            </label>
            <div class="slds-form-element__control">
              <textarea
                id="content-input"
                class="slds-textarea"
                rows="12"
                .value=${this._versionContent}
                @input=${this._handleContentChange}
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Die Entwurfs-Leiste — abgesetzt, weil sie nicht zum Formular gehört: Sie
   * wirkt **lokal** und geht nirgendwo hin.
   *
   * Ein „Übernehmen" gibt es hier nicht: Der Formularstand *ist* der Entwurf
   * (das Öffnen zieht ihn vor), also übernimmt ihn der Speichern-Knopf und
   * räumt ihn weg. Ein zweiter Knopf daneben täte dasselbe.
   */
  renderDraftBar() {
    return html`
      <div class="draft-bar slds-m-top_medium slds-p-top_small">
        <p
          class="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small"
        >
          ${this.labels.draftHint}
        </p>
        <button
          class="slds-button slds-button_neutral"
          @click=${this._handleDraftSave}
        >
          ${this._hasDraft ? this.labels.draftUpdate : this.labels.draftCreate}
        </button>
        ${
          this._hasDraft
            ? html`<button
                class="slds-button slds-button_destructive"
                @click=${this._handleDraftDrop}
              >
                ${this.labels.draftDrop}
              </button>`
            : ''
        }
      </div>
    `;
  }

  // ==================================================
  // Abgeleitete Sichten auf den Formularzustand
  // ==================================================

  /** Der Inhalt der gerade gewählten Fassung. */
  get _versionContent() {
    const field = FIELD_BY_VERSION[this._activeType];
    return this._form[field] ?? '';
  }

  // ==================================================
  // Öffentliche Schnittstelle
  // ==================================================

  show() {
    // Ein liegender Entwurf hat Vorrang — wer den Editor öffnet, arbeitet an
    // ihm weiter, statt ihn unbemerkt zu übergehen.
    const draft = this._readDraft();
    this._hasDraft = !!draft;
    this._form = { ...(draft || this.contentData || {}) };
    this._activeType = this._form.active_type || 'text';

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

  /**
   * Scopes der Sitzung. Fünfte Stelle im Frontend, die dieselbe Auswertung macht —
   * das ist bekannt und wird gesammelt abgeräumt, nicht hier nebenbei.
   */
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
      return false;
    }
  }

  // ==================================================
  // Ereignisse aus dem Formular
  // ==================================================

  _handleNameChange(event) {
    this._form = { ...this._form, name: event.detail.value };
  }

  _handleSortNumberChange(event) {
    this._form = {
      ...this._form,
      sortnumber: parseInt(event.detail.value, 10) || 1,
    };
  }

  /**
   * Die gewählte Fassung.
   *
   * Sie wird **gesetzt**, nicht abgeleitet: Das Textfeld zeigt ab jetzt diese
   * Fassung, und beim Speichern geht sie als `active_type` hinaus. Der Inhalt
   * der anderen Fassung bleibt im Formularzustand liegen — Umschalten ist
   * Ansehen, nicht Verwerfen.
   */
  _handleVersionChange(event) {
    this._activeType = event.detail.value;
  }

  _handleContentChange(event) {
    const field = FIELD_BY_VERSION[this._activeType];
    this._form = { ...this._form, [field]: event.target.value };
  }

  _handleCancel() {
    this.hide();
  }

  // ==================================================
  // Entwurf (localStorage)
  // ==================================================

  /** Der Entwurf liegt unter der Id des Inhalts. */
  get _draftKey() {
    return this.contentData?.id || null;
  }

  _readDraft() {
    if (!this._draftKey) return null;
    try {
      const raw = localStorage.getItem(this._draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _handleDraftSave() {
    if (!this._draftKey) return;
    const draft = {
      ...this._form,
      active_type: this._activeType,
      draft: true,
    };
    try {
      localStorage.setItem(this._draftKey, JSON.stringify(draft));
    } catch {
      this._dispatchToast(this.labels.contentSaveError, 'error');
      return;
    }
    this._hasDraft = true;
    this._dispatchToast(this.labels.draftSaved, 'info');
    this._dispatchDraftChanged();
  }

  _handleDraftDrop() {
    this._removeDraft();
    this._form = { ...(this.contentData || {}) };
    this._activeType = this._form.active_type || 'text';
    this._dispatchToast(this.labels.draftDropped, 'info');
    this._dispatchDraftChanged();
  }

  /** Entfernt den Entwurf, falls einer liegt. Meldet **nicht** von selbst. */
  _removeDraft() {
    if (!this._draftKey) return false;
    if (!this._hasDraft) return false;
    try {
      localStorage.removeItem(this._draftKey);
    } catch {
      // Kein Speicher, kein Entwurf — nichts zu tun.
    }
    this._hasDraft = false;
    return true;
  }

  _dispatchDraftChanged() {
    this.dispatchEvent(
      new CustomEvent('content-draft-changed', {
        detail: { hasDraft: this._hasDraft },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ==================================================
  // Speichern
  // ==================================================

  _handleSave() {
    const validation = this._validate();
    if (!validation.valid) {
      this._dispatchToast(validation.message, 'error');
      return;
    }

    this.dispatchEvent(
      new CustomEvent('save', {
        detail: {
          object: 'content',
          payload: this._payload(),
          callback: this._saveCallback.bind(this),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  _validate() {
    if (!this._form.name?.trim()) {
      return { valid: false, message: this.labels.nameRequired };
    }
    return { valid: true };
  }

  /**
   * Die zu schreibenden Spalten.
   *
   * **Ein Feld, das es nicht gibt, kommt nicht vor.** Ein `htmlcontent: null` im
   * Payload legte sonst eine leere HTML-Zeile an — dieselbe Regel, nach der
   * `custom-paragraph` die Antwort des Endpunkts übersetzt.
   *
   * Die aktive Fassung ist die **gewählte**, solange sie Inhalt hat. Eine leere
   * Fassung aktiv zu setzen hieße, den Absatz danach leer anzuzeigen; dann bleibt
   * es bei der bisherigen.
   */
  _payload() {
    const payload = {
      id: this._form.id,
      name: this._form.name,
      sortnumber: this._form.sortnumber,
    };

    Object.values(FIELD_BY_VERSION).forEach((field) => {
      const value = this._form[field];
      if (value !== undefined && value !== null) {
        payload[field] = value;
      }
    });

    const chosenField = FIELD_BY_VERSION[this._activeType];
    const chosenHasContent = !!this._form[chosenField];
    const activeType = chosenHasContent
      ? this._activeType
      : this._form.active_type;
    if (activeType) {
      payload.active_type = activeType;
    }

    return payload;
  }

  _saveCallback(error, data) {
    if (error) {
      this._dispatchToast(this.labels.contentSaveError, 'error');
      return;
    }
    if (!data) {
      return;
    }

    const payload = this._payload();
    const contentData = { ...this._form, ...payload };
    // Was auf dem Server steht, braucht daneben keinen Entwurf mehr.
    const hadDraft = this._removeDraft();
    this._dispatchToast(this.labels.contentSaved, 'success');
    if (hadDraft) {
      this._dispatchDraftChanged();
    }
    this.dispatchEvent(
      new CustomEvent('content-updated', {
        detail: { contentData },
        bubbles: true,
        composed: true,
      })
    );
    this.hide();
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

  _handleModalClose() {
    this._form = { ...(this.contentData || {}) };
  }
}

customElements.define('custom-content-edit', CustomContentEdit);
