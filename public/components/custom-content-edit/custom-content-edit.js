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
    wrap: 'Zeilenumbruch',
    wrapOn: 'Umbruch',
    wrapOff: 'Kein Umbruch',
    cancelButton: 'Abbrechen',
    saveButton: 'Speichern',
    draftCreate: 'Entwurf anlegen',
    draftUpdate: 'Entwurf aktualisieren',
    draftDrop: 'Entwurf verwerfen',
    draftHint: 'Speichern übernimmt einen Entwurf und räumt ihn weg.',
    draftSaved: 'Entwurf lokal gesichert',
    draftDropped: 'Entwurf verworfen',
    nameRequired: 'Ein Name ist erforderlich',
    versionMissing:
      'Diese Fassung gibt es noch nicht — sie wird erst aktiv, wenn sie Inhalt hat. Es bleibt bei der bisherigen.',
    contentSaved: 'Gespeichert',
    contentSaveError: 'Fehler beim Speichern',
  };

  static properties = {
    /** Der geladene Datensatz. Wird gereicht, nicht geholt. */
    contentData: { type: Object, attribute: false },
    _form: { state: true },
    _activeType: { state: true },
    _hasDraft: { state: true },
    _noWrap: { state: true },
  };

  /**
   * **Kein Layout, nur Maße.**
   *
   * Die ganze Anordnung macht `slds-layout`: die Spalte im Modal (Hauptachse
   * senkrecht), die Formularzeile, die Kopfzeile des Textfelds und die
   * Entwurfs-Leiste. Abstände, Trennlinie und Textfarben kommen als
   * SLDS-Utilities ans Markup.
   *
   * Was hier bleibt, kann der Baukasten nicht ausdrücken — das SLDS-Raster
   * **ordnet** an, es sagt aber nicht, **wie hoch** etwas ist:
   *
   * 1. Eine Flex-Spalte verteilt nur Platz, den sie **hat**. Ohne eine Höhe
   *    wäre sie so hoch wie ihr Inhalt, und es bliebe nichts zu verteilen —
   *    SLDS v1 kennt dafür keine Utility (es gibt kein `slds-height_full`).
   * 2. `min-height: 0` hebt die Flexbox-Vorgabe `min-height: auto` auf. Ohne
   *    sie weigert sich ein Glied, unter seinen Inhalt zu schrumpfen: Die
   *    Spalte wüchse mit dem Text, statt ihn scrollen zu lassen.
   * 3. Wie hoch das Textfeld **mindestens** ist, ist eine Produktfrage, keine
   *    Rasterfrage.
   *
   * Dazu der Umbruch-Schalter, der eine Ansichtssache umsetzt und mit der
   * Anordnung nichts zu tun hat.
   *
   * Angesprochen wird über `id`, nicht über eine Klasse: Die `classList` eines
   * Layout-Hosts gehört der Komponente (siehe deren README und
   * `layout-classlist-contract.spec.js`).
   */
  static styles = css`
    /* (1) Die Spalte bekommt den Inhaltsbereich des Modals ganz — nur so hat
       sie Platz, den sie an das Textfeld weitergeben kann. (2) gilt für sie
       selbst und für das Glied, in dem das Feld sitzt. */
    #editor {
      min-height: 100%;
    }

    #content-area {
      min-height: 0;
      display: flex;
    }

    /* (3) Zwei Wege zur Höhe, weil das Modal zwei Gestalten hat:
       - Unter 30em ist es ein Vollbild-Grid. Der Inhaltsbereich hat dort eine
         aufgelöste Höhe, "flex: 1" dehnt das Feld auf den ganzen Rest.
       - Darüber ist die Höhe des Inhaltsbereichs automatisch. Ein Prozentwert
         hätte nichts, worauf er sich beziehen könnte — gemessen fiel das Feld
         dort auf seine Mindesthöhe zurück. Die ist deshalb am Fenster
         bemessen und nicht an einer Zeilenzahl.
       Die Breite kommt von "slds-textarea" selbst. */
    #content-input {
      flex: 1 1 auto;
      min-height: max(8rem, 40vh);
      resize: vertical;
    }

    /* Kein Umbruch: lange Zeilen laufen nach rechts weiter und werden
       gescrollt. "white-space: pre" statt des wrap-Attributs, weil ein
       Wechsel von "wrap" an einem bestehenden Textfeld nicht zuverlässig
       greift — und weil wrap="hard" den gespeicherten Wert verändern würde. */
    #content-input.no-wrap {
      white-space: pre;
      overflow-x: auto;
    }
  `;

  constructor() {
    super();
    this.contentData = null;
    this._form = {};
    this._activeType = 'text';
    this._hasDraft = false;
    this._noWrap = false;
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
        <slds-layout id="editor" vertical>
          <slds-layout-item grow-none>${this.renderForm()}</slds-layout-item>
          <slds-layout-item grow-none>
            ${this.renderContentHead()}
          </slds-layout-item>
          <slds-layout-item id="content-area">
            ${this.renderContentInput()}
          </slds-layout-item>
          <slds-layout-item grow-none
            >${this.renderDraftBar()}</slds-layout-item
          >
        </slds-layout>

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
      <slds-layout wrap gutters-x-small>
        <slds-layout-item size="1-of-1" medium-size="1-of-2">
          <slds-input
            type="text"
            label="${this.labels.name}"
            placeholder="${this.labels.namePlaceholder}"
            value="${this._form.name || ''}"
            @change=${this._handleNameChange}
          ></slds-input>
        </slds-layout-item>

        <slds-layout-item size="1-of-2" medium-size="1-of-6">
          <slds-input
            type="number"
            label="${this.labels.sortNumber}"
            value="${this._form.sortnumber ?? ''}"
            min="1"
            @change=${this._handleSortNumberChange}
          ></slds-input>
        </slds-layout-item>

        <slds-layout-item size="1-of-2" medium-size="1-of-3">
          <slds-combobox
            label="${this.labels.version}"
            options=${JSON.stringify(VERSION_OPTIONS)}
            value="${this._activeType}"
            @combobox-select=${this._handleVersionChange}
          ></slds-combobox>
        </slds-layout-item>
      </slds-layout>
    `;
  }

  /**
   * Das Textfeld — es bekommt die Höhe, die im Modal übrig ist.
   *
   * Dazu gehört der Schalter für den Zeilenumbruch: Bei Markup und langen
   * Datenzeilen ist der weiche Umbruch im Weg, weil er die Struktur verdeckt.
   * Aus ist er eine **Ansichtssache** — am gespeicherten Text ändert er nichts.
   */
  /**
   * Die Entwurfs-Leiste — abgesetzt, weil sie nicht zum Formular gehoert: Sie
   * wirkt **lokal** und geht nirgendwo hin.
   *
   * Ein "Uebernehmen" gibt es hier nicht: Der Formularstand *ist* der Entwurf
   * (das Oeffnen zieht ihn vor), also uebernimmt ihn der Speichern-Knopf und
   * raeumt ihn weg. Ein zweiter Knopf daneben taete dasselbe.
   */
  renderDraftBar() {
    return html`
      <div class="slds-border_top slds-m-top_small slds-p-top_x-small">
        <slds-layout wrap gutters-x-small vertical-align-center>
          <slds-layout-item size="1-of-1" medium-size="1-of-2">
            <p
              class="slds-text-body_small slds-text-color_weak slds-m-bottom_none"
            >
              ${this.labels.draftHint}
            </p>
          </slds-layout-item>
          <slds-layout-item grow-none>
            <button
              class="slds-button slds-button_neutral"
              @click=${this._handleDraftSave}
            >
              ${
                this._hasDraft
                  ? this.labels.draftUpdate
                  : this.labels.draftCreate
              }
            </button>
          </slds-layout-item>
          ${
            this._hasDraft
              ? html`<slds-layout-item grow-none>
                  <button
                    class="slds-button slds-button_destructive"
                    @click=${this._handleDraftDrop}
                  >
                    ${this.labels.draftDrop}
                  </button>
                </slds-layout-item>`
              : ''
          }
        </slds-layout>
      </div>
    `;
  }
  /** Beschriftung des Textfelds und der Schalter fuer den Zeilenumbruch. */
  renderContentHead() {
    return html`
      <slds-layout align-spread vertical-align-center>
        <slds-layout-item>
          <label class="slds-form-element__label" for="content-input">
            ${this.labels.content}
          </label>
        </slds-layout-item>
        <slds-layout-item>
          <slds-toggle
            label="${this.labels.wrap}"
            enabled-label="${this.labels.wrapOn}"
            disabled-label="${this.labels.wrapOff}"
            name="content-wrap"
            ?checked=${!this._noWrap}
            @toggle=${this._handleWrapToggle}
          ></slds-toggle>
        </slds-layout-item>
      </slds-layout>
    `;
  }

  /**
   * Das Textfeld — es bekommt die Hoehe, die im Modal uebrig ist.
   *
   * Der Schalter daneben nimmt den weichen Umbruch heraus: Bei Markup und
   * langen Datenzeilen verdeckt er die Struktur. Aus ist er eine
   * **Ansichtssache** — am gespeicherten Text aendert er nichts.
   */
  renderContentInput() {
    return html`
      <textarea
        id="content-input"
        class="slds-textarea ${this._noWrap ? 'no-wrap' : ''}"
        .value=${this._versionContent}
        @input=${this._handleContentChange}
      ></textarea>
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

  /**
   * Der Umbruch ist eine Ansicht, kein Inhalt: Der Schalter ändert nur, wie das
   * Textfeld lange Zeilen darstellt, nie den Text selbst.
   */
  _handleWrapToggle(event) {
    this._noWrap = !event.detail.checked;
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

    // Die Wahl geht nur hinaus, wenn es die Fassung gibt (siehe `_payload`).
    // Dass sie liegen bleibt, darf nicht still geschehen.
    if (!this._hasVersion(FIELD_BY_VERSION[this._activeType])) {
      this._dispatchToast(this.labels.versionMissing, 'warning');
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
   * **Gibt es diese Fassung?** Der Schlüssel sagt es, nicht der Inhalt.
   *
   * `custom-paragraph` übersetzt die Antwort des Endpunkts so: Eine Fassung, die
   * es nicht gibt, **fehlt** im Datensatz; eine vorhandene, aber leere steht als
   * `null` darin. Der Unterschied trägt den Zeiger — ein leeres `content_item`
   * hat eine Id, auf die `content_node.active_content_item` zeigen kann, eine
   * nicht vorhandene Fassung nicht.
   */
  _hasVersion(field) {
    return field in this._form;
  }

  /**
   * Die zu schreibenden Spalten.
   *
   * **Eine Fassung, die es nicht gibt, kommt nicht vor.** Ein `htmlcontent` im
   * Payload legte sonst eine HTML-Zeile an, die niemand angelegt hat.
   *
   * Eine **vorhandene** Fassung geht dagegen mit, auch wenn sie leer ist: Der
   * Schreibpfad nimmt die gewählte Fassung nur an, wenn der Payload sie
   * mitbringt — ohne das Feld bliebe der Zeiger stehen, und das Umschalten
   * verpuffte.
   */
  _payload() {
    const payload = {
      id: this._form.id,
      name: this._form.name,
      sortnumber: this._form.sortnumber,
    };

    Object.values(FIELD_BY_VERSION).forEach((field) => {
      if (this._hasVersion(field)) {
        payload[field] = this._form[field] ?? null;
      }
    });

    // Die gewählte Fassung gilt, sobald es sie gibt. Gibt es sie nicht, bleibt
    // es bei der bisherigen — der Zeiger darf nicht ins Leere zeigen.
    const chosenField = FIELD_BY_VERSION[this._activeType];
    const activeType = this._hasVersion(chosenField)
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
