import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/components/custom-chapter-edit/custom-chapter-edit.js';
import '/components/custom-content-publish/custom-content-publish.js';
import '/components/custom-node-delete/custom-node-delete.js';
import '/components/custom-node-move/custom-node-move.js';
import '/components/custom-node-contents/custom-node-contents.js';

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
 * The contents themselves — chunks, the jump to a content, adding one — are
 * `custom-node-contents`, embedded here. The page uses the same component
 * below its node view; a node in a feed shows its contents the same way.
 */
class CustomNode extends LitElement {
  labels = {
    labelNoContents: 'Keine Inhalte vorhanden',
    labelLinkCopied: 'Link kopiert',
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
    noTitle: { type: Boolean, attribute: 'no-title' },
    // Aktionen: Voreinstellung **aus** — ein schreibender Weg wird
    // ausdruecklich gewaehrt, nicht stillschweigend mitgeliefert.
    canCreateChild: { type: Boolean, attribute: 'can-create-child' },
    canCreateContent: { type: Boolean, attribute: 'can-create-content' },
    canDelete: { type: Boolean, attribute: 'can-delete' },
    canMove: { type: Boolean, attribute: 'can-move' },
    // Mark only while this node is a root: a root always stands in the upper
    // node, a node with a parent is marked where it is the chosen one.
    canMoveRoot: { type: Boolean, attribute: 'can-move-root' },
    // Id of the node marked to be moved, wherever it is. The consumer owns the
    // mark; the node compares, so a consumer that swaps the id need not care.
    markedId: { type: String },
    _nodeData: { state: true },
    _loading: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }
    custom-node-contents {
      margin-top: 1rem;
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
    this.noTitle = false;
    this.canCreateChild = false;
    this.canCreateContent = false;
    this.canDelete = false;
    this.canMove = false;
    this.canMoveRoot = false;
    this.markedId = null;
    this._nodeData = null;
    this._loading = false;
  }

  // ==================================================
  // Lifecycle
  // ==================================================

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
    this.addEventListener('content-deleted', this._onContentDeleted, true);
    // Kein Laden hier: eine vor dem Upgrade gesetzte `id` steht in der ersten
    // `changedProperties`-Map, `updated` deckt den Fall also mit ab. Beides zu
    // tun hieße, den Knoten zweimal zu holen.
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('content-deleted', this._onContentDeleted, true);
  }

  updated(changedProperties) {
    if (changedProperties.has('id')) {
      this.handleIdChange(this.id);
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

  /** The embedded list of contents, once rendered. */
  get _contentsElement() {
    return this.shadowRoot?.querySelector('custom-node-contents') ?? null;
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
      <slds-card no-footer>
        <!-- Only the name goes with no-title: the actions share the header
             and stay. -->
        ${
          this.noTitle
            ? ''
            : html`<span id="node-name" slot="header"
                >${this._nodeData.name || ''}</span
              >`
        }
        <slds-layout slot="actions" wrap gutters-xxx-small>
          <!-- Ein Element je Aktion, aber nur, wenn die Aktion sichtbar ist —
               sonst bliebe ein leerer Rahmen als Lücke stehen. Für die beiden
               custom-chapter-edit prüft custom-node dafür dieselben Scopes, die
               die Komponente selbst prüft (create bzw. edit): bewusst doppelt. -->
          ${
            this.canCreateChild && this.hasScope('create')
              ? html`<slds-layout-item grow-none align-middle>
                  <div class="slds-align_absolute-center">
                    <!-- Neuen Kind-Knoten anlegen: ohne chapter-id ist die
                         Komponente im Anlege-Modus. -->
                    <custom-chapter-edit
                      id="node-create-child"
                      story-id="${this.id}"
                      mode="create"
                      .chapters="${this.childNodeList}"
                      @chapter-created=${this._handleChildCreated}
                    ></custom-chapter-edit>
                  </div>
                </slds-layout-item>`
              : ''
          }
          ${
            this.hasScope('publish') && this.hasScope('edit')
              ? html`<slds-layout-item grow-none align-middle>
                  <div class="slds-align_absolute-center">
                    <!-- The node is published through its own button, as in
                         custom-node-view; the edit dialog has no publish tab. -->
                    <custom-content-publish
                      id="node-publish"
                      object-name="node"
                      trigger-size=""
                      record-id="${this.id}"
                      publish-date="${this._nodeData.published_date || ''}"
                    ></custom-content-publish>
                  </div>
                </slds-layout-item>`
              : ''
          }
          ${
            this.hasScope('edit')
              ? html`<slds-layout-item grow-none align-middle>
                  <div class="slds-align_absolute-center">
                    <custom-chapter-edit
                      id="node-edit"
                      chapter-id="${this.id}"
                      story-id="${this._nodeData.parent_node_id || ''}"
                      name="${this._nodeData.name || ''}"
                      .sortNumber="${this._nodeData.sortnumber ?? null}"
                      ?reversed="${this._nodeData.reversed || false}"
                      @chapter-updated=${this._handleNodeUpdated}
                    ></custom-chapter-edit>
                  </div>
                </slds-layout-item>`
              : ''
          }
          <slds-layout-item grow-none align-middle>
            <div class="slds-align_absolute-center">
              <slds-button-icon
                id="button-share"
                icon="utility:link"
                variant="container-filled"
                @click=${this.handleShareClick}
              ></slds-button-icon>
            </div>
          </slds-layout-item>
          ${
            this.canCreateContent && this.hasScope('create')
              ? html`<slds-layout-item grow-none align-middle>
                  <div class="slds-align_absolute-center">
                    <slds-button-icon
                      id="button-create-content"
                      icon="utility:add"
                      variant="container-filled"
                      @click=${this.handleCreateContentClick}
                    ></slds-button-icon>
                  </div>
                </slds-layout-item>`
              : ''
          }
          ${
            this._offersMark() && this.hasScope('edit')
              ? html`<slds-layout-item grow-none align-middle>
                  <div class="slds-align_absolute-center">
                    <!-- Marks this node; the navigation modal moves the
                         mark. The action is its own component. -->
                    <custom-node-move
                      id="node-move"
                      node-id="${this.id}"
                      node-name="${this._nodeData.name || ''}"
                      parent-id="${this._nodeData.parent_node_id || ''}"
                      .marked="${!!this.id && this.markedId === this.id}"
                    ></custom-node-move>
                  </div>
                </slds-layout-item>`
              : ''
          }
          ${
            this.canDelete && this.hasScope('delete')
              ? html`<slds-layout-item grow-none align-middle>
                  <div class="slds-align_absolute-center">
                    <!-- The action is its own component; this is one of
                         its triggers (the navigation modal is another). -->
                    <custom-node-delete
                      id="node-delete"
                      node-id="${this.id}"
                      @node-deleted=${this._handleOwnDeleted}
                    ></custom-node-delete>
                  </div>
                </slds-layout-item>`
              : ''
          }
        </slds-layout>
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
      <slds-layout id="child-navigation" gutters wrap>
        ${
          asCombobox
            ? this._renderChildCombobox(children)
            : children.map((child) => this._renderChildButton(child))
        }
      </slds-layout>
    `;
  }

  _renderChildButton(child) {
    const isSelected = this.selectedChild === child.id;
    return html`
      <slds-layout-item grow-none>
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
      </slds-layout-item>
    `;
  }

  _renderChildCombobox(children) {
    const options = children.map((child) => ({
      value: child.id,
      label: child.name,
      title: child.name,
    }));

    return html`
      <slds-layout-item size="1-of-1">
        <slds-combobox
          options=${JSON.stringify(options)}
          label="Auswahl"
          placeholder="Eintrag auswählen"
          value=${this.selectedChild}
          @combobox-select=${(event) => this.selectChild(event.detail.value)}
        ></slds-combobox>
      </slds-layout-item>
    `;
  }

  renderContents() {
    if (this.noContents) {
      // Diese Instanz ist fuer Inhalte nicht zustaendig — dann steht ihr auch
      // die Aussage "keine vorhanden" nicht zu.
      return '';
    }

    // Ein Knoten, der nur weiterführt, ist kein Fehlerfall — der Hinweis
    // gilt nur, wenn hier auch nichts weiterführt. Massgeblich ist, was
    // **diese Instanz** rendert: mit `no-child-navigation` fuehrt hier
    // nichts weiter, auch wenn der Knoten Kinder hat.
    const showsChildNavigation =
      !this.noChildNavigation && this.childNodeList.length > 0;
    const hint =
      this.contents.length === 0 && !showsChildNavigation
        ? html`<p id="no-contents">${this.labels.labelNoContents}</p>`
        : '';

    // The list is always there, also empty: the add button in the header
    // adds through it. It gets its data handed over (_handOverContents).
    return html`${hint}
      <custom-node-contents
        loading-chunk-size="${this.loadingChunkSize}"
        @content-created=${this._onContentCreated}
      ></custom-node-contents>`;
  }

  // ==================================================
  // Ereignisse
  // ==================================================

  /**
   * Ein Inhalt hat sich abgemeldet.
   *
   * Der Inhalt wird aus den **Daten** genommen, nicht aus dem DOM: Sein
   * Container käme beim nächsten Rendern sonst zurück. Welcher es war, steht in
   * der Meldung — `event.target` ist am Host auf den Knoten umgeschrieben und
   * taugt hier nicht (siehe `_onContentLoaded`).
   */
  _onContentDeleted = (event) => {
    const contentId = event.detail?.contentId;
    if (!contentId || !this._nodeData) return;

    const remaining = this.contents.filter((entry) => entry.id !== contentId);
    if (remaining.length === this.contents.length) return;

    this._nodeData = { ...this._nodeData, contents: remaining };
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
    this.fetchNode(newId);
  }

  /** Is marking granted for this node — always, or as a root only? */
  _offersMark() {
    return (
      this.canMove || (this.canMoveRoot && !this._nodeData?.parent_node_id)
    );
  }

  /**
   * Fetches the node again under the same id. Setting the id again does
   * nothing — the node holds that record already. After a move the record is
   * stale (another parent, other children), and the edit dialog would write
   * the old parent back.
   */
  reload() {
    if (!this.id || this.id === 'null') {
      return;
    }
    this._loading = true;
    this._nodeData = null;
    this.fetchNode(this.id);
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

  /** The add button in the header adds through the list below. */
  handleCreateContentClick = () => {
    this._contentsElement?.createContent();
  };

  /** A content was added below: it counts here too (no hint any more). */
  _onContentCreated = (event) => {
    const created = event.detail?.content;
    if (!created?.id || !this._nodeData) return;
    this._nodeData = {
      ...this._nodeData,
      contents: [...this.contents, created],
    };
  };

  /** This node is gone: show nothing of it any more. */
  _handleOwnDeleted = () => {
    this.clearContent();
  };

  _handleNodeUpdated(event) {
    const updated = event.detail?.chapterData;
    if (!updated) return;

    this._nodeData = { ...this._nodeData, ...updated };
    this.requestUpdate();
    // `reversed` may have changed: the list shows the new order.
    this._handOverContents();
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
      // As the backend sorts siblings: without a sortnumber at the end, a tie
      // decided by the id. A moved node has no sortnumber.
      .sort((first, second) => {
        const firstSort = first.sortnumber ?? Number.MAX_SAFE_INTEGER;
        const secondSort = second.sortnumber ?? Number.MAX_SAFE_INTEGER;
        if (firstSort !== secondSort) {
          return firstSort - secondSort;
        }
        return String(first.id).localeCompare(String(second.id));
      });
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

    this._loading = false;
    this._handOverContents();
  }

  /**
   * Hands the record to the list of contents, once it is rendered. The jump
   * to `contentnumber` goes along and belongs to the list from then on: the
   * next node does not jump again.
   */
  async _handOverContents() {
    if (this.noContents) return;
    await this.updateComplete;
    const contents = this._contentsElement;
    if (!contents || !this._nodeData?.id) return;
    contents.contentnumber = this.contentnumber;
    contents.adoptNode(this._nodeData);
    this.contentnumber = null;
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
