import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { deleteParagraph } from './delete-paragraph.api.js';
import '/components/custom-content-edit/custom-content-edit.js';
import '/components/custom-content-publish/custom-content-publish.js';

/**
 * Antwort des `content`-Endpunkts in die Felder, mit denen der Editor arbeitet.
 *
 * Der Endpunkt liefert **alle** Repräsentationen als Liste plus den Zeiger auf
 * die aktive; die Bearbeitung kennt dagegen ein Feld je Fassung. Die Übersetzung
 * steht hier und nur hier.
 *
 * **Ein Feld, das es nicht gibt, kommt nicht vor** — `htmlcontent` fehlt, wenn
 * es keine HTML-Fassung gibt. Ein `htmlcontent: null` im Speichern-Payload
 * würde sonst eine leere HTML-Zeile anlegen.
 */
function fromContentRecord(record) {
  if (!record || !record.id) {
    return record;
  }
  const items = record.items || [];
  const mapped = {
    id: record.id,
    name: record.name ?? null,
    sortnumber: record.sortnumber ?? null,
    published_date: record.published_date ?? null,
    node_id: record.node_id ?? null,
    active_type: record.active_type ?? null,
  };
  items.forEach((item) => {
    if (item.type === 'text') {
      mapped.content = item.content ?? null;
    }
    if (item.type === 'html') {
      mapped.htmlcontent = item.content ?? null;
    }
  });
  return mapped;
}

/**
 * Stellt **einen Inhalt** dar.
 *
 * Die Komponente **zeigt** — sie bearbeitet nicht. Bearbeiten und
 * Veröffentlichen sind eigene Komponenten mit eigenem Modal
 * (`custom-content-edit`, `custom-content-publish`); hier stehen nur ihre
 * Auslöser, permanent und je nach Scope.
 *
 * Was sie behält: den geladenen Datensatz, das verzögerte Laden (`no-load`),
 * das Verstecken (`no-display`), das Löschen — und den Hinweis auf einen
 * lokalen Entwurf. Der Entwurf gehört dem Editor, seine **Anzeige** aber
 * hierher: Er hat Vorrang vor dem Serverstand.
 */
class CustomParagraph extends LitElement {
  labels = {
    labelDelete: 'Absatz löschen',
    labelDeleteConfirm: 'Diesen Absatz wirklich löschen?',
    labelDeleted: 'Absatz gelöscht',
  };

  static properties = {
    id: { type: String },
    noLoad: { type: Boolean, attribute: 'no-load' },
    noDisplay: { type: Boolean, attribute: 'no-display', reflect: true },
  };

  static styles = css`
    :host([no-display]) {
      display: none;
    }

    #content {
      position: relative;
    }

    /* Ein lokaler Entwurf ist sichtbar anders als der Serverstand. */
    #content.hasDraft {
      border-color: rgb(255, 78, 78);
      border-width: 1px;
      border-style: solid;
      border-radius: 5px;
    }

    /* Die Auslöser stehen dauerhaft, nicht erst beim Überfahren: Auf einem
       Touchgerät gibt es kein Überfahren, und der Rahmen, den der Hover früher
       zusätzlich zog, ließ den Text bei jeder Mausbewegung springen. */
    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.25rem;
    }
  `;

  constructor() {
    super();
    this.id = '';
    this._paragraphData = null; // Der Stand, den der Server kennt
    this.noLoad = false;
    this.noDisplay = false;
  }

  get hasDraft() {
    return this._readDraft() !== null;
  }

  get spinner() {
    return this.noLoad === false && this._paragraphData === null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet

    // Only load data if no-load is not set
    if (!this.noLoad) {
      this.loadParagraphData();
    }

    // Add event listeners for publishing events
    this.addEventListener('published', this.handlePublishedEvent.bind(this));
    this.addEventListener(
      'unpublished',
      this.handleUnpublishedEvent.bind(this)
    );
  }

  updated(changedProperties) {
    super.updated(changedProperties);

    // If no-load attribute was removed, start loading
    if (changedProperties.has('noLoad')) {
      const previousValue = changedProperties.get('noLoad');
      console.log(
        `noLoad changed from ${previousValue} to ${this.noLoad} for paragraph ${this.id}`
      );

      if (previousValue === true && this.noLoad === false) {
        console.log(
          `Triggering load for paragraph ${this.id} due to no-load removal`
        );
        this.loadParagraphData();
      }
    }
  }

  loadParagraphData() {
    if (!this.id || this._paragraphData) return; // Don't load if already loaded

    console.log(`Loading paragraph data for ${this.id}`);
    this.fireQueryEvent_Paragraph(
      this.id,
      this.queryEventCallback_Paragraph.bind(this)
    );
  }

  // ==================================================
  // Rendering
  // ==================================================

  render() {
    // Always render spinner, but toggle its visibility
    let content = html``;
    if (this._paragraphData) {
      // Der Entwurf hat Vorrang: Wer einen liegen hat, soll ihn sehen — sonst
      // zeigte der Absatz etwas anderes, als der Editor beim Öffnen anbietet.
      const shown = this._readDraft() || this._paragraphData;
      // Welche Fassung gilt, steht im Datensatz (`active_content_item` im
      // Modell). Die alte Regel "html gewinnt, sobald gefuellt" ist nur noch
      // Rueckfall fuer lokale Entwuerfe ohne den Zeiger.
      const activeType =
        shown.active_type ?? (shown.htmlcontent ? 'html' : 'text');
      content =
        activeType === 'html'
          ? this.renderHtmlReadonly(shown)
          : this.renderTextReadonly(shown);
    } else if (this.noLoad) {
      // Show placeholder for lazy-loaded content with realistic size
      content = html`
        <div
          class="slds-box "
          style="min-height: 80px; display: flex; align-items: center; justify-content: center;"
        >
          <div style="text-align: center;">
            <slds-spinner size="x-small"></slds-spinner>
            <p class="slds-text-color_weak slds-m-top_x-small">
              Loading paragraph...
            </p>
          </div>
        </div>
      `;
    }
    return html`
      <slds-spinner size="x-small" ?hidden=${!this.spinner}></slds-spinner>
      ${content}
    `;
  }

  renderTextReadonly(data) {
    return html`
      <div id="content" class=${this.hasDraft ? 'hasDraft' : ''}>
        <p>
          ${data.name ? html`<b>${data.name}</b><br />` : ''}
          ${(data.content || '').split('\n').map((line) => html`${line}<br />`)}
        </p>
        ${this.renderActions()}
      </div>
    `;
  }

  renderHtmlReadonly(data) {
    return html`
      <div id="content" class=${this.hasDraft ? 'hasDraft' : ''}>
        <div .innerHTML=${data.htmlcontent || ''}></div>
        ${this.renderActions()}
      </div>
    `;
  }

  /**
   * Die Auslöser — je einer für Bearbeiten, Veröffentlichen und Löschen.
   *
   * Ob ein Auslöser erscheint, entscheidet die Komponente dahinter selbst: Die
   * beiden Modal-Komponenten rendern ohne den passenden Scope nichts. Eine
   * zweite Prüfung hier wäre nur nötig, wenn ein leerer Rahmen stehen bliebe —
   * die Leiste ist aber ein schlichter Flex-Container ohne Rahmen je Aktion.
   */
  renderActions() {
    return html`
      <div class="actions">
        <custom-content-edit
          .contentData=${this._paragraphData}
          @content-updated=${this.handleContentUpdated}
          @content-draft-changed=${this.handleDraftChanged}
        ></custom-content-edit>
        <custom-content-publish
          record-id=${this.id}
          publish-date=${this._paragraphData?.published_date || ''}
        ></custom-content-publish>
        ${
          this.checkDeletePermission()
            ? html`<slds-button-icon
                id="button-delete-content"
                icon="utility:delete"
                variant="container-filled"
                size="x-small"
                title="${this.labels.labelDelete}"
                @click=${this.handleDeleteClick}
              ></slds-button-icon>`
            : ''
        }
      </div>
    `;
  }

  // ==================================================
  // Entwurf — gehört dem Editor, angezeigt wird er hier
  // ==================================================

  _readDraft() {
    if (!this.id) return null;
    try {
      const raw = localStorage.getItem(this.id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Der Editor hat einen Entwurf angelegt oder verworfen. */
  handleDraftChanged() {
    this.requestUpdate();
  }

  /** Der Editor hat gespeichert — sein Stand ist ab jetzt der Serverstand. */
  handleContentUpdated(event) {
    const record = event.detail?.contentData;
    if (!record) return;
    this._paragraphData = { ...record };
    this.requestUpdate();
  }

  // ==================================================
  // Berechtigungen
  // ==================================================

  checkDeletePermission() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsedData = JSON.parse(authData);
      return (
        parsedData?.authenticationResult.access?.scopes?.includes('delete') ||
        false
      );
    } catch (e) {
      return false;
    }
  }

  // ==================================================
  // Löschen
  // ==================================================

  async handleDeleteClick() {
    if (!confirm(this.labels.labelDeleteConfirm)) return;
    try {
      await deleteParagraph({ id: this.id });
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: this.labels.labelDeleted, variant: 'success' },
          bubbles: true,
          composed: true,
        })
      );
      this.remove();
    } catch (e) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: e.message, variant: 'error' },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  // ==================================================
  // Veröffentlichen — die Meldung kommt von außen
  // ==================================================

  refreshParagraphData() {
    // Refresh the paragraph data from server to get updated publishDate
    this.fireQueryEvent_Paragraph(this.id, (error, data) => {
      if (error) {
        console.error('Error refreshing paragraph data:', error);
        return;
      }
      this._paragraphData = fromContentRecord(data);
      this.requestUpdate();
    });
  }

  handlePublishedEvent(event) {
    // Refresh data when content is published
    this.refreshParagraphData();
  }

  handleUnpublishedEvent(event) {
    // Refresh data when content is unpublished
    this.refreshParagraphData();
  }

  // ==================================================
  // Query Event
  // ==================================================

  fireQueryEvent_Paragraph(paragraphid, callback) {
    if (!paragraphid) return;
    const payload = { object: 'content', id: paragraphid };
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
    this._paragraphData = fromContentRecord(data);
    // Dispatch loaded event
    this.dispatchEvent(
      new CustomEvent('loaded', {
        detail: { paragraphData: data },
        bubbles: true,
        composed: true,
      })
    );
    this.requestUpdate();
  }
}

customElements.define('custom-paragraph', CustomParagraph);
