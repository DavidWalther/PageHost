import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/slds-components/slds-card/slds-card.js';
import '/slds-components/slds-progress-bar/slds-progress-bar.js';

/**
 * The contents of one node: its `content_node`s, one below the other.
 *
 * The list part of what `custom-node` used to do on its own — taken out so
 * the page can show a node and its contents as two components side by side
 * (`custom-node-view` above, this one below), and so `custom-node` keeps the
 * very same mechanism by embedding it.
 *
 * The loading mechanism is unchanged from `custom-node` (and before that
 * `custom-chapter`): contents load in chunks as the reader scrolls, and a jump
 * to `contentnumber` waits until everything before the target has loaded.
 *
 * Shown with the scope `edit` always — even empty, a list to add to. Without
 * it an empty list has nothing to say, and the component hides.
 */
class CustomNodeContents extends LitElement {
  labels = {
    labelCreateContent: 'Inhalt anlegen',
    labelContentCreated: 'Inhalt erstellt',
    labelContentCreateError: 'Fehler beim Erstellen des Inhalts',
  };

  static properties = {
    id: { type: String },
    contentnumber: { type: Number },
    loadingChunkSize: { type: Number, attribute: 'loading-chunk-size' },
    // The add action of the list: granted here, and on top the scope `create`.
    canCreate: { type: Boolean, attribute: 'can-create' },
    // The list in a card of its own, without header and footer — for a page
    // where it stands alone. Inside custom-node it sits in that card already.
    card: { type: Boolean },
    _nodeData: { state: true },
    _loading: { state: true },
    _scrollPending: { state: true },
    _pendingTotalCount: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }
    /* :host above outranks the hidden attribute; an empty list of a visitor
       would otherwise stay, with its card. */
    :host([hidden]) {
      display: none;
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
    this.contentnumber = null;
    this.loadingChunkSize = 10;
    this.canCreate = false;
    this.card = false;
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
    this.addEventListener('content-deleted', this._onContentDeleted, true);
    this.initializeIntersectionObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('loaded', this._onContentLoaded, true);
    this.removeEventListener('content-deleted', this._onContentDeleted, true);
    this.cleanupIntersectionObserver();
  }

  willUpdate() {
    // Without the scope `edit` an empty list hides — there is nothing to read
    // and nothing to add. Not before the node is there: a list still loading
    // is not an empty one.
    this.hidden =
      !!this._nodeData?.id &&
      this.contents.length === 0 &&
      !this.hasScope('edit');
  }

  updated(changedProperties) {
    if (changedProperties.has('id')) {
      this.handleIdChange(this.id);
    }

    if (
      changedProperties.has('_nodeData') &&
      !this._loading &&
      this.contents.length > 0
    ) {
      this.setupContentObserving();
    }
  }

  // ==================================================
  // Views on the data
  // ==================================================

  /** The contents of the node. Empty: it carries nothing itself. */
  get contents() {
    return this._nodeData?.contents || [];
  }

  /** The contents in the order the node shows them. */
  get orderedContents() {
    return this._nodeData?.reversed
      ? [...this.contents].reverse()
      : this.contents;
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

    const body = html`
      ${
        this._scrollPending
          ? html`<slds-progress-bar
              percent=${this.loadingProgress}
              circular
            ></slds-progress-bar>`
          : ''
      }
      <div id="node-contents" ?hidden=${this._scrollPending}>
        ${this._renderActions()} ${this._renderList()}
      </div>
    `;
    return this.card
      ? html`<slds-card no-header no-footer>${body}</slds-card>`
      : body;
  }

  /** The actions on the list as a whole: adding a content. */
  _renderActions() {
    if (!this.canCreate || !this.hasScope('create')) {
      return '';
    }
    return html`
      <slds-layout align-end>
        <slds-layout-item grow-none>
          <slds-button-icon
            id="button-create-content"
            icon="utility:add"
            variant="container-filled"
            label="${this.labels.labelCreateContent}"
            @click=${this.createContent}
          ></slds-button-icon>
        </slds-layout-item>
      </slds-layout>
    `;
  }

  _renderList() {
    const ordered = this.orderedContents;
    if (ordered.length === 0) {
      return '';
    }

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
              class="slds-p-bottom_small content-container pending"
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
  // Chunks
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

  /** Up to which chunk to load at once (without a jump target: the first). */
  getImmediateLoadChunkBoundary() {
    if (!this.contentnumber) return 0;

    const targetIndex = this.orderedContents.findIndex(
      (entry) => entry.sortnumber == this.contentnumber
    );

    if (targetIndex === -1) {
      console.warn(`contentnumber ${this.contentnumber} not found in contents`);
      return 0;
    }
    return this.getChunkIndex(targetIndex);
  }

  // ==================================================
  // Loading while scrolling
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
   * The element whose visibility loads the next chunk: on purpose not the
   * last of the current chunk but one at about 75 % — otherwise loading only
   * starts when the reader already stands at the end.
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

    const targetIndex = this.contentnumber
      ? this.orderedContents.findIndex(
          (entry) => entry.sortnumber == this.contentnumber
        )
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
  // Jump to a content
  // ==================================================

  /**
   * Collects the contents before the jump target. Only when they have loaded
   * is the list shown — the page would jump into nothing otherwise.
   */
  _buildPendingDisplaySet() {
    const ordered = this.orderedContents;
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

  /**
   * The count of the jump belongs to the **current** node. A rest left in it
   * — a content before the target that never arrived — would otherwise keep
   * the list of the **next** node hidden, with nothing wrong about it.
   */
  _resetJumpState() {
    this._pendingDisplaySet = new Set();
    this._pendingTotalCount = 0;
    this._scrollPending = false;
  }

  // ==================================================
  // Events
  // ==================================================

  _onContentLoaded = (event) => {
    // Told apart by what the event carries, not by `event.target`: a composed
    // event from the own shadow DOM is retargeted to the host.
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

  /**
   * A content went. It leaves the **data**, not the DOM: its container would
   * come back on the next render otherwise. Which one it was, the event says.
   */
  _onContentDeleted = (event) => {
    const contentId = event.detail?.contentId;
    if (!contentId || !this._nodeData) return;

    const remaining = this.contents.filter((entry) => entry.id !== contentId);
    if (remaining.length === this.contents.length) return;

    this._nodeData = { ...this._nodeData, contents: remaining };
  };

  handleIdChange(newId) {
    if (!newId || newId === 'null') {
      this.clearContent();
      return;
    }
    // The record may be here already — `adoptNode` sets it with the id.
    if (this._nodeData?.id === newId) {
      return;
    }
    this._loading = true;
    this._nodeData = null;
    this._resetJumpState();
    this.fetchNode(newId);
  }

  // ==================================================
  // Public interface
  // ==================================================

  /**
   * Takes a record **already loaded**, instead of fetching it. A set
   * `contentnumber` is evaluated here, so it has to be set before.
   */
  adoptNode(record) {
    if (!record?.id) {
      return;
    }
    this._loading = false;
    this.applyNodeData(record);
    // The attribute, not only the property: consumers read the id as one.
    this.setAttribute('id', record.id);
  }

  /** Fetches the node again under the same id. Without an id: nothing. */
  reload() {
    if (!this.id || this.id === 'null') {
      return;
    }
    this._loading = true;
    this._nodeData = null;
    this._resetJumpState();
    this.fetchNode(this.id);
  }

  clearContent() {
    this.cleanupIntersectionObserver();
    this._resetJumpState();
    this._nodeData = null;
  }

  /**
   * Adds a content at the end of the list. Also the way for a consumer with
   * an add button of its own (`custom-node` has it in its header).
   */
  createContent = () => {
    if (!this._nodeData) return;
    this.fireCreateEvent_Content(this._nodeData.id);
  };

  // ==================================================
  // Callouts
  // ==================================================

  fetchNode(nodeId) {
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: {
          payload: { object: 'node', id: nodeId },
          callback: (error, data) => {
            if (error) {
              console.error('Error fetching node data:', error);
              this._loading = false;
              return;
            }
            this.applyNodeData(data);
          },
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  applyNodeData(data) {
    this._nodeData = data || {};
    // Without contents `_scrollPending` must never be set: it hides the list,
    // and nothing would count it visible again — no content loads.
    if (this.contentnumber && this.contents.length > 0) {
      this._buildPendingDisplaySet();
    } else {
      this._resetJumpState();
    }
    this._loading = false;
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
    this.dispatchEvent(
      new CustomEvent('content-created', {
        detail: { content: created },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ==================================================
  // Helpers
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

  /** Does the signed-in session carry this scope? */
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

customElements.define('custom-node-contents', CustomNodeContents);
