import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import OIDCComponent from '/modules/oIdcComponent.js';

console.log('Bookstore.js file loaded');

const recordIdPrefixToPostgresTableName = {
  '000s': 'Story',
  '000c': 'Chapter',
  '000p': 'Paragraph',
};

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
    this._pendingChapterSelection = null;
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
          <slds-layout-item align-middle size-3-of-12>
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
          <slds-layout-item size-6-of-12>
            <div class="slds-text-align_center slds-text-heading_large">
              <span id="page-header-headline"></span>
            </div>
          </slds-layout-item>
          <slds-layout-item align-middle size-3-of-12>
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
          <slds-layout-item size-1-of-1 class="slds-m-bottom--medium">
            <slds-layout>
              <slds-layout-item size-1-of-4>
                <span>Login</span>
              </slds-layout-item>
              <slds-layout-item size-3-of-4>
                <custom-login-module></custom-login-module>
              </slds-layout-item>
            </slds-layout>
          </slds-layout-item>

          <slds-layout-item size-1-of-1>
            <slds-layout>
              <slds-layout-item size-1-of-4>
                <span>Licht</span>
              </slds-layout-item>
              <slds-layout-item size-3-of-4>
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

      <div
        id="bookshelf"
        class="slds-grid slds-grid_vertical slds-m-top--small"
      >
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-story></custom-story>
        </div>
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-chapter></custom-chapter>
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

  _setCurrentLocation(id) {
    this._currentLocation = id;
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

    const currentStoryId = this.storyElement.getAttribute('id');
    if (currentStoryId !== storyId) {
      // Suppress the cover-image override in handleLoadStory for this reload,
      // so the explicitly selected chapter is kept.
      this._pendingChapterSelection = chapterId;
      this.storyElement.setAttribute('id', storyId);
    }
    this.chapterElement.setAttribute('id', chapterId);
    this.storyElement.setAttribute('selectedChapter', chapterId);
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
    this.removeEventListener('chapter-updated', this._handleChapterUpdated);
    this.removeEventListener('chapter-deleted', this._handleChapterDeleted);
  }

  _handleChapterUpdated(event) {
    const updatedChapter = event.detail?.chapterData;
    if (updatedChapter && this.storyElement) {
      this.storyElement.handleChapterUpdated(updatedChapter);
    }
  }

  _handleChapterDeleted(event) {
    const chapterId = event.detail?.chapterId;
    if (chapterId && this.storyElement) {
      this.storyElement.handleChapterDeleted(chapterId);
      this.chapterElement.removeAttribute('id'); // Clear the id attribute of the chapter component
    }
  }

  // =========== Hydration - Start ============

  async hydrate() {
    // Check if the component is already hydrated
    if (this.isHydrated) {
      return;
    }
    // Hydrate the component

    this.fireQueryEvent_Metadata(this.queryEventCallback_Metadata.bind(this));

    // Use setTimeout to ensure elements are rendered before accessing them
    setTimeout(() => {
      // Initialize the story container
      switch (this._initPara.initmode) {
        case 'story':
          this.initWithStoryId(this._initPara.initId);
          break;
        case 'chapter':
          this.initWithChapterId(this._initPara.initId);
          break;
        case 'none':
          this.initWithoutParameter();
          break;
        default:
          this.initWithoutParameter();
          break;
      }

      this.isHydrated = true;
      if (this.storyElement) {
        this.storyElement.setAttribute('chapter-buttons_number-max', 2);
      }
      this.addEventListener(
        'navigation',
        this.handleNavigationEvent.bind(this)
      );
      this.addEventListener(
        'chapter-updated',
        this._handleChapterUpdated.bind(this)
      );
      this.addEventListener(
        'chapter-deleted',
        this._handleChapterDeleted.bind(this)
      );
    }, 0);
  }

  initWithoutParameter() {
    // navigation-/loaded eventlisteners are attacherd right away
    this.storyElement.addEventListener(
      'navigation',
      this.handleNavigationEvent.bind(this)
    );
    this.storyElement.addEventListener('loaded', (event) => {
      this.handleLoadStory(event);
      this._initPara = null;
    });
    this.storyElement.setAttribute('id', '000s00000000000011');
    this._setCurrentLocation('000s00000000000011');
  }

  initWithStoryId(storyId) {
    // loaded eventlistener is attached right away
    // navigation eventlistener is attached after the loaded event was received
    this.storyElement.setAttribute('id', storyId);
    this._setCurrentLocation(storyId);
    this.storyElement.addEventListener('loaded', (event) => {
      this.handleLoadStory(event);
      this._initPara = null;
    });
    this.storyElement.addEventListener(
      'navigation',
      this.handleNavigationEvent.bind(this)
    );
  }

  initWithChapterId(chapterId) {
    // chapter does not fire navigation events
    // loaded eventlistener is attached right away
    this.chapterElement.setAttribute('id', chapterId);
    this._setCurrentLocation(chapterId);
    if (this._initPara?.paragraphnumber) {
      this.chapterElement.setAttribute(
        'paragraphnumber',
        this._initPara.paragraphnumber
      );
    }
    this.chapterElement.parentElement.addEventListener(
      'loaded',
      (event) => {
        if (Array.isArray(event.detail.chapterData)) {
          return;
        }
        console.log('Custom chapter loaded event:', event.detail);
        let storyId = event.detail.chapterData.storyid;
        this.storyElement.setAttribute('id', storyId);
        this.storyElement.setAttribute(
          'selectedChapter',
          event.detail.chapterData.id
        );
        this.storyElement.addEventListener(
          'navigation',
          this.handleNavigationEvent.bind(this)
        );
        this.storyElement.addEventListener('loaded', (event) => {
          this.handleLoadStory(event);
          this._initPara = null;
        });
      },
      { once: true }
    );
  }

  handleLoadStory(event) {
    if (Array.isArray(event.detail.bookData)) {
      return;
    }
    console.log('Custom story loaded event:', event.detail);

    if (this._pendingChapterSelection) {
      // A chapter was selected directly (e.g. from the navigation modal);
      // keep that selection instead of falling back to the cover chapter.
      this._pendingChapterSelection = null;
      return;
    }

    let coverChapterId = event.detail.bookData.coverid;
    if (coverChapterId && this._initPara?.initmode !== 'chapter') {
      this.storyElement.setAttribute('selectedChapter', coverChapterId);
      this.chapterElement.setAttribute('id', coverChapterId);
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
    let isEventSourceStory = event.srcElement.tagName === 'CUSTOM-STORY';
    let isEventSourcePanel = event.srcElement.tagName === 'APP-BOOKSTORE';

    if (isEventSourcePanel && type === 'story') {
      this.storyElement.setAttribute('id', value);
      this.chapterElement.removeAttribute('id');
      this.storyElement.removeAttribute('selectedChapter');
      this._setCurrentLocation(value);
      return;
    }
    if (isEventSourceStory && type === 'chapter') {
      this.chapterElement.setAttribute('id', value);
      this.storyElement.setAttribute('selectedChapter', value);
      this._setCurrentLocation(value);
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

  createInitializationParameterObject() {
    const typeMape = new Map();
    typeMape.set('000s', 'story');
    typeMape.set('000c', 'chapter');
    typeMape.set('000p', 'paragraph');

    const initParameter = {};
    initParameter.firstUrlParameter = window.location.pathname.split('/').pop();
    initParameter.isFirstUrlParameterSet =
      initParameter.firstUrlParameter.length > 0;
    initParameter.initId = initParameter.firstUrlParameter;

    let initmode = typeMape.get(
      initParameter.firstUrlParameter.substring(0, 4)
    );
    initParameter.initmode = initmode || 'none';

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

  // ========== Story Container methods ===========
  /**
   * If a custom storyElement exists, update the 'story-id' attribute and remove the 'chapter-id' attribute
   * If not, create a new custom story element, set the 'story-id' attribute and append it to the storyContainer,
   * This method will pass the storyId to the custom-story element
   */

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

  get chapterElement() {
    return this.shadowRoot.querySelector('custom-chapter');
  }

  get storyElement() {
    return this.shadowRoot.querySelector('custom-story');
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
