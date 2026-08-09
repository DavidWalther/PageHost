import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/components/custom-chapter-edit/custom-chapter-edit.js';
import { deleteNode } from '/components/custom-node/delete-node.api.js';
import '/slds-components/slds-progress-bar/slds-progress-bar.js';

/**
 * Ein Knoten des Inhaltsbaums.
 *
 * Zusammenführung von `custom-story` und `custom-chapter`. Die beiden waren
 * **eine** Darstellung, aufgeteilt entlang zweier fester Ebenen: die Story
 * zeigte ihre Kapitel als Auswahl, das Kapitel seine Absätze als Inhalt. Im
 * neuen Datenmodell gibt es diese Ebenen nicht mehr — nur Knoten, und ein
 * Knoten kann beides haben.
 *
 * **Kein Typ in der Komponente.** Es gibt keine `mode`-Eigenschaft und keine
 * Tiefenangabe: Wer Kind-Knoten hat, zeigt eine Auswahl; wer Inhalte hat, zeigt
 * sie; wer beides hat, zeigt beides. Genau das ist mit „aus Tiefe und Kontext"
 * gemeint (`doc/datamodel-overhaul/datamodel.md`, Abschnitt 3) — der Knoten
 * weiß nicht, ob er früher eine Story war.
 *
 * Die Daten sagen damit, **was** ein Knoten hat. **Wofür** eine einzelne
 * Instanz da ist, sagt der Consumer über die Attribute `no-…` (Rendering,
 * Voreinstellung an) und `can-…` (Aktionen, Voreinstellung aus). Das ist kein
 * Typ, der wieder hereinkommt: Zwei Instanzen mit derselben `id` dürfen
 * verschieden aussehen, weil sie an verschiedenen Stellen verschiedene
 * Aufgaben haben. Welche Attribute es gibt, steht in der README.
 *
 * Die Lade-Mechanik der Inhalte (Chunks, IntersectionObserver, Sprung zu einem
 * Inhalt) ist aus `custom-chapter` übernommen und bewusst unverändert: sie war
 * dort erprobt, und sie hing nie an der Ebene, sondern an der Länge der Liste.
 */
class CustomNode extends LitElement {
  labels = {
    labelNoContents: 'Keine Inhalte vorhanden',
    labelLinkCopied: 'Link kopiert',
    labelContentCreated: 'Inhalt erstellt',
    labelContentCreateError: 'Fehler beim Erstellen des Inhalts',
    labelDeleteNode: 'Knoten löschen',
    labelNodeDeleted: 'Knoten gelöscht',
    labelNodeDeleteError: 'Fehler beim Löschen des Knotens',
    labelNodeDeleteConfirm: 'Diesen Knoten wirklich löschen?',
  };

  static properties = {
    id: { type: String },
    childButtonsNumberMax: {
      type: Number,
      attribute: 'child-buttons_number-max',
    },
    selectedChild: { type: String, attribute: 'selected-child' },
    contentnumber: { type: Number },
    loadingChunkSize: { type: Number, attribute: 'loading-chunk-size' },
    // Rendering: Voreinstellung **an** — was der Knoten hat, zeigt er; der
    // Consumer schaltet ab. Gleiche Richtung wie `no-load` / `no-display`.
    noChildNavigation: { type: Boolean, attribute: 'no-child-navigation' },
    noContents: { type: Boolean, attribute: 'no-contents' },
    // Aktionen: Voreinstellung **aus** — ein schreibender Weg wird
    // ausdruecklich gewaehrt, nicht stillschweigend mitgeliefert.
    canCreateChild: { type: Boolean, attribute: 'can-create-child' },
    canCreateContent: { type: Boolean, attribute: 'can-create-content' },
    canDelete: { type: Boolean, attribute: 'can-delete' },
    _nodeData: { state: true },
    _loading: { state: true },
    _scrollPending: { state: true },
    _pendingTotalCount: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }
    #node-content {
      margin-top: 1rem;
    }
    .content-container.pending {
      min-height: 120px;
    }
    .content-container {
      width: 100%;
      transition: min-height 0.3s ease;
    }
    .content-container.loaded {
      min-height: auto;
    }
  `;

  constructor() {
    super();
    this.id = null;
    this.childButtonsNumberMax = null;
    this.selectedChild = null;
    this.contentnumber = null;
    this.loadingChunkSize = 10;
    this.noChildNavigation = false;
    this.noContents = false;
    this.canCreateChild = false;
    this.canCreateContent = false;
    this.canDelete = false;
    this._nodeData = null;
    this._loading = false;
    this.pendingNewContentId = null;
    this.intersectionObserver = null;
    this.currentObservedChunkIndex = 1;
    this.observedElements = new Map();
    this._pendingDisplaySet = new Set();
    this._scrollPending = false;
    this._pendingTotalCount = 0;
  }

  // ==================================================
  // Lifecycle
  // ==================================================

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
    this.addEventListener('loaded', this._onContentLoaded, true);
    this.initializeIntersectionObserver();
    // Kein Laden hier: eine vor dem Upgrade gesetzte `id` steht in der ersten
    // `changedProperties`-Map, `updated` deckt den Fall also mit ab. Beides zu
    // tun hieße, den Knoten zweimal zu holen.
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('loaded', this._onContentLoaded, true);
    this.cleanupIntersectionObserver();
  }

  updated(changedProperties) {
    if (changedProperties.has('id')) {
      this.handleIdChange(this.id);
    }

    if (
      changedProperties.has('_nodeData') &&
      !this._loading &&
      !this.noContents &&
      this.contents.length > 0
    ) {
      this.setupContentObserving();
    }
  }

  // ==================================================
  // Abgeleitete Sichten auf die Daten
  // ==================================================

  /** Kind-Knoten. Leer heißt: dieser Knoten führt nirgendwo weiter. */
  get childNodeList() {
    return this._nodeData?.nodes || [];
  }

  /** Inhalts-Halter. Leer heißt: dieser Knoten trägt selbst nichts. */
  get contents() {
    return this._nodeData?.contents || [];
  }

  get loadingProgress() {
    if (this._pendingTotalCount === 0) return 0;
    return Math.round(
      ((this._pendingTotalCount - this._pendingDisplaySet.size) /
        this._pendingTotalCount) *
        100
    );
  }

  // ==================================================
  // Rendering
  // ==================================================

  render() {
    if (this._loading) {
      return html`<slds-spinner size="large"></slds-spinner>`;
    }
    if (!this._nodeData || !this._nodeData.id) {
      return html``;
    }

    return html`
      ${
        this._scrollPending
          ? html`<slds-progress-bar
              percent=${this.loadingProgress}
              circular
            ></slds-progress-bar>`
          : ''
      }
      <slds-card no-footer ?hidden=${this._scrollPending}>
        <span id="node-name" slot="header">${this._nodeData.name || ''}</span>
        <div slot="actions" class="slds-grid slds-wrap slds-gutters_xxx-small">
          ${
            this.canCreateChild
              ? html`<div
                  class="slds-col slds-grow-none slds-align_absolute-center"
                >
                  <!-- Neuen Kind-Knoten anlegen: ohne chapter-id ist die
                       Komponente im Anlege-Modus. -->
                  <custom-chapter-edit
                    id="node-create-child"
                    story-id="${this.id}"
                    mode="create"
                    .chapters="${this.childNodeList}"
                    @chapter-created=${this._handleChildCreated}
                  ></custom-chapter-edit>
                </div>`
              : ''
          }
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            <custom-chapter-edit
              id="node-edit"
              chapter-id="${this.id}"
              story-id="${this._nodeData.parent_node_id || ''}"
              name="${this._nodeData.name || ''}"
              sort-number="${this._nodeData.sortnumber || 1}"
              ?reversed="${this._nodeData.reversed || false}"
              publish-date="${this._nodeData.published_date || ''}"
              @chapter-updated=${this._handleNodeUpdated}
            ></custom-chapter-edit>
          </div>
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            <slds-button-icon
              id="button-share"
              icon="utility:link"
              variant="container-filled"
              @click=${this.handleShareClick}
            ></slds-button-icon>
          </div>
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            ${
              this.canCreateContent && this.hasScope('create')
                ? html`<slds-button-icon
                    id="button-create-content"
                    icon="utility:add"
                    variant="container-filled"
                    @click=${this.handleCreateContentClick}
                  ></slds-button-icon>`
                : ''
            }
          </div>
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            ${
              this.canDelete && this.hasScope('delete')
                ? html`<slds-button-icon
                    id="button-delete"
                    icon="utility:delete"
                    variant="container-filled"
                    title="${this.labels.labelDeleteNode}"
                    @click=${this._handleDeleteClick}
                  ></slds-button-icon>`
                : ''
            }
          </div>
        </div>
        ${this.renderChildNavigation()} ${this.renderContents()}
      </slds-card>
    `;
  }

  /**
   * Auswahl der Kind-Knoten. Erscheint nur, wenn es welche gibt — ein Knoten
   * ohne Kinder rendert hier gar nichts, statt eine leere Leiste zu zeigen.
   */
  renderChildNavigation() {
    if (this.noChildNavigation) {
      return '';
    }
    const children = this.childNodeList;
    if (children.length === 0) {
      return '';
    }

    const asCombobox =
      this.childButtonsNumberMax &&
      children.length > this.childButtonsNumberMax;

    return html`
      <div id="child-navigation" class="slds-grid slds-gutters slds-wrap">
        ${
          asCombobox
            ? this._renderChildCombobox(children)
            : children.map((child) => this._renderChildButton(child))
        }
      </div>
    `;
  }

  _renderChildButton(child) {
    const isSelected = this.selectedChild === child.id;
    return html`
      <div class="slds-col slds-grow-none">
        <button
          class="slds-button slds-button_neutral ${
            isSelected ? 'slds-button_brand' : ''
          }"
          data-node-id=${child.id}
          @click=${() => this.selectChild(child.id)}
          ?disabled=${isSelected}
        >
          ${child.name}
        </button>
      </div>
    `;
  }

  _renderChildCombobox(children) {
    const options = children.map((child) => ({
      value: child.id,
      label: child.name,
      title: child.name,
    }));

    return html`
      <div class="slds-col slds-size_1-of-1 slds-grow-none">
        <slds-combobox
          options=${JSON.stringify(options)}
          label="Auswahl"
          placeholder="Eintrag auswählen"
          value=${this.selectedChild}
          @combobox-select=${(event) => this.selectChild(event.detail.value)}
        ></slds-combobox>
      </div>
    `;
  }

  renderContents() {
    if (this.noContents) {
      // Diese Instanz ist fuer Inhalte nicht zustaendig — dann steht ihr auch
      // die Aussage "keine vorhanden" nicht zu.
      return '';
    }

    const contents = this.contents;
    if (contents.length === 0) {
      // Ein Knoten, der nur weiterführt, ist kein Fehlerfall — der Hinweis
      // gilt nur, wenn hier auch nichts weiterführt. Massgeblich ist, was
      // **diese Instanz** rendert: mit `no-child-navigation` fuehrt hier
      // nichts weiter, auch wenn der Knoten Kinder hat.
      const showsChildNavigation =
        !this.noChildNavigation && this.childNodeList.length > 0;
      return showsChildNavigation
        ? ''
        : html`<p id="no-contents">${this.labels.labelNoContents}</p>`;
    }

    const ordered = this._nodeData?.reversed
      ? [...contents].reverse()
      : contents;

    let targetIndex = -1;
    if (this.contentnumber) {
      targetIndex = ordered.findIndex(
        (entry) => entry.sortnumber == this.contentnumber
      );
    }

    const immediateLoadUpToChunk =
      targetIndex === -1 ? this.getImmediateLoadChunkBoundary() : null;

    return html`
      <div id="node-content">
        ${ordered.map((entry, index) => {
          const chunkIndex = this.getChunkIndex(index);
          const shouldLazyLoad =
            targetIndex !== -1
              ? index > targetIndex
              : chunkIndex > immediateLoadUpToChunk;
          const shouldHide = targetIndex > 0 && index < targetIndex;

          return html`
            <div
              class="slds-col slds-p-bottom_small content-container pending"
              data-content-id=${entry.id}
              data-chunk-index=${chunkIndex}
            >
              <custom-paragraph
                id=${entry.id}
                data-name=${entry.name || ''}
                data-sort-number=${entry.sortnumber || ''}
                ?no-load=${shouldLazyLoad}
                ?no-display=${shouldHide}
              ></custom-paragraph>
            </div>
          `;
        })}
      </div>
    `;
  }

  // ==================================================
  // Chunk-Rechnung
  // ==================================================

  getChunkIndex(itemIndex) {
    return Math.floor(itemIndex / this.loadingChunkSize);
  }

  getChunkStartIndex(chunkIndex) {
    return chunkIndex * this.loadingChunkSize;
  }

  getChunkEndIndex(chunkIndex) {
    return Math.min(
      (chunkIndex + 1) * this.loadingChunkSize - 1,
      this.contents.length - 1
    );
  }

  /** Bis zu welchem Chunk wird sofort geladen (ohne Sprungziel: nur der erste)? */
  getImmediateLoadChunkBoundary() {
    if (!this.contentnumber) return 0;

    const ordered = this._nodeData?.reversed
      ? [...this.contents].reverse()
      : this.contents;
    const targetIndex = ordered.findIndex(
      (entry) => entry.sortnumber == this.contentnumber
    );

    if (targetIndex === -1) {
      console.warn(`contentnumber ${this.contentnumber} not found in contents`);
      return 0;
    }
    return this.getChunkIndex(targetIndex);
  }

  // ==================================================
  // Nachladen beim Scrollen
  // ==================================================

  initializeIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.executeChunkLoading(entry.target);
          }
        });
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
  }

  cleanupIntersectionObserver() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    this.observedElements.clear();
  }

  observeElement(element) {
    if (this.intersectionObserver && element) {
      this.intersectionObserver.observe(element);
      this.observedElements.set(element, 'chunk-endpoint');
    }
  }

  /**
   * Element, dessen Sichtbarkeit den nächsten Chunk nachlädt: bewusst nicht das
   * letzte des aktuellen Chunks, sondern etwa bei 75 % — sonst beginnt das
   * Laden erst, wenn der Leser schon am Ende steht.
   */
  identifyNextObserverTarget(nextChunkIndex) {
    const totalChunks = Math.ceil(this.contents.length / this.loadingChunkSize);
    if (nextChunkIndex >= totalChunks) {
      return null;
    }

    const currentChunkIndex = nextChunkIndex - 1;
    const currentChunkStart = this.getChunkStartIndex(currentChunkIndex);
    const currentChunkEnd = this.getChunkEndIndex(currentChunkIndex);
    const chunkSize = currentChunkEnd - currentChunkStart + 1;
    const triggerIndex = currentChunkStart + Math.floor(chunkSize * 0.75);

    const containers = this.shadowRoot.querySelectorAll('.content-container');
    return containers[triggerIndex] || containers[currentChunkEnd] || null;
  }

  collectContentsToLoad(chunkIndex) {
    const startIndex = this.getChunkStartIndex(chunkIndex);
    const endIndex = this.getChunkEndIndex(chunkIndex);

    return Array.from(this.shadowRoot.querySelectorAll('.content-container'))
      .filter((_, index) => index >= startIndex && index <= endIndex)
      .map((container) => ({
        container,
        content: container.querySelector('custom-paragraph'),
      }))
      .filter(({ content }) => content && content.hasAttribute('no-load'));
  }

  executeChunkLoading(observedElement) {
    const triggerChunkIndex = parseInt(observedElement.dataset.chunkIndex);
    const chunkToLoad = triggerChunkIndex + 1;

    const nextObserverTarget = this.identifyNextObserverTarget(chunkToLoad + 1);
    const elementsToLoad = this.collectContentsToLoad(chunkToLoad);

    if (this.intersectionObserver && observedElement) {
      this.intersectionObserver.unobserve(observedElement);
      this.observedElements.delete(observedElement);
    }

    elementsToLoad.forEach(({ content }) => content.removeAttribute('no-load'));
    elementsToLoad.forEach(({ container }) => {
      container.classList.add('loading');
      container.classList.remove('pending');
      setTimeout(() => {
        container.classList.remove('loading');
        container.classList.add('loaded');
      }, 100);
    });

    if (nextObserverTarget) {
      requestAnimationFrame(() => {
        this.observeElement(nextObserverTarget);
        this.currentObservedChunkIndex = chunkToLoad + 1;
      });
    }
  }

  setupContentObserving() {
    this.cleanupIntersectionObserver();
    this.initializeIntersectionObserver();

    const ordered = this._nodeData?.reversed
      ? [...this.contents].reverse()
      : this.contents;
    const targetIndex = this.contentnumber
      ? ordered.findIndex((entry) => entry.sortnumber == this.contentnumber)
      : -1;

    const firstLazyChunk =
      targetIndex !== -1
        ? this.getChunkIndex(targetIndex + 1)
        : this.getImmediateLoadChunkBoundary() + 1;

    this.currentObservedChunkIndex = firstLazyChunk;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const containers =
          this.shadowRoot.querySelectorAll('.content-container');
        const totalChunks = Math.ceil(
          this.contents.length / this.loadingChunkSize
        );

        if (firstLazyChunk >= totalChunks) {
          containers.forEach((container) => {
            container.classList.remove('pending');
            container.classList.add('loaded');
          });
          return;
        }

        const initialTarget = this.identifyNextObserverTarget(firstLazyChunk);
        if (initialTarget) {
          this.observeElement(initialTarget);
        }

        containers.forEach((container, index) => {
          const isImmediate =
            targetIndex !== -1
              ? index <= targetIndex
              : this.getChunkIndex(index) < firstLazyChunk;
          if (isImmediate) {
            container.classList.remove('pending');
            container.classList.add('loaded');
          }
        });
      });
    });
  }

  // ==================================================
  // Sprung zu einem Inhalt
  // ==================================================

  /**
   * Sammelt die Inhalte, die vor dem Sprungziel liegen. Erst wenn sie geladen
   * sind, wird der Knoten gezeigt — sonst springt die Seite ins Leere.
   */
  _buildPendingDisplaySet(contents) {
    const ordered = this._nodeData?.reversed
      ? [...contents].reverse()
      : contents;
    const targetIndex = ordered.findIndex(
      (entry) => entry.sortnumber == this.contentnumber
    );

    if (targetIndex <= 0) {
      this._resetJumpState();
      return;
    }

    this._scrollPending = true;
    this._pendingDisplaySet = new Set(
      ordered.slice(0, targetIndex).map((entry) => entry.id)
    );
    this._pendingTotalCount = this._pendingDisplaySet.size;
  }

  _revealAndScroll() {
    const target = this.contentnumber;
    this._scrollPending = false;

    this.updateComplete.then(() => {
      this.shadowRoot
        .querySelectorAll('custom-paragraph[no-display]')
        .forEach((element) => element.removeAttribute('no-display'));

      requestAnimationFrame(() => {
        this.scrollToContent({ contentSortNumber: target });
        this.contentnumber = null;
      });
    });
  }

  scrollToContent({ contentId, contentSortNumber }) {
    const container = this.shadowRoot.getElementById('node-content');
    if (!container) return;

    const elements = Array.from(container.querySelectorAll('custom-paragraph'));
    const match = contentSortNumber
      ? elements.find(
          (element) => element.dataset.sortNumber == contentSortNumber
        )
      : elements.find((element) => element.id == contentId);

    if (match) {
      match.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ==================================================
  // Ereignisse
  // ==================================================

  _onContentLoaded = (event) => {
    // Der Knoten meldet `loaded` auch fuer sich selbst (`applyNodeData`), und
    // der Listener haengt mit `capture` an ihm — er sieht also beides.
    //
    // Unterschieden wird am **Inhalt der Meldung**, nicht an `event.target`:
    // Ein `composed` Ereignis aus dem eigenen Shadow-DOM wird am Host auf den
    // Host umgeschrieben. `event.target` ist hier deshalb immer dieser Knoten,
    // gleichgueltig ob ein Absatz oder er selbst gemeldet hat.
    const contentData = event.detail?.paragraphData;
    if (!contentData) {
      return;
    }

    if (
      this.pendingNewContentId &&
      contentData.id === this.pendingNewContentId
    ) {
      this.requestUpdate();
      this.pendingNewContentId = null;
    }

    if (this._pendingDisplaySet.size > 0) {
      if (this._pendingDisplaySet.has(contentData.id)) {
        this._pendingDisplaySet.delete(contentData.id);
      }
      this.requestUpdate();
      if (this._pendingDisplaySet.size === 0) {
        this._revealAndScroll();
      }
    }
  };

  async handleIdChange(newId) {
    if (!newId || newId === 'null') {
      this.clearContent();
      return;
    }
    // Der Datensatz kann schon da sein — `adoptNode` setzt ihn zusammen mit
    // der Id. Ohne diesen Riegel holte `updated()` ihn gleich noch einmal.
    if (this._nodeData?.id === newId) {
      return;
    }
    this._loading = true;
    this._nodeData = null;
    this._resetJumpState();
    this.fetchNode(newId);
  }

  /**
   * Der Zaehlstand des Sprungs gehoert zum **aktuellen** Knoten.
   *
   * Bleibt ein Rest darin stehen — etwa weil ein Inhalt vor dem Sprungziel nie
   * ankam — und wird danach der Knoten gewechselt, bliebe `_scrollPending`
   * gesetzt und versteckte die Karte des **naechsten** Knotens, an dem gar
   * nichts auszusetzen war.
   */
  _resetJumpState() {
    this._pendingDisplaySet = new Set();
    this._pendingTotalCount = 0;
    this._scrollPending = false;
  }

  /**
   * Übernimmt einen **bereits geladenen** Knoten, statt ihn selbst zu holen.
   *
   * Der Consumer löst beim Einstieg ohnehin auf, was hinter einer Id steckt
   * (`bookstore.resolveEntryPoint`) — und hatte den Datensatz damit schon in
   * der Hand, während dieser Knoten ihn ein zweites Mal anfragte.
   *
   * Nach außen verhält es sich wie ein Abruf: `loaded` wird gemeldet, und ein
   * gesetztes `contentnumber` greift genauso. Wer darauf hört, muss seinen
   * Listener allerdings **vorher** angehängt haben — das Ereignis kommt hier
   * sofort und nicht erst nach einer Antwort aus dem Netz.
   */
  adoptNode(record) {
    if (!record?.id) {
      return;
    }
    this._loading = false;
    this.applyNodeData(record);
    // Das **Attribut**, nicht nur die Eigenschaft: alle Consumer setzen und
    // lesen die Id als Attribut. Liefe hier nur die Eigenschaft mit, gingen
    // beide auseinander. `handleIdChange` läuft daraufhin, findet den
    // Datensatz aber schon vor und holt nichts nach.
    this.setAttribute('id', record.id);
  }

  clearContent() {
    this.cleanupIntersectionObserver();
    this._resetJumpState();
    this._nodeData = null;
  }

  selectChild(childId) {
    this.selectedChild = childId;
    this.dispatchEvent(
      new CustomEvent('navigation', {
        // Der ganze Datensatz kommt mit, nicht nur die Id: der Consumer hat
        // ihn sonst nicht und müsste ihn nachladen, um etwa seine alte Id zu
        // kennen. Angezeigt wurde er hier ohnehin schon.
        detail: {
          type: 'node',
          value: childId,
          node:
            this.childNodeList.find((child) => child.id === childId) ?? null,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  handleShareClick() {
    const shareUrl = `${location.origin}/${this.id}`;
    navigator.clipboard.writeText(shareUrl).catch((error) => {
      console.error('Error copying text to clipboard:', error);
    });
    this.fireToast(this.labels.labelLinkCopied, 'info');
  }

  handleCreateContentClick = () => {
    if (!this._nodeData) return;
    this.fireCreateEvent_Content(this._nodeData.id);
  };

  async _handleDeleteClick() {
    if (!confirm(this.labels.labelNodeDeleteConfirm)) return;
    try {
      await deleteNode({ id: this.id });
      this.fireToast(this.labels.labelNodeDeleted, 'success');
      this.dispatchEvent(
        new CustomEvent('node-deleted', {
          detail: { nodeId: this.id },
          bubbles: true,
          composed: true,
        })
      );
      this.clearContent();
    } catch (error) {
      this.fireToast(
        error.message || this.labels.labelNodeDeleteError,
        'error'
      );
    }
  }

  _handleNodeUpdated(event) {
    const updated = event.detail?.chapterData;
    if (!updated) return;

    this._nodeData = { ...this._nodeData, ...updated };
    this.requestUpdate();
  }

  /** Ein neu angelegter Kind-Knoten kommt in die Auswahl. */
  _handleChildCreated(event) {
    const created = event.detail?.chapterData;
    if (!created?.id || !this._nodeData) return;

    this._nodeData = {
      ...this._nodeData,
      nodes: [...this.childNodeList, created],
    };
    this.requestUpdate();
  }

  /**
   * Übernimmt die Änderung eines Kind-Knotens in die Auswahl.
   *
   * Wird vom Consumer aufgerufen: geändert wird das Kind in seiner eigenen
   * Darstellung, angezeigt wird es hier.
   */
  applyChildUpdate(childData) {
    if (!childData?.id || !this._nodeData) return;
    const nodes = this.childNodeList
      .map((child) =>
        child.id === childData.id ? { ...child, ...childData } : child
      )
      .sort(
        (first, second) => (first.sortnumber ?? 0) - (second.sortnumber ?? 0)
      );
    this._nodeData = { ...this._nodeData, nodes };
    this.requestUpdate();
  }

  /** Nimmt einen geloeschten Kind-Knoten aus der Auswahl. */
  removeChildNode(childId) {
    if (!childId || !this._nodeData) return;
    this._nodeData = {
      ...this._nodeData,
      nodes: this.childNodeList.filter((child) => child.id !== childId),
    };
    this.requestUpdate();
  }

  // ==================================================
  // Callouts
  // ==================================================

  fetchNode(nodeId) {
    this.fireQueryEvent_Node(nodeId, (error, data) => {
      if (error) {
        console.error('Error fetching node data:', error);
        this._loading = false;
        return;
      }
      this.applyNodeData(data);
    });
  }

  /**
   * Was nach dem Laden zu tun ist — gleich, ob die Daten aus einem Abruf
   * stammen oder übergeben wurden (`adoptNode`). Beide Wege müssen sich
   * identisch verhalten, sonst hängt das Verhalten daran, wer schneller war.
   */
  applyNodeData(data) {
    this._nodeData = data || {};
    this.dispatchEvent(
      new CustomEvent('loaded', {
        detail: { nodeData: this._nodeData },
        bubbles: true,
        composed: true,
      })
    );

    // Ohne gerenderte Inhalte darf `_scrollPending` nie gesetzt werden: Es
    // versteckt die Karte hinter `?hidden`, und niemand zaehlt sie wieder
    // hervor — es laedt ja kein Absatz.
    if (!this.noContents && this.contentnumber && this.contents.length > 0) {
      this._buildPendingDisplaySet(this.contents);
    }
    this._loading = false;
  }

  fireQueryEvent_Node(nodeId, callback) {
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: { payload: { object: 'node', id: nodeId }, callback },
        bubbles: true,
        composed: true,
      })
    );
  }

  fireCreateEvent_Content(nodeId) {
    this.dispatchEvent(
      new CustomEvent('create', {
        detail: {
          object: 'content',
          payload: {
            node_id: nodeId,
            name: '',
            content: '',
            htmlcontent:
              '<slds-card no-footer><span slot="header">Neuer Inhalt</span></slds-card>',
          },
          callback: this.createEventCallback_Content.bind(this),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  createEventCallback_Content(error, data) {
    if (error) {
      this.fireToast(this.labels.labelContentCreateError, 'error');
      return;
    }
    const created = data?.result;
    if (!created?.id) return;

    this.fireToast(this.labels.labelContentCreated, 'success');
    this._nodeData = {
      ...this._nodeData,
      contents: [...this.contents, created],
    };
    this.pendingNewContentId = created.id;
  }

  // ==================================================
  // Hilfen
  // ==================================================

  fireToast(message, variant) {
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: { message, variant },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Trägt die angemeldete Sitzung diesen Scope? */
  hasScope(scope) {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsed = JSON.parse(authData);
      return (
        parsed?.authenticationResult.access?.scopes?.includes(scope) || false
      );
    } catch (error) {
      console.error('Failed to parse authenticationResult:', error);
      return false;
    }
  }
}

customElements.define('custom-node', CustomNode);
