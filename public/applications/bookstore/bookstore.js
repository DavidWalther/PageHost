import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import OIDCComponent from '/modules/oIdcComponent.js';
import { findPath } from '/modules/content-tree.mjs';

console.log('Bookstore.js file loaded');

/**
 * Entry without a deep link.
 *
 * Still a retired id: the backend resolves it through `legacy_id`, and
 * `handleNodeLoaded` moves the location to the record id the
 * content tree carries once the node has loaded. Goes away once there is a
 * configuration for it (start node per app).
 */
const DEFAULT_ENTRY_NODE_ID = '000s00000000000011';

/** Key of the home breadcrumb — never a node id, so it cannot clash with one. */
const HOME_BREADCRUMB_KEY = '#home';

class Bookstore extends LitElement {
  static properties = {
    isHydrated: { type: Boolean, state: true },
    _initPara: { type: Object, state: true },
    _currentLocation: { type: String, state: true },
    // The content tree — loaded here, consumed by the modal and the breadcrumbs.
    _tree: { state: true },
  };

  constructor() {
    super();
    console.log('Bookstore constructor called');
    // LitElement automatically creates shadow DOM
    // Initialize component state
    this.isHydrated = false;
    this._initPara = null;
    // Show the cover node of the next node that loads (start page, drilling
    // into a node in the modal) — once, then it is consumed.
    this._coverOnLoad = false;
    // Bound once, so the same function can be removed again.
    this._handlePopState = this.handlePopState.bind(this);
    this._currentLocation = null;
    this._tree = [];
  }

  // =========== Lifecycle methods ============

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    window.addEventListener('popstate', this._handlePopState);

    // read url and identify init-flow
    this._initPara = this.createInitializationParameterObject();

    // get button to show login modal
    let buttonId = 'button-login';
    let button = document.querySelector(`#${buttonId}`);
    if (button) {
      button.addEventListener(
        'click',
        this.handleClickShowLoginModal.bind(this)
      );
    }

    this.hydrate();
    this.label = {
      'setting-login_title': 'Login',
      'setting-lightswitch_title': 'Lichtschalter',
      'setting-sessionClear_title': 'Login-Session löschen',
    };
  }

  render() {
    return html`
      <slds-card no-footer no-header>
        <slds-layout wrap>
          <slds-layout-item align-middle size="3-of-12">
            <slds-layout wrap>
              <slds-layout-item>
                <slds-button-icon
                  id="button-navigation_open"
                  icon="utility:rows"
                  size="small"
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
              <slds-layout-item>
                <slds-button-icon
                  id="button-settings_open"
                  icon="utility:settings"
                  size="small"
                  variant="container-transparent"
                  @click="${this.handleOpenSettings}"
                ></slds-button-icon>
              </slds-layout-item>
            </slds-layout>
          </slds-layout-item>
        </slds-layout>
      </slds-card>
      ${this.renderBreadcrumbs()}
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
        @navigation-level-open="${this.handleNavigationLevelOpen}"
        @navigation-node-select="${this.handleNavigationNodeSelect}"
      ></custom-navigation-modal>

      <!--
        One node: it shows the node the visitor stands on — its children as a
        selection on top, then its contents. The attributes say what this one
        instance may do; they stand in the template so they hold before the
        first node arrives. No child-creating here: next to "create content"
        it would be a second identical "+"; it returns as the "+" tile in the
        navigation modal (#187). Deleting moves there later as well (#200).
      -->
      <div
        id="bookshelf"
        class="slds-grid slds-grid_vertical slds-m-top--small"
      >
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-node
            child-buttons_number-max="2"
            can-create-content
            can-delete
          ></custom-node>
        </div>
      </div>
    `;
  }

  handleLogout() {
    console.log('handleLogout - creating modal');
    let rootElement = this.shadowRoot.querySelector('slds-card');

    if (!rootElement) {
      console.log('handleLogout - no modal found');
      return;
    }

    console.log('handleLogout - modal found');
    let modalCmp = this.shadowRoot.querySelector('slds-modal');
    modalCmp.hide();
  }

  handleClickShowLoginModal() {
    console.log('handleClickShowLoginModal - creating modal');
    let rootElement = this.shadowRoot.querySelector('slds-card');

    if (!rootElement) {
      console.log('handleClickShowLoginModal - no modal found');
      return;
    }

    console.log('handleClickShowLoginModal - modal found');
    let modalCmp = this.shadowRoot.querySelector('slds-modal');
    modalCmp.setAttribute('title', 'testmodal');
    modalCmp.show();
  }

  /**
   * Home first, then the ancestors of the current node, root first — never
   * the node itself, which the node card already names. On a root node (or an
   * unknown one) only home remains.
   */
  get breadcrumbItems() {
    const home = {
      key: HOME_BREADCRUMB_KEY,
      label: 'Startseite',
      href: '/',
      icon: 'utility:home',
    };
    const ancestors = findPath(this._tree, this._currentLocation)
      .slice(0, -1)
      .map((node) => ({ key: node.id, label: node.name, href: `/${node.id}` }));
    return [home, ...ancestors];
  }

  /** A row below the header for going up — always there, home at its start. */
  renderBreadcrumbs() {
    const items = this.breadcrumbItems;
    // The last item is the parent, not the current node: it must be a link,
    // and it must not be announced as the current page.
    return html`
      <div class="slds-m-horizontal_small slds-m-top_x-small">
        <slds-breadcrumbs
          overflow
          overflow_limit="3"
          last-item-as-link
          no-current-item
          .items="${items}"
          @breadcrumb-select="${this.handleBreadcrumbSelect}"
        ></slds-breadcrumbs>
      </div>
    `;
  }

  /** Going up: the page shows the ancestor itself, not its cover node. */
  handleBreadcrumbSelect(event) {
    const id = event.detail?.key;
    if (!id) {
      return;
    }
    if (id === HOME_BREADCRUMB_KEY) {
      this.handleHome();
      return;
    }
    this.showNode(id);
  }

  /**
   * Home: the start page inside the app, without a reload — like `GET /`.
   *
   * The node the visitor leaves becomes the previous history entry, then the
   * address turns into the root address; browser back leads to that node
   * again. Already on the start node, nothing is added to the history: only
   * the start page is applied anew.
   */
  async handleHome() {
    const entry = await this.resolveEntryPoint(DEFAULT_ENTRY_NODE_ID);
    // The start page shows the entry node or, where it has one, its cover.
    const startIds = [
      DEFAULT_ENTRY_NODE_ID,
      entry.node?.id,
      entry.node?.cover_node_id,
    ];
    const here = this._currentLocation;
    if (here && !startIds.includes(here)) {
      window.history.replaceState({}, '', `/${here}`);
      window.history.pushState({}, '', '/');
    }
    this.showStart(entry);
  }

  /**
   * Browser back/forward: the address names a node (or none for the start
   * page); it is shown inside the app, like a deep link but without a reload.
   * Only home writes history entries, so these are the addresses it left.
   */
  async handlePopState() {
    if (!this.isHydrated) {
      return;
    }
    const id = window.location.pathname.split('/').pop();
    if (!id) {
      this.showStart();
      return;
    }
    this.applyEntryPoint(await this.resolveEntryPoint(id));
  }

  /**
   * The one way to show a node. Fetches the record (unless it is given) and
   * hands it to the node, so `loaded` always follows — also when the same
   * node is shown again, where only setting `id` would do nothing.
   *
   * `cover`: show the node's cover node instead, where it has one (start
   * page, drilling into a node in the modal). `contentNumber`: jump to that
   * content after loading.
   */
  async showNode(target, { cover = false, contentNumber = null } = {}) {
    const record =
      typeof target === 'string'
        ? await this.queryRecord({ object: 'node', id: target })
        : target;
    if (!record?.id) {
      return;
    }
    this._coverOnLoad = cover;
    if (contentNumber) {
      this.node.setAttribute('contentnumber', contentNumber);
    } else {
      this.node.removeAttribute('contentnumber');
    }
    this.node.adoptNode(record);
  }

  /** The start page: the entry node, shown as its cover where it has one. */
  showStart(entry) {
    const start = entry?.kind === 'node' ? entry.node : DEFAULT_ENTRY_NODE_ID;
    this.showNode(start, { cover: true });
  }

  handleOpenSettings() {
    this.shadowRoot.querySelector('custom-settings-modal').show();
  }

  handleOpenNavigation() {
    this.shadowRoot.querySelector('custom-navigation-modal').show();
  }

  /**
   * Remembers where the visitor stands — in the id the **content tree** uses.
   *
   * The tree (`/api/1.0/contents/*`) carries the record id, never the
   * `legacy_id`; the navigation modal compares against it. A record therefore
   * contributes its `id`. A plain string is taken as given — it may still be
   * a retired id (the default entry is one); `handleNodeLoaded`
   * swaps it for the record id once that node has loaded.
   */
  _setCurrentLocation(record) {
    if (!record) {
      this._currentLocation = null;
      return;
    }
    this._currentLocation =
      typeof record === 'string' ? record : (record.id ?? null);
  }

  /**
   * A level opened in the modal: the page follows and shows that node — its
   * cover node where it has one. The modal stays open.
   */
  handleNavigationLevelOpen(event) {
    this.showNode(event.detail.id, { cover: true });
  }

  /** A node without children chosen in the modal: shown, the modal closes. */
  handleNavigationNodeSelect(event) {
    this.showNode(event.detail.id);
    this.shadowRoot.querySelector('custom-navigation-modal').hide();
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
    // Remove event listener when the component is disconnected
    this.removeEventListener('chapter-updated', this._handleChildUpdated);
    this.removeEventListener('node-deleted', this._handleNodeDeleted);
    window.removeEventListener('popstate', this._handlePopState);
  }

  _handleChildUpdated(event) {
    const updated = event.detail?.chapterData;
    if (updated && this.node) {
      this.node.applyChildUpdate(updated);
    }
  }

  _handleNodeDeleted(event) {
    const nodeId = event.detail?.nodeId;
    if (!nodeId) return;
    if (nodeId !== this._currentLocation) {
      this.node?.removeChildNode(nodeId);
      return;
    }
    // The shown node is gone: show its parent, or the start page for a root.
    // The tree still holds it here; its reload runs after this handler.
    const path = findPath(this._tree, nodeId);
    const parent = path.length > 1 ? path[path.length - 2] : null;
    if (parent) {
      this.showNode(parent.id);
    } else {
      this.showStart();
    }
  }

  // =========== Hydration - Start ============

  async hydrate() {
    // Check if the component is already hydrated
    if (this.isHydrated) {
      return;
    }

    this.fireQueryEvent_Metadata(this.queryEventCallback_Metadata.bind(this));
    this._loadContentTree();

    // Die Knoten müssen im Shadow-DOM stehen, bevor sie Attribute bekommen.
    await this.updateComplete;

    // Once, before any entry is applied: `adoptNode` reports `loaded` at
    // once, and every later entry (home, browser back) reuses the same node.
    this._attachNodeListeners();
    const entry = await this.resolveEntryPoint(this._initPara.initId);
    this.applyEntryPoint(entry, this._initPara.paragraphnumber);

    this.isHydrated = true;
    // `custom-chapter-edit` meldet weiterhin `chapter-updated` — die
    // Editierkomponente trägt ihren alten Namen noch.
    this.addEventListener(
      'chapter-updated',
      this._handleChildUpdated.bind(this)
    );
    this.addEventListener('node-deleted', this._handleNodeDeleted.bind(this));

    // Every change to a node changes the content tree of the navigation modal.
    const reloadTree = this._reloadNavigationTree.bind(this);
    [
      'chapter-created',
      'chapter-updated',
      'node-deleted',
      'published',
      'unpublished',
    ].forEach((name) => this.addEventListener(name, reloadTree));
  }

  /**
   * Loads the content tree again after a node changed. Publishing a content
   * leaves the tree alone — contents are not in it.
   */
  _reloadNavigationTree(event) {
    const objectName = event.detail?.objectName;
    if (objectName && objectName !== 'node') {
      return;
    }
    this._loadContentTree();
  }

  /** One request for everyone who needs the tree. */
  async _loadContentTree() {
    const tree = await this.queryRecord({ object: 'contents' });
    this._tree = Array.isArray(tree) ? tree : [];
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
   * Shows what an address names — a deep link at start or browser back:
   * exactly that node, never its cover node. A content shows the node it
   * hangs on and jumps to it. Nothing found: the start page.
   *
   * `paragraphNumber` comes from the first address only (`?paragraphnumber=`).
   */
  applyEntryPoint(entry, paragraphNumber = null) {
    if (entry.kind === 'node') {
      this.showNode(entry.node, { contentNumber: paragraphNumber });
      return;
    }
    if (entry.kind === 'content') {
      const contentNumber = paragraphNumber ?? entry.content.sortnumber;
      this.showNode(entry.content.node_id, { contentNumber });
      return;
    }
    this.showStart();
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

  /**
   * The node reports a chosen child (`navigation`) and that it has loaded
   * (`loaded`). Attached exactly once (in `hydrate`) — a second call would
   * run every handler twice.
   */
  _attachNodeListeners() {
    this.node.addEventListener('navigation', (event) =>
      this.handleNodeChildSelect(event)
    );
    this.node.addEventListener('loaded', (event) =>
      this.handleNodeLoaded(event)
    );
  }

  /** A child chosen in the node: the page shows that child. */
  handleNodeChildSelect(event) {
    event.stopPropagation();
    if (!this.isHydrated) {
      return;
    }
    const { node, value } = event.detail;
    this.showNode(node?.id ? node : value);
  }

  /**
   * The location is the node that has loaded — in its record id, the id the
   * content tree uses. Where a cover node was asked for, it replaces the node.
   */
  handleNodeLoaded(event) {
    const nodeData = event.detail?.nodeData;
    if (!nodeData?.id) {
      return;
    }
    this._setCurrentLocation(nodeData);

    const cover = this._coverOnLoad;
    this._coverOnLoad = false;
    if (cover && nodeData.cover_node_id) {
      this.showNode(nodeData.cover_node_id);
    }
  }

  // =========== Hydration - End ============

  // =========== Authentication - Start =================

  async getGoogleAuthConfig() {
    return new Promise((resolve) => {
      fetch('/api/1.0/env/variables')
        .then((response) => response.json())
        .then((variables) => {
          resolve(variables.auth.google);
        });
    });
  }

  async handleOIDCAuthenticated(event) {
    /**
     * Do something with the authentication result
     * For example, you can store the token in local storage or session storage
     */
    this.clearUrlParameter();
  }

  async handleOIDCClick(event) {
    const callback = event.detail.callback;
    const googleAuthConfig = await this.getGoogleAuthConfig();

    callback({
      client_id: googleAuthConfig.clientId,
      redirect_uri: googleAuthConfig.redirect_uri,
      scope: googleAuthConfig.scope,
      response_type: googleAuthConfig.response_type,
    });
  }

  handleAuthenticationRejection() {
    this.fireToast('Authentication failed', 'error');
    // clear history
    window.history.replaceState({}, '', window.location.pathname);
  }

  // ============  Authentication -End ============

  // ============ Storage methods - Start ============

  readFromStorage(storageType, key) {
    return new Promise((resolve) => {
      const event = new CustomEvent('storage', {
        detail: {
          storageType,
          key,
          action: 'read',
          callback: resolve,
        },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);
    });
  }

  writeToStorage(storageType, key, value) {
    const event = new CustomEvent('storage', {
      detail: {
        storageType,
        key,
        value,
        action: 'write',
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  clearStorage(storageType, key) {
    const event = new CustomEvent('storage', {
      detail: {
        storageType,
        key,
        action: 'clear',
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  // ============ Storage methods ============

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

  clearUrlParameter() {
    window.history.replaceState({}, '', window.location.origin);
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

  // ========== Container methods ===========

  // add content of 'template-story_not_found' into container
  showStoryNotFound() {
    const storyContainer = this.storyContainer;

    // Create the story not found content using DOM API
    const notFoundDiv = document.createElement('div');
    notFoundDiv.className = 'slds-text-align_center slds-text-heading_large';

    const notFoundSpan = document.createElement('span');
    notFoundSpan.textContent =
      'Entschuldigung. Da war leider nichts zu finden.';

    notFoundDiv.appendChild(notFoundSpan);
    storyContainer.appendChild(notFoundDiv);
  }

  // ----- Element getter -----

  get spanHeaderHeadline() {
    return this.shadowRoot.querySelector('span#page-header-headline');
  }

  /** The one node on the page. */
  get node() {
    return this.shadowRoot.querySelector('custom-node');
  }

  get storyContainer() {
    return this.shadowRoot.querySelector('#bookshelf > div');
  }

  get spinner() {
    return this.shadowRoot.querySelector('#spinner-story');
  }

  // ------------------------------------------
  // Query Event methods
  // ------------------------------------------

  // --------- Fire Query Event methods ---------

  fireQueryEvent_Metadata(callback) {
    let payload = {
      object: 'metadata',
    };

    this.dispatchEvent(
      new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true,
      })
    );
  }

  // --------- Query Event Callback methods ---------

  queryEventCallback_Metadata(error, data) {
    if (data) {
      this.evaluateMetadata(data);
    }
    if (error) {
      console.error(error);
    }
  }
}

customElements.define('app-bookstore', Bookstore); // Define the custom element
