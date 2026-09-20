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
  };

  static properties = {
    /** Der geladene Datensatz. Wird gereicht, nicht geholt. */
    contentData: { type: Object, attribute: false },
    _form: { state: true },
    _activeType: { state: true },
  };

  static styles = css`
    :host {
      display: inline-block;
    }
  `;

  constructor() {
    super();
    this.contentData = null;
    this._form = {};
    this._activeType = 'text';
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
        ${this.renderForm()}

        <div slot="footer">
          <button
            class="slds-button slds-button_neutral"
            @click=${this._handleCancel}
          >
            ${this.labels.cancelButton}
          </button>
          <button class="slds-button slds-button_brand" disabled>
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
    this._form = { ...(this.contentData || {}) };
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

  _handleModalClose() {
    this._form = { ...(this.contentData || {}) };
  }
}

customElements.define('custom-content-edit', CustomContentEdit);
