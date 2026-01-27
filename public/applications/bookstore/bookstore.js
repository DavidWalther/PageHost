import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import OIDCComponent from "/modules/oIdcComponent.js";

console.log('Bookstore.js file loaded');

const recordIdPrefixToPostgresTableName = {
  '000s' : 'Story',
  '000c' : 'Chapter',
  '000p' : 'Paragraph'
};

class Bookstore extends LitElement {
  static properties = {
    isHydrated: { type: Boolean, state: true },
    _initPara: { type: Object, state: true }
  };

  constructor() {
    super();
    console.log('Bookstore constructor called');
    // LitElement automatically creates shadow DOM
    // Initialize component state
    this.isHydrated = false;
    this._initPara = null;
  }

  // =========== Lifecycle methods ============

  connectedCallback() {
    console.log('Bookstore connectedCallback called');
    super.connectedCallback();
    console.log('After super.connectedCallback()');
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    console.log('After addGlobalStylesToShadowRoot');

    console.log('Bookstore connected');

    // read url and identify init-flow
    this._initPara = this.createInitializationParameterObject();
    this.saveAuthParameterToStorage();

    // Handle auth parameters
    let authParams = sessionStorage.getItem('authParameters');
    sessionStorage.removeItem('authParameters');

    if(authParams) {
      authParams = JSON.parse(authParams);
      setTimeout(() => {
        let oidcComponent = this.shadowRoot.querySelector('oidc-component');
        if (oidcComponent) {
          oidcComponent.setAttribute('auth-code', authParams.code);
          oidcComponent.setAttribute('auth-state', authParams.state);
          oidcComponent.startAuthCodeExchange();
        }
      }, 0);
      // Don't clear URL parameters yet - wait for authentication to complete
    } else {
      // Only clear URL parameters if there are no auth parameters to process
      this.clearUrlParameter();
    }

    // get button to show login modal
    let buttonId = 'button-login';
    let button = document.querySelector(`#${buttonId}`);
    if(button) {
      button.addEventListener('click', this.handleClickShowLoginModal.bind(this));
    }

    this.hydrate();
  }

  render() {
    return html`
      <slds-card no-footer no-header>
        <slds-modal>
          <custom-login-module></custom-login-module>
        </slds-modal>
          <custom-global-header>
            <div slot="left" class="slds-text-align_center">
              <slds-button-icon
                id="button-panel_open"
                icon="utility:rows"
                size="small"
                variant="container-transparent"
              ></slds-button-icon>
            </div>
            <div slot="mid" class="slds-text-align_center slds-text-heading_large">
              <span id="page-header-headline"></span>
            </div>
            <div slot="right" class="slds-grid slds-wrap">
              <div class="slds-col slds-text-align_right slds-size_1-of-1">
                <div class="slds-col slds-text-align_right slds-size_1-of-1">
                  <button id="button-login" @click="${this.handleClickShowLoginModal}">Show Login</button>
                </div>
              </div>
              <div class="slds-col slds-text-align_right slds-size_1-of-1">
                <slds-toggle
                  label="Licht"
                  name="options"
                  @toggle="${this.handleToggleLightswitch}"
                  direction-reversed
                ></slds-toggle>
              </div>
            </div>
          </custom-global-header>
        </slds-card>
      <span>
        <slds-panel id="sidebar">
          <span id="sidebar-title" slot="header"></span>
          <div id="pill-container"></div>
        </slds-panel>
      </span>

      <div id="bookshelf" class="slds-grid slds-grid_vertical slds-m-top--small">
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-story></custom-story>
        </div>
        <div class="slds-col slds-m-horizontal--small slds-m-bottom--small">
          <custom-chapter></custom-chapter>
        </div>
      </div>
    `;
  }

  handleClickShowLoginModal() {
    console.log('handleClickShowLoginModal - creating modal');
    let rootElement = this.shadowRoot.querySelector('slds-card');

    if(!rootElement) {
      console.log('handleClickShowLoginModal - no modal found');
      return;
    }

    console.log('handleClickShowLoginModal - modal found');
    let modalCmp = this.shadowRoot.querySelector('slds-modal');
    modalCmp.setAttribute('title', 'testmodal');
    modalCmp.show();
  }

  disconnectedCallback() {
    // Remove event listener when the component is disconnected

    this.removeEventListener('navigation', this.handleNavigationEvent);
  }

  // =========== Hydration - Start ============

  async hydrate() {
    // Check if the component is already hydrated
    if (this.isHydrated) {
      return;
    }
    // Hydrate the component

    this.fireQueryEvent_Metadata(this.queryEventCallback_Metadata.bind(this));
    this.fireQueryEvent_AllStories(this.queryEventCallback_AllStories.bind(this));

    // Use setTimeout to ensure elements are rendered before accessing them
    setTimeout(() => {
      // Initialize the story container
      switch(this._initPara.initmode) {
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
      this.addEventListener('navigation', this.handleNavigationEvent.bind(this));
    }, 0);
  }

  initWithoutParameter() {
    // navigation-/loaded eventlisteners are attacherd right away
    this.storyElement.addEventListener('navigation', this.handleNavigationEvent.bind(this));
    this.storyElement.addEventListener('loaded', (event) => {
      this.handleLoadStory(event);
      this._initPara = null;
    });
    this.storyElement.setAttribute('id', '000s00000000000011');
  }

  initWithStoryId(storyId) {
    // loaded eventlistener is attached right away
    // navigation eventlistener is attached after the loaded event was received
    this.storyElement.setAttribute('id', storyId);
    this.storyElement.addEventListener('loaded', (event) => {
      this.handleLoadStory(event);
      this._initPara = null;
    });
    this.storyElement.addEventListener('navigation', this.handleNavigationEvent.bind(this));
  }

  initWithChapterId(chapterId) {
    // chapter does not fire navigation events
    // loaded eventlistener is attached right away
    this.chapterElement.setAttribute('id', chapterId);
    this.chapterElement.parentElement.addEventListener('loaded', (event) => {
      if(Array.isArray(event.detail.chapterData)) { return; }
      console.log('Custom chapter loaded event:', event.detail);
      let storyId = event.detail.chapterData.storyid;
      this.storyElement.setAttribute('id', storyId);
      this.storyElement.setAttribute('selectedChapter', event.detail.chapterData.id);
      this.storyElement.addEventListener('navigation', this.handleNavigationEvent.bind(this));
      this.storyElement.addEventListener('loaded', (event) => {
        this.handleLoadStory(event);
        this._initPara = null;
      });
    },
    {once:true});
  }

  handleLoadStory(event) {
    if(Array.isArray(event.detail.bookData)) { return; }
    console.log('Custom story loaded event:', event.detail);

    let coverChapterId = event.detail.bookData.coverid;
    if(coverChapterId && this._initPara?.initmode !== 'chapter') {
      this.storyElement.setAttribute('selectedChapter', coverChapterId);
      this.chapterElement.setAttribute('id', coverChapterId);
    }
  }

  // =========== Hydration - End ============

  // =========== Authentication - Start =================

  saveAuthParameterToStorage() {
    let queryParameters = window.location.search.substring(1).split('&').reduce((aggregate, current) => {
      let temp = current.split('=');
      aggregate[temp[0]] = temp[1];
      return aggregate;
    },{});

    if(!queryParameters.code && !queryParameters.state) { return; }
    let authParameters = {
      code: queryParameters.code,
      state: queryParameters.state
    };
    sessionStorage.setItem('authParameters', JSON.stringify(authParameters));
  }

  async getGoogleAuthConfig() {
    return new Promise((resolve) => {
      fetch('/api/1.0/env/variables')
      .then(response => response.json())
      .then(variables => {
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
          callback: resolve
        },
        bubbles: true,
        composed: true
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
        action: 'write'
      },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  clearStorage(storageType, key) {
    const event = new CustomEvent('storage', {
      detail: {
        storageType,
        key,
        action: 'clear'
      },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  // ============ Storage methods ============

// ============ event handler  ============

  handleToggleLightswitch(event) {
    document.querySelector('html').classList.toggle('dark-mode', !event.detail.checked);
  }

  handleNavigationEvent(event) {
    event.stopPropagation();
    if(!this.isHydrated) { return; }

    const { type, value } = event.detail;
    let isEventSourceStory = event.srcElement.tagName === 'CUSTOM-STORY';
    let isEventSourcePanel = event.srcElement.tagName === 'APP-BOOKSTORE';

    if(isEventSourcePanel && type === 'story') {
      this.storyElement.setAttribute('id', value);
      this.chapterElement.removeAttribute('id');
      this.storyElement.removeAttribute('selectedChapter');
      return;
    }
    if(isEventSourceStory && type === 'chapter') {
      this.chapterElement.setAttribute('id', value);
      this.storyElement.setAttribute('selectedChapter', value);
      return;
    }
  }

  // ============ action methods ============

  fireToast(message, variant) {
    this.dispatchEvent(
      new CustomEvent('toast', {
      detail: {
        message: message,
        variant: variant
      },
      bubbles: true,
      composed: true
    }));
  }

  createInitializationParameterObject() {
    const typeMape = new Map();
    typeMape.set('000s', 'story');
    typeMape.set('000c', 'chapter');
    typeMape.set('000p', 'paragraph');

    const initParameter = {};
    initParameter.firstUrlParameter = window.location.pathname.split('/').pop();
    initParameter.isFirstUrlParameterSet = initParameter.firstUrlParameter.length > 0;
    initParameter.initId = initParameter.firstUrlParameter;

    let initmode = typeMape.get(initParameter.firstUrlParameter.substring(0, 4));
    initParameter.initmode = initmode || 'none';

    console.table('initParameter', initParameter);
    return initParameter;
  }

  clearUrlParameter() {
    window.history.replaceState({}, '', window.location.origin);
  }
  // ============ Panel methods ============

  async initializePanel(allStories) {
    // Use setTimeout to ensure elements are rendered
    setTimeout(() => {
      const buttonPanelOpen = this.shadowRoot.querySelector('#button-panel_open');
      if (buttonPanelOpen) {
        buttonPanelOpen.addEventListener('click', this.openPanel.bind(this));
      }

      const dummyPills = [];
      const storyData = allStories;

      storyData.forEach((story) => {
        dummyPills.push(this.createButtonElement(story.name, story.id, () => {
          this.chapterElement.removeAttribute('id'); // Clear the id attribute of the chapter component
          this.dispatchEvent(new CustomEvent('navigation', {
            detail: {
              type: 'story',
              value: story.id
            },
            bubbles: true,
            //composed: true
          }));
          this.closePanel();
        }));
      });

      const pillContainer = this.shadowRoot.querySelector('#pill-container');
      if (pillContainer) {
        dummyPills.forEach(pill => {
          pillContainer.appendChild(pill);
        });
      }
    }, 0);
  }

  openPanel() {
    const panelElem = this.shadowRoot.querySelector('#sidebar');
    if(!panelElem) {return;}
    panelElem.openPanel();
  }

  closePanel() {
    const panelElem = this.shadowRoot.querySelector('#sidebar');
    if(!panelElem) {return;}
    panelElem.closePanel();
  }

  createButtonElement(label, value, onclickCallback) {
    const buttonElem = document.createElement('button');
    // add slds classes
    buttonElem.classList.add('slds-button');
    buttonElem.classList.add('slds-button_neutral');

    buttonElem.textContent = label;
    buttonElem.setAttribute('data-story-id', value);

    buttonElem.addEventListener('click', onclickCallback);

    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('slds-p-vertical_small');
    buttonContainer.appendChild(buttonElem);
    return buttonContainer;
  }

  evaluateMetadata(metadata) {
    let pageHeaderHeadline = !metadata.pageHeaderHeadline ? '#config:pageHeaderHeadline#' : metadata.pageHeaderHeadline;
    this.spanHeaderHeadline.textContent = pageHeaderHeadline;
    let pageSidebarTitle = !metadata.pageSidebarTitle ? '#config:pageSidebarTitle#' : metadata.pageSidebarTitle;
    this.spanSidebarTitle.textContent = pageSidebarTitle;
    let metaTitle = !metadata.metaTitle ? '#config:metaTitle#' : metadata.metaTitle;
    document.title = metaTitle;

    let createdMetaTags =[];
    if (metadata.meta) {
      Object.keys(metadata.meta).forEach(key => {
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
    notFoundSpan.textContent = 'Entschuldigung. Da war leider nichts zu finden.';

    notFoundDiv.appendChild(notFoundSpan);
    storyContainer.appendChild(notFoundDiv);
  }

  // ----- Element getter -----

  get spanHeaderHeadline() {
    return this.shadowRoot.querySelector('span#page-header-headline');
  }

  get spanSidebarTitle() {
    return this.shadowRoot.querySelector('span#sidebar-title');
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

  fireQueryEvent_AllStories(callback) {
    let payload = {
        object: 'story',
    }

    this.dispatchEvent(new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true
    }));
  }

  fireQueryEvent_Metadata(callback) {
    let payload = {
        object: 'metadata',
    }

    this.dispatchEvent(new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true
    }));
  }

  // --------- Query Event Callback methods ---------

  queryEventCallback_AllStories(error, data) {
    if(data) {
      this.initializePanel(data);
    }
    if(error) {
      console.error(error);
    }
  }

  queryEventCallback_Metadata(error, data) {
    if(data) {
      this.evaluateMetadata(data);
    }
    if(error) {
      console.error(error);
    }
  }
}

customElements.define('app-bookstore', Bookstore);  // Define the custom element
