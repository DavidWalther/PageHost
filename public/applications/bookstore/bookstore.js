import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import OIDCComponent from '/modules/oIdcComponent.js';

console.log('Bookstore.js file loaded');

/**
 * Einstieg ohne Deep-Link.
 *
 * Trägt noch eine alte Id: der Inhaltsbaum liefert sie so, und das Backend
 * löst sie über `legacy_id` auf. Sobald es hier eine Konfiguration gibt
 * (Startknoten je App), fällt die Konstante weg.
 */
const DEFAULT_ENTRY_NODE_ID = '000s00000000000011';

class Bookstore extends LitElement {
  static properties = {
    isHydrated: { type: Boolean, state: true },
    _initPara: { type: Object, state: true },
    _currentLocation: { type: String, state: true },
  };

  constructor() {
    super();
    console.log('Bookstore constructor called');
    // LitElement automatically creates shadow DOM
    // Initialize component state
    this.isHydrated = false;
    this._initPara = null;
    this._pendingChildSelection = null;
    this._currentLocation = null;
  }

  // =========== Lifecycle methods ============

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet

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
      </custom-settings-modal>
      <custom-navigation-modal
        current-location="${this._currentLocation}"
        @story-select="${this.handleStorySelect}"
        @chapter-select="${this.handleChapterSelect}"
      ></custom-navigation-modal>

      <!--
        Zwei Knoten, nicht zwei Typen: oben der Knoten, dessen Kinder zur
        Auswahl stehen, unten der ausgewählte Knoten mit seinen Inhalten.
        Welche Rolle ein Knoten spielt, entscheidet allein seine Position hier
        — die Komponente ist beide Male dieselbe.

        data-role ist dabei nur der Selektor für die Getter unten. Wirksam
        wird die Rolle über die Attribute: Die Daten sagen, WAS ein Knoten hat,
        diese Zeilen sagen, WOFÜR die jeweilige Instanz da ist. Sie stehen im
        Template, weil sie sich nie ändern — damit gelten sie vor der ersten
        Zuweisung von id oder contentnumber.
      -->
      <div
        id="bookshelf"
        class="slds-grid slds-grid_vertical slds-m-top--small"
      >
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-node
            data-role="navigation"
            can-create-child
            no-contents
          ></custom-node>
        </div>
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <!-- Keine Kind-Auswahl: handleNavigationEvent wertet nur Meldungen
               des oberen Knotens aus, ein Klick bliebe hier wirkungslos.
               Kein "Kind anlegen": Das Angelegte erschiene in genau der
               Auswahl, die hier nicht gezeigt wird. -->
          <custom-node
            data-role="content"
            can-create-content
            can-delete
            no-child-navigation
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

  handleOpenSettings() {
    this.shadowRoot.querySelector('custom-settings-modal').show();
  }

  handleOpenNavigation() {
    this.shadowRoot.querySelector('custom-navigation-modal').show();
  }

  /**
   * Merkt sich, wo der Nutzer gerade steht — in der Id-Form des
   * **Inhaltsbaums**.
   *
   * Der Baum (`/api/1.0/contents/*`) liefert weiterhin die alten Ids; das
   * Navigations-Modal vergleicht dagegen. Die neue Id des Knotens würde dort
   * nie treffen, und die aktuelle Stelle bliebe unmarkiert. Deshalb nimmt
   * diese Stelle einen Datensatz entgegen und wählt daraus die alte Id, solange
   * es eine gibt. Fällt die Kompat-Id weg, bleibt automatisch die neue übrig.
   */
  _setCurrentLocation(record) {
    if (!record) {
      this._currentLocation = null;
      return;
    }
    this._currentLocation =
      typeof record === 'string'
        ? record
        : (record.legacy_id ?? record.id ?? null);
  }

  handleStorySelect(event) {
    const { id } = event.detail;
    this._setCurrentLocation(id);
    this.dispatchEvent(
      new CustomEvent('navigation', {
        detail: { type: 'story', value: id },
        bubbles: true,
      })
    );
    // Modal stays open so the user can drill down into the story's chapters.
  }

  handleChapterSelect(event) {
    const { storyId, chapterId } = event.detail;

    const currentParentId = this.navigationNode.getAttribute('id');
    if (currentParentId !== storyId) {
      // Suppress the cover override in handleNavigationNodeLoaded for this
      // reload, so the explicitly selected child is kept.
      this._pendingChildSelection = chapterId;
      this.navigationNode.setAttribute('id', storyId);
    }
    this.contentNode.setAttribute('id', chapterId);
    this.navigationNode.setAttribute('selected-child', chapterId);
    this._setCurrentLocation(chapterId);

    this.shadowRoot.querySelector('custom-navigation-modal').hide();
  }

  handleClearSession() {
    sessionStorage.removeItem('code_exchange_response');
    window.location.reload();
  }

  disconnectedCallback() {
    // Remove event listener when the component is disconnected
    this.removeEventListener('navigation', this.handleNavigationEvent);
    this.removeEventListener('chapter-updated', this._handleChildUpdated);
    this.removeEventListener('node-deleted', this._handleNodeDeleted);
  }

  _handleChildUpdated(event) {
    const updated = event.detail?.chapterData;
    if (updated && this.navigationNode) {
      this.navigationNode.applyChildUpdate(updated);
    }
  }

  _handleNodeDeleted(event) {
    const nodeId = event.detail?.nodeId;
    if (!nodeId) return;
    if (this.navigationNode) {
      this.navigationNode.removeChildNode(nodeId);
    }
    if (this.contentNode?.getAttribute('id') === nodeId) {
      this.contentNode.removeAttribute('id');
    }
  }

  // =========== Hydration - Start ============

  async hydrate() {
    // Check if the component is already hydrated
    if (this.isHydrated) {
      return;
    }

    this.fireQueryEvent_Metadata(this.queryEventCallback_Metadata.bind(this));

    // Die Knoten müssen im Shadow-DOM stehen, bevor sie Attribute bekommen.
    await this.updateComplete;

    const entry = await this.resolveEntryPoint(this._initPara.initId);
    this.applyEntryPoint(entry);

    this.isHydrated = true;
    if (this.navigationNode) {
      this.navigationNode.setAttribute('child-buttons_number-max', 2);
    }
    this.addEventListener('navigation', this.handleNavigationEvent.bind(this));
    // `custom-chapter-edit` meldet weiterhin `chapter-updated` — die
    // Editierkomponente trägt ihren alten Namen noch.
    this.addEventListener(
      'chapter-updated',
      this._handleChildUpdated.bind(this)
    );
    this.addEventListener('node-deleted', this._handleNodeDeleted.bind(this));
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
  applyEntryPoint(entry) {
    if (entry.kind === 'node') {
      const parentId = entry.node.parent_node_id;
      if (parentId) {
        // Ein Knoten mit Eltern: er füllt den Inhalt, sein Elternknoten die
        // Auswahl. Beides ist schon bekannt — es muss nichts abgewartet werden.
        this.showChildOf(parentId, entry.node);
      } else {
        this._attachNavigationNodeListeners();
        this._setCurrentLocation(entry.node);
        this.navigationNode.adoptNode(entry.node);
      }
      return;
    }

    if (entry.kind === 'content') {
      // Deep-Link auf einen Inhalt: gezeigt wird der Knoten, an dem er hängt,
      // und darin wird zu ihm gesprungen.
      this.contentNode.setAttribute(
        'contentnumber',
        this._initPara?.paragraphnumber ?? entry.content.sortnumber
      );
      this.resolveEntryPoint(entry.content.node_id).then((nodeEntry) =>
        this.applyEntryPoint(nodeEntry)
      );
      return;
    }

    this.initWithoutParameter();
  }

  /** Auswahl oben, Inhalt unten — der Regelfall nach einem Deep-Link. */
  showChildOf(parentId, childNode) {
    const childId = childNode.id;
    if (this._initPara?.paragraphnumber) {
      // Muss vor der Übergabe stehen: der Knoten wertet es beim Übernehmen aus.
      this.contentNode.setAttribute(
        'contentnumber',
        this._initPara.paragraphnumber
      );
    }
    this.contentNode.adoptNode(childNode);

    this.navigationNode.setAttribute('selected-child', childId);
    // Der Titel-Knoten des Elternteils darf die ausdrückliche Wahl nicht
    // überschreiben.
    this._pendingChildSelection = childId;
    this._setCurrentLocation(childNode);
    this._attachNavigationNodeListeners();
    // Den Elternknoten kennen wir nur mit Id — den holt er sich selbst.
    this.navigationNode.setAttribute('id', parentId);
  }

  initWithoutParameter() {
    this._attachNavigationNodeListeners();
    this.navigationNode.setAttribute('id', DEFAULT_ENTRY_NODE_ID);
    this._setCurrentLocation(DEFAULT_ENTRY_NODE_ID);
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

  /** Auswahl-Knoten: Navigation und „geladen" hängen immer zusammen. */
  _attachNavigationNodeListeners() {
    this.navigationNode.addEventListener(
      'navigation',
      this.handleNavigationEvent.bind(this)
    );
    this.navigationNode.addEventListener('loaded', (event) =>
      this.handleNavigationNodeLoaded(event)
    );
  }

  handleNavigationNodeLoaded(event) {
    const nodeData = event.detail?.nodeData;
    if (!nodeData?.id) {
      return;
    }

    if (this._pendingChildSelection) {
      // Ein Kind wurde ausdrücklich gewählt — im Navigations-Modal oder über
      // einen Deep-Link. Diese Wahl schlägt den Titel-Knoten.
      this._pendingChildSelection = null;
      return;
    }

    const coverId = nodeData.cover_node_id;
    if (coverId) {
      this.navigationNode.setAttribute('selected-child', coverId);
      this.contentNode.setAttribute('id', coverId);
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

  handleNavigationEvent(event) {
    event.stopPropagation();
    if (!this.isHydrated) {
      return;
    }

    const { type, value } = event.detail;
    // Beide Knoten sind dieselbe Komponente — der Tag-Name unterscheidet sie
    // nicht mehr. Maßgeblich ist, WELCHER der beiden gemeldet hat.
    const fromNavigationNode = event.target === this.navigationNode;
    const fromPanel = event.target === this;

    if (fromPanel && type === 'story') {
      this.navigationNode.setAttribute('id', value);
      this.contentNode.removeAttribute('id');
      this.navigationNode.removeAttribute('selected-child');
      this._setCurrentLocation(value);
      return;
    }
    if (fromNavigationNode && type === 'node') {
      this.contentNode.setAttribute('id', value);
      this.navigationNode.setAttribute('selected-child', value);
      this._setCurrentLocation(event.detail.node ?? value);
      return;
    }
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

  /** Der Knoten, dessen Kinder zur Auswahl stehen. */
  get navigationNode() {
    return this.shadowRoot.querySelector('custom-node[data-role="navigation"]');
  }

  /** Der ausgewählte Knoten, dessen Inhalte gezeigt werden. */
  get contentNode() {
    return this.shadowRoot.querySelector('custom-node[data-role="content"]');
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
