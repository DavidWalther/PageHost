import {
  LitElement,
  html,
  css,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import { findNode, findPath, findSiblings } from '/modules/content-tree.mjs';
import '/components/custom-node-view/custom-node-view.js';
import '/components/custom-node-contents/custom-node-contents.js';

console.log('Bookstore.js file loaded');

class Bookstore extends LitElement {
  static styles = css`
    /* The header stays at the top while the page scrolls, above the content. */
    .header-sticky {
      position: sticky;
      top: 0;
      z-index: 1;
    }
  `;

  static properties = {
    isHydrated: { type: Boolean, state: true },
    _initPara: { type: Object, state: true },
    _currentLocation: { type: String, state: true },
    // The start page: the feeds below the feed root the configuration names
    // (`feedRootNodeId`). Shown instead of the node, never next to it.
    _feedRootId: { type: String, state: true },
    _feedVisible: { type: Boolean, state: true },
    _feedRequested: { type: Boolean, state: true },
    _activeFeedId: { type: String, state: true },
    _feedContentNumber: { type: Number, state: true },
    // The node marked to be moved, `{ id, name, parentId }`, or null. One at a
    // time, and only as long as the page: a reload drops it.
    _marked: { type: Object, state: true },
    // The content tree: loaded here once, handed to the navigation modal.
    _tree: { type: Array, state: true },
  };

  constructor() {
    super();
    console.log('Bookstore constructor called');
    // LitElement automatically creates shadow DOM
    // Initialize component state
    this.isHydrated = false;
    this._initPara = null;
    // A jump to a content, waiting for the node it belongs to.
    this._pendingContentNumber = null;
    // A session began before the entry was shown: fetch its node again then.
    this._reloadAfterEntry = false;
    this._currentLocation = null;
    this._feedRootId = null;
    this._feedVisible = false;
    this._feedRequested = false;
    this._activeFeedId = null;
    this._feedContentNumber = null;
    this._marked = null;
    this._tree = [];
    // Counts the requests for the tree: only the answer to the last one counts.
    this._treeRequest = 0;
    // What the modal leaves out: the marked node. One list per mark, so the
    // modal sees a change only when the mark changes.
    this._hiddenIds = [];
    this._hostListeners = this.createHostListeners();
    this._windowListeners = this.createWindowListeners();
  }

  // =========== Lifecycle methods ============

  willUpdate(changed) {
    if (changed.has('_marked')) {
      this._hiddenIds = this._marked ? [this._marked.id] : [];
    }
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this._hostListeners.forEach(([name, listener]) =>
      this.addEventListener(name, listener)
    );
    this._windowListeners.forEach(([name, listener]) =>
      window.addEventListener(name, listener)
    );

    // read url and identify init-flow
    this._initPara = this.createInitializationParameterObject();

    this.hydrate();
    this.loadContentTree();
  }

  render() {
    return html`
      <div class="header-sticky">
        <slds-card no-footer no-header>
          <slds-layout wrap>
            <slds-layout-item align-middle size="3-of-12">
              <slds-layout wrap gutters-xx-small>
                <slds-layout-item grow-none>
                  <slds-button-icon
                    id="button-home"
                    icon="utility:home"
                    size="medium"
                    variant="container-transparent"
                    @click="${this.handleHome}"
                  ></slds-button-icon>
                </slds-layout-item>
                <slds-layout-item grow-none>
                  <slds-button-icon
                    id="button-navigation_open"
                    icon="utility:rows"
                    size="medium"
                    variant="container-transparent"
                    @click="${this.handleOpenNavigation}"
                  ></slds-button-icon>
                </slds-layout-item>
              </slds-layout>
            </slds-layout-item>
            <slds-layout-item size="6-of-12">
              <div class="slds-text-align_center slds-text-heading_large">
                <span id="page-header-headline"></span>
              </div>
            </slds-layout-item>
            <slds-layout-item align-middle size="3-of-12">
              <slds-layout align-end>
                <slds-layout-item grow-none>
                  <slds-button-icon
                    id="button-settings_open"
                    icon="utility:settings"
                    size="medium"
                    variant="container-transparent"
                    @click="${this.handleOpenSettings}"
                  ></slds-button-icon>
                </slds-layout-item>
              </slds-layout>
            </slds-layout-item>
          </slds-layout>
        </slds-card>
      </div>
      <custom-settings-modal>
        <slds-layout wrap vertical>
          <slds-layout-item size="1-of-1">
            <div class="slds-m-bottom_medium">
              <slds-layout>
                <slds-layout-item size="1-of-4">
                  <span>Login</span>
                </slds-layout-item>
                <slds-layout-item size="3-of-4">
                  <custom-login-module></custom-login-module>
                </slds-layout-item>
              </slds-layout>
            </div>
          </slds-layout-item>

          <slds-layout-item size="1-of-1">
            <slds-layout>
              <slds-layout-item size="1-of-4">
                <span>Licht</span>
              </slds-layout-item>
              <slds-layout-item size="3-of-4">
                <slds-layout align-end>
                  <slds-layout-item>
                    <slds-toggle
                      label=""
                      name="options"
                      @toggle="${this.handleToggleLightswitch}"
                    ></slds-toggle>
                  </slds-layout-item>
                </slds-layout>
              </slds-layout-item>
            </slds-layout>
          </slds-layout-item>
        </slds-layout>
        <div
          slot="danger"
          class="slds-grid slds-wrap slds-grid_vertical-align-center"
        >
          <div class="slds-col slds-text-align_left slds-size_1-of-2">
            Login-Session löschen
          </div>
          <div class="slds-col slds-text-align_right slds-size_1-of-2">
            <button
              class="slds-button slds-button_destructive"
              @click="${this.handleClearSession}"
            >
              Session löschen
            </button>
          </div>
        </div>
        <div
          slot="danger"
          class="slds-grid slds-wrap slds-grid_vertical-align-center slds-m-top_x-small"
        >
          <div class="slds-col slds-text-align_left slds-size_1-of-2">
            App-Cache löschen
          </div>
          <div class="slds-col slds-text-align_right slds-size_1-of-2">
            <button
              class="slds-button slds-button_destructive"
              @click="${this.handleClearServiceWorkerCache}"
            >
              Cache löschen
            </button>
          </div>
        </div>
      </custom-settings-modal>
      <custom-navigation-modal
        current-location="${this._currentLocation}"
        .tree="${this._tree}"
        .marked="${this._marked}"
        .hiddenIds="${this._hiddenIds}"
        @navigation-level-open="${this.handleNavigationLevelOpen}"
        @navigation-level-back="${this.handleNavigationLevelBack}"
        @navigation-node-select="${this.handleNavigationNodeSelect}"
      ></custom-navigation-modal>

      <!--
        The start page. It stays in the DOM while a node is shown, so that
        coming back to it loads nothing again; it is only hidden.
      -->
      <div
        id="feeds"
        class="slds-m-horizontal--small slds-m-top--small ${
          this._feedVisible ? '' : 'slds-hide'
        }"
      >
        <custom-feed
          root-id=${
            this._feedRequested && this._feedRootId ? this._feedRootId : nothing
          }
          active-feed=${this._activeFeedId ?? nothing}
          contentnumber=${this._feedContentNumber ?? nothing}
          @feed-select=${this.handleFeedSelect}
        ></custom-feed>
      </div>

      <!--
        One node, in two components that always refer to it: above the node
        itself, below its contents. The node is fetched once, above; the
        contents get the record handed over (handNodeToContents).
      -->
      <div
        id="bookshelf"
        class="slds-grid slds-grid_vertical slds-m-top--small ${
          this._feedVisible ? 'slds-hide' : ''
        }"
      >
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-node-view
            .siblings="${this._siblings()}"
            .markedId="${this._marked?.id ?? null}"
            @loaded="${this._handleNodeViewLoaded}"
            @node-view-navigate="${this.handleNodeViewNavigate}"
          ></custom-node-view>
        </div>
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-node-contents can-create card></custom-node-contents>
        </div>
      </div>
    `;
  }

  handleOpenSettings() {
    this.shadowRoot.querySelector('custom-settings-modal').show();
  }

  handleOpenNavigation() {
    this.openNavigation();
  }

  openNavigation() {
    this.navigationModal.show();
  }

  closeNavigation() {
    this.navigationModal.hide();
  }

  /**
   * Remembers where the visitor stands — in the id the **content tree** uses.
   *
   * The tree (`/api/1.0/contents/*`) carries the record id, never the
   * `legacy_id`; the navigation modal compares against it. A record therefore
   * contributes its `id`. A plain string is taken as given: it comes from the
   * navigation modal or from a child selection, and both carry record ids.
   */
  _setCurrentLocation(record) {
    if (!record) {
      this._currentLocation = null;
      return;
    }
    this._currentLocation =
      typeof record === 'string' ? record : (record.id ?? null);
  }

  /** The siblings of the node shown, for its arrows: `{ previous, next }`. */
  _siblings() {
    const { previous, next } = findSiblings(this._tree, this._currentLocation);
    const pick = (node) => (node ? { id: node.id, name: node.name } : null);
    return { previous: pick(previous), next: pick(next) };
  }

  /**
   * Shows the node with the given id — the one way every path through the
   * tree ends. Above the node itself, below its contents. A record already
   * loaded is handed over instead of being fetched; a jump to a content
   * waits for the node and goes to the contents with it.
   */
  _showNode(id, { record = null, contentnumber = null } = {}) {
    if (!id) return;
    this.hideFeed();
    this._setCurrentLocation(id);
    this._pendingContentNumber = contentnumber;
    // Another node: its contents go at once, not only once it has loaded.
    if (this.nodeContents.getAttribute('id') !== id) {
      this.nodeContents.clearContent();
    }
    if (record) {
      this.nodeView.adoptNode(record);
    } else if (this.nodeView.getAttribute('id') === id) {
      this.nodeView.reload();
    } else {
      this.nodeView.setAttribute('id', id);
    }
  }

  /**
   * The node above has loaded. Only its own report counts: `loaded` bubbles
   * and is composed, so one from inside the view would arrive here too.
   */
  _handleNodeViewLoaded(event) {
    if (event.target !== this.nodeView) return;
    this.handNodeToContents(event.detail?.nodeData);
  }

  /** The contents below take the record the node view loaded. */
  handNodeToContents(nodeData) {
    if (!nodeData?.id) return;
    this.nodeContents.contentnumber = this._pendingContentNumber;
    this._pendingContentNumber = null;
    this.nodeContents.adoptNode(nodeData);
  }

  /** A way taken in the node view: a child, a sibling, an ancestor. */
  handleNodeViewNavigate(event) {
    this._showNode(event.detail.id);
  }

  /** A level opened in the modal: the page shows that node. */
  handleNavigationLevelOpen(event) {
    // The modal stays open; the visitor may go deeper or choose.
    this._showNode(event.detail.id);
  }

  /** A node without children chosen in the modal: shown, the modal closes. */
  handleNavigationNodeSelect(event) {
    this._showNode(event.detail.id);
    this.closeNavigation();
  }

  /** One level up in the modal: the page shows the level now open. */
  handleNavigationLevelBack(event) {
    this._showNode(event.detail.id);
  }

  /**
   * Setzt den Service Worker zurueck — ausgefuehrt wird das eine Ebene hoeher.
   *
   * Die Anwendung sagt nur, DASS zurueckgesetzt werden soll; das Loeschen der
   * Caches und das Deregistrieren erledigt der Listener in `public/index.js`,
   * wo der Worker auch registriert wird. Zurueck kommt `(error, data)` wie bei
   * save/publish. Bei Erfolg laedt die Anwendung neu — erst dadurch laeuft
   * `install` wieder und der Precache entsteht frisch.
   */
  handleClearServiceWorkerCache() {
    this.dispatchEvent(
      new CustomEvent('service-worker-cache-clear', {
        detail: {
          callback: (error) => {
            if (error) {
              this.fireToast('Cache konnte nicht gelöscht werden', 'error');
              return;
            }
            window.location.reload();
          },
        },
        bubbles: true,
      })
    );
  }

  handleClearSession() {
    sessionStorage.removeItem('code_exchange_response');
    window.location.reload();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._hostListeners.forEach(([name, listener]) =>
      this.removeEventListener(name, listener)
    );
    this._windowListeners.forEach(([name, listener]) =>
      window.removeEventListener(name, listener)
    );
  }

  /**
   * What the application listens for on itself, as pairs of event name and
   * listener.
   *
   * Built once, so that `disconnectedCallback` removes the very functions
   * `connectedCallback` added — a function bound anew on every call would
   * never match.
   */
  createHostListeners() {
    // Every change to a node changes the content tree of the navigation modal.
    const reloadTree = (event) =>
      this.reloadTreeAfterChange(event.detail?.objectName);
    return [
      // `custom-chapter-edit` still reports `chapter-created` and
      // `chapter-updated` — the edit component keeps its old names.
      [
        'chapter-created',
        (event) => this.applyNodeChange(event.detail?.chapterData),
      ],
      [
        'chapter-updated',
        (event) => this.applyNodeChange(event.detail?.chapterData),
      ],
      [
        'node-deleted',
        (event) =>
          this.applyNodeDeletion(event.detail?.nodeId, event.detail?.nodeIds),
      ],
      [
        'node-mark-change',
        (event) => this.changeMark(event.detail?.marked, event.detail?.node),
      ],
      ['node-mark-clear', () => this.clearMark()],
      ['node-moved', (event) => this.applyNodeMove(event.detail?.nodeId)],
      ...[
        'chapter-created',
        'chapter-updated',
        'node-deleted',
        'node-moved',
        'published',
        'unpublished',
      ].map((name) => [name, reloadTree]),
    ];
  }

  /**
   * What the application listens for on `window`: the session began or
   * ended. `oidc-component` and `authTokenManager` both report there — the
   * one bubbling out of the shadow roots, the other without an element — so
   * each report arrives exactly once. Built once, like the host listeners.
   */
  createWindowListeners() {
    return [
      ['logged-in', (event) => this.applyLogin(event.detail?.reason)],
      ['logged-out', (event) => this.applyLogout(event.detail?.reason)],
    ];
  }

  /**
   * A session ended — signed off, or run out (`reason` says which; both are
   * met alike). The tree and the feeds may hold less now, and the node shown
   * may be one the visitor must not see: the page goes to the start page.
   */
  applyLogout(reason) {
    this.loadContentTree();
    this.reloadFeeds();
    this.showStartPage();
  }

  /**
   * A session began: the tree and the feeds may hold more now. After a login
   * through the provider the page shows the start page. A session restored
   * from the refresh token keeps the place — a deep link stays where it led —
   * and the node shown is fetched again: its actions depend on the session.
   */
  applyLogin(reason) {
    this.loadContentTree();
    this.reloadFeeds();
    if (reason === 'restore') {
      this.reloadShownNode();
      return;
    }
    this.showStartPage();
  }

  /**
   * The node shown is fetched again; the contents follow with the record.
   * While the entry is still being resolved there is no node shown yet — the
   * one the address names comes once it is, and is fetched again then.
   *
   * The view first finishes an update still pending: a node just handed to
   * it carries its id into the next update, and a reload before that would
   * leave the view without the record — it would fetch the node twice.
   */
  async reloadShownNode() {
    if (!this.isHydrated) {
      this._reloadAfterEntry = true;
      return;
    }
    if (!this._currentLocation) return;
    await this.nodeView.updateComplete;
    this.nodeView.reload();
  }

  /** The feeds load again what they show; not yet shown, they load nothing. */
  reloadFeeds() {
    this.feed.reload();
  }

  /**
   * A node was created or saved. The node view takes over its own edits; the
   * contents below follow (the order may have turned). A child of the node
   * shown, created or renamed, is in the combobox above: the view fetches
   * the node again, and the contents take the new record with it.
   */
  applyNodeChange(changed) {
    const current = this._currentLocation;
    if (!changed?.id || !current) return;
    if (changed.id === current) {
      this.nodeContents.reload();
      return;
    }
    const children = findNode(this._tree, current)?.childnodes ?? [];
    if (
      changed.parent_node_id === current ||
      children.some((child) => child.id === changed.id)
    ) {
      this.nodeView.reload();
    }
  }

  /**
   * Keeps or drops the mark to move a node. There is one mark: marking a node
   * replaces the old one, and unmarking only drops the mark of that node.
   */
  changeMark(marked, node) {
    if (!node?.id) return;
    if (marked) {
      this._marked = { ...node };
    } else if (this._marked?.id === node.id) {
      this.clearMark();
    }
  }

  /** Drops the mark, whichever node carries it. */
  clearMark() {
    this._marked = null;
  }

  /**
   * After a move the page shows the moved node, fetched again — it names its
   * old parent otherwise, which its edit dialog would write back. The mark is
   * used up, the modal closes; the tree reloads with the other changes to a
   * node, and the arrows follow it.
   */
  applyNodeMove(nodeId) {
    if (!nodeId) return;
    this.clearMark();
    this._showNode(nodeId);
    this.closeNavigation();
  }

  /**
   * Lets go of a deleted node. `nodeIds` is the node and everything that went
   * with it; a sender without it names the node alone. The node shown gone:
   * its parent takes its place, a root gives way to the start page. A child
   * of it gone: the view fetches the node again, its combobox lists one less.
   * The tree still holds the deleted nodes here — it reloads after this.
   */
  applyNodeDeletion(nodeId, nodeIds) {
    const current = this._currentLocation;
    if (!nodeId || !current) return;
    const gone = new Set(nodeIds ?? [nodeId]);

    if (gone.has(current)) {
      const path = findPath(this._tree, current);
      const parent = path[path.length - 2];
      this.nodeView.removeAttribute('id');
      this.nodeContents.removeAttribute('id');
      if (parent && !gone.has(parent.id)) {
        this._showNode(parent.id);
      } else {
        this.showStartPage();
      }
      return;
    }

    const children = findNode(this._tree, current)?.childnodes ?? [];
    if (children.some((child) => gone.has(child.id))) {
      this.nodeView.reload();
    }
  }

  // =========== Hydration - Start ============

  async hydrate() {
    // Check if the component is already hydrated
    if (this.isHydrated) {
      return;
    }

    // Die Knoten müssen im Shadow-DOM stehen, bevor sie Attribute bekommen.
    await this.updateComplete;

    // Both are needed to decide the entry, and neither depends on the other:
    // the metadata names the feed root, the id of the address names a record.
    const [metadata, entry] = await Promise.all([
      this.loadMetadata(),
      this.resolveEntryPoint(this._initPara.initId),
    ]);
    this._feedRootId = metadata.feedRootNodeId ?? null;
    this.applyEntryPoint(entry);

    this.isHydrated = true;
    // A session began while the entry was on its way: its record may be one
    // fetched without it.
    if (this._reloadAfterEntry) {
      this._reloadAfterEntry = false;
      this.reloadShownNode();
    }
  }

  /**
   * Loads the content tree again after a record changed. Only a node counts
   * (or a sender that names no object): publishing a content leaves the tree
   * alone — contents are not in it.
   */
  reloadTreeAfterChange(objectName) {
    if (objectName && objectName !== 'node') {
      return;
    }
    this.loadContentTree();
  }

  /**
   * One request for everyone who needs the tree; a failed one keeps the old.
   * Requests overlap — the one at the start with one after a change or a
   * login — and answers may come in any order: an answer to an older request
   * is dropped, the tree of the last request stays.
   */
  async loadContentTree() {
    const request = ++this._treeRequest;
    const tree = await this.queryRecord({ object: 'contents' });
    if (request !== this._treeRequest) {
      return;
    }
    if (Array.isArray(tree)) {
      this._tree = tree;
    }
  }

  /**
   * Was ist das für eine Id in der URL?
   *
   * **Gefragt wird das Backend, nicht das Präfix.** Früher entschied
   * `000s`/`000c`/`000p`, welcher Einstieg gewählt wird. Das Präfix war eine
   * Typangabe in einer Id — es funktionierte nur, solange es genau drei Typen
   * gab, und eine nach der Umstellung angelegte Id hätte gar keins mehr
   * getragen. Jetzt zählt allein, was hinter der Id steckt.
   *
   * Alte Deep-Links bleiben damit gültig: das Backend löst `000s…`/`000c…`
   * über `node.legacy_id` auf und `000p…` über `content_node.legacy_id`.
   */
  async resolveEntryPoint(recordId) {
    if (!recordId) {
      return { kind: 'none' };
    }

    const node = await this.queryRecord({ object: 'node', id: recordId });
    if (node?.id) {
      return { kind: 'node', node };
    }

    // Kein Knoten — dann vielleicht ein Inhalt. Ein Deep-Link auf einen Absatz
    // landete früher stillschweigend auf der Startseite.
    const content = await this.queryRecord({ object: 'content', id: recordId });
    if (content?.id) {
      return { kind: 'content', content };
    }

    return { kind: 'none' };
  }

  /**
   * Setzt die beiden Knoten entsprechend dem aufgelösten Einstieg.
   *
   * Der aufgelöste Datensatz wird **übergeben**, nicht nur seine Id: sonst
   * holte der Knoten genau das noch einmal, was hier gerade angekommen ist.
   * Die Listener hängen deshalb **vor** der Übergabe — `adoptNode` meldet
   * `loaded` sofort, nicht erst nach einer Antwort aus dem Netz.
   */
  applyEntryPoint(
    entry,
    contentnumber = this._initPara?.paragraphnumber ?? null
  ) {
    if (entry.kind === 'node') {
      const node = entry.node;
      const parentId = node.parent_node_id;
      if (this._feedRootId && node.id === this._feedRootId) {
        // The feed root itself: the same start page as without an id.
        this.enterFeed();
      } else if (this._feedRootId && parentId === this._feedRootId) {
        // A feed. Its parent is the feed root, which is not a selection —
        // the feed is shown where feeds are shown, with its tab open.
        this.enterFeed({ feedId: node.id, contentnumber });
      } else {
        // Any other node: exactly this one, already loaded — nothing to wait
        // for.
        this._showNode(node.id, { record: node, contentnumber });
      }
      return;
    }

    if (entry.kind === 'content') {
      // Deep-Link auf einen Inhalt: gezeigt wird der Knoten, an dem er hängt,
      // und darin wird zu ihm gesprungen. Wohin der Sprung geht, entscheidet
      // erst der Knoten — ein Feed zeigt seine Inhalte an anderer Stelle.
      const target =
        this._initPara?.paragraphnumber ?? entry.content.sortnumber;
      this.resolveEntryPoint(entry.content.node_id).then((nodeEntry) =>
        this.applyEntryPoint(nodeEntry, target)
      );
      return;
    }

    // No id in the address, or one that matches nothing: the start page.
    this.enterFeed();
  }

  // =========== Feed ============

  /** The entry leads to the feeds. */
  enterFeed(target) {
    this.showFeed(target);
  }

  /**
   * Shows the feeds instead of the node.
   *
   * The feed component only gets its root from the first time it is shown: a
   * visitor who enters on a node and never comes here loads no feed.
   */
  showFeed({ feedId = null, contentnumber = null } = {}) {
    this._feedRequested = true;
    this._feedVisible = true;
    this._activeFeedId = feedId;
    this._feedContentNumber = contentnumber;
    // The feeds are not part of the content tree the navigation shows.
    this._setCurrentLocation(null);
  }

  /** A node was opened: the feeds make way for it. */
  hideFeed() {
    this._feedVisible = false;
  }

  /** The home button in the header. */
  handleHome() {
    this.showStartPage();
  }

  /**
   * Back to the start page — the feeds, the first one open, and the bare
   * address. The feeds were kept while a node was shown, so nothing is
   * loaded again; a visitor who entered on a node loads them here.
   */
  showStartPage() {
    this.showFeed();
    window.history.replaceState({}, '', '/');
  }

  /** The visitor opened another feed. */
  handleFeedSelect(event) {
    this.selectFeed(event.detail.id);
  }

  /** Another feed is open: the address names it, to be shared. */
  selectFeed(feedId) {
    this._activeFeedId = feedId;
    this._feedContentNumber = null;
    window.history.replaceState({}, '', `/${feedId}`);
  }

  /** Einen Datensatz über den Callout-Layer holen, als Promise. */
  queryRecord(payload) {
    return new Promise((resolve) => {
      this.dispatchEvent(
        new CustomEvent('query', {
          detail: {
            payload,
            callback: (error, data) => resolve(error ? null : data),
          },
          bubbles: true,
          composed: true,
        })
      );
    });
  }

  // =========== Hydration - End ============

  // ============ event handler  ============

  handleToggleLightswitch(event) {
    document
      .querySelector('html')
      .classList.toggle('dark-mode', !event.detail.checked);
  }

  // ============ action methods ============

  fireToast(message, variant) {
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: {
          message: message,
          variant: variant,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Liest die URL — mehr nicht.
   *
   * Hier stand früher die Präfix-Typisierung (`000s` → story, `000c` →
   * chapter, …) und damit die Entscheidung über den Einstieg. Die ist
   * ersatzlos entfallen: **was** eine Id bezeichnet, weiß das Backend
   * (`resolveEntryPoint`), nicht der Aufbau der Zeichenkette.
   */
  createInitializationParameterObject() {
    const initParameter = {};
    initParameter.firstUrlParameter = window.location.pathname.split('/').pop();
    initParameter.isFirstUrlParameterSet =
      initParameter.firstUrlParameter.length > 0;
    initParameter.initId = initParameter.firstUrlParameter;

    // Read optional paragraphnumber query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const paragraphnumber = urlParams.get('paragraphnumber');
    initParameter.paragraphnumber = paragraphnumber
      ? Number(paragraphnumber)
      : null;

    console.table('initParameter', initParameter);
    return initParameter;
  }

  evaluateMetadata(metadata) {
    let pageHeaderHeadline = !metadata.pageHeaderHeadline
      ? '#config:pageHeaderHeadline#'
      : metadata.pageHeaderHeadline;
    this.spanHeaderHeadline.textContent = pageHeaderHeadline;
    let metaTitle = !metadata.metaTitle
      ? '#config:metaTitle#'
      : metadata.metaTitle;
    document.title = metaTitle;

    let createdMetaTags = [];
    if (metadata.meta) {
      Object.keys(metadata.meta).forEach((key) => {
        const metaTag = document.createElement('meta');
        metaTag.name = key;
        metaTag.content = metadata.meta[key];
        createdMetaTags.push(metaTag);
      });
      document.head.append(...createdMetaTags);
    }
  }

  // ----- Element getter -----

  get spanHeaderHeadline() {
    return this.shadowRoot.querySelector('span#page-header-headline');
  }

  /** The node shown, above. */
  get nodeView() {
    return this.shadowRoot.querySelector('custom-node-view');
  }

  /** The feeds of the start page. */
  get feed() {
    return this.shadowRoot.querySelector('custom-feed');
  }

  get navigationModal() {
    return this.shadowRoot.querySelector('custom-navigation-modal');
  }

  /** The contents of the node shown, below. */
  get nodeContents() {
    return this.shadowRoot.querySelector('custom-node-contents');
  }

  // ------------------------------------------
  // Metadata
  // ------------------------------------------

  /**
   * The configuration of the application. The entry waits for it: it names
   * the feed root, and without that the start page cannot be decided.
   */
  async loadMetadata() {
    const metadata = await this.queryRecord({ object: 'metadata' });
    if (metadata) {
      this.evaluateMetadata(metadata);
    }
    return metadata ?? {};
  }
}

customElements.define('app-bookstore', Bookstore); // Define the custom element
