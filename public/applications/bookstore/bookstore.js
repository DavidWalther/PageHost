import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import OIDCComponent from "/modules/oIdcComponent.js";

const templatePath = 'applications/bookstore/bookstore.html';
let templatePromise = null; // this variable makes sure only the first load results in an actual fetch
let loadedMarkUp = null;

const recordIdPrefixToPostgresTableName = {
  '000s' : 'Story',
  '000c' : 'Chapter',
  '000p' : 'Paragraph'
};

class Bookstore extends HTMLElement {

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });  // Attach a shadow root
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  /**
   * methods that loads the HTML markup file
   *
   * @returns {Promise} Promise that resolves to the parsed HTML markup
   */
  async loadHtmlMarkup() {
    if (!templatePromise) {
      templatePromise = fetch(templatePath)
      .then(response => response.text())
      .then(html => {
        return new DOMParser().parseFromString(html, 'text/html');
      });
    }
    return templatePromise;
  }

  // =========== Lifecycle methods ============

  async connectedCallback() {

    console.log('Bookstore connected');

    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    // read url and identify init-flow
    this._initPara = this.createInitializationParameterObject();
    this.saveAuthParameterToStorage();
    //this.clearUrlParameter();

    // Append the main template
    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    let authParams = sessionStorage.getItem('authParameters');
    if(authCode) {
      authParams = JSON.parse(authParams);
      let authCode = authParams.code;
      let oidcComponent = document.createElement('oidc-component');
      oidcComponent.setAttribute('auth-code', authCode);
    }

    // Listen for navigation events

    this.hydrate();
    this.hydrateAuthentication();
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
    this.storyElement.setAttribute('chapter-buttons_number-max', 2);
    this.addEventListener('navigation', this.handleNavigationEvent.bind(this));
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


    if(!queryParameters.code) { return; }
    let authParameters = {
      code: queryParameters.code,
    };
    sessionStorage.setItem('authParameters', JSON.stringify(authParameters));
  }

  hydrateAuthentication() {
    // Listen for OIDC events
    this.shadowRoot.querySelector('oidc-component').addEventListener('click', (event) => this.handleOIDCClick(event));
    this.shadowRoot.querySelector('oidc-component').addEventListener('authenticated', (event) => this.handleOIDCAuthenticated(event));

    this.shadowRoot.querySelector('oidc-component').addEventListener('logout', (event) => this.handleLogout(event));
    this.shadowRoot.querySelector('oidc-component').addEventListener('rejected', (event) => this.handleAuthenticationRejection(event));
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
    window.history.replaceState({}, '', window.location.pathname);
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

  async handleLogout(event) {
    let logoutCallback = event.detail.callback;
    let accessToken = sessionStorage.getItem('code_exchange_response');
    if(!accessToken) { return; }

    accessToken = JSON.parse(accessToken);
    const authHeader = 'Bearer ' + accessToken.authenticationResult.access.access_token;
    await fetch('/api/1.0/auth/logout', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    }).then(() => {
      this.fireToast('Logout successful', 'success');
      logoutCallback();
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
    const buttonPanelOpen = this.shadowRoot.querySelector('#button-panel_open');
    buttonPanelOpen.addEventListener('click', this.openPanel.bind(this)); // Bind this to the openPanel method

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
    dummyPills.forEach(pill => {
      pillContainer.appendChild(pill);
    });
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

  createPillElement(label, value, onclickCallback) {
    // Append the main template
    const templateId_pill = 'template-pill';
    const templatePillContent = loadedMarkUp.querySelector('#' + templateId_pill).content;

    const pillElem = templatePillContent.cloneNode(true);
    pillElem.querySelector('.slds-pill__label').textContent = label;
    pillElem.querySelector('.slds-pill__label').onclick = onclickCallback;
    pillElem.querySelector('.slds-pill__label').setAttribute('data-value', value);
    return pillElem;
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
    const templateId_story_not_found = 'template-story_not_found';
    const templateStoryNotFoundContent = loadedMarkUp.querySelector('#' + templateId_story_not_found).content;
    storyContainer.appendChild(templateStoryNotFoundContent.cloneNode(true));
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

  get chapterElement() {
    return this.shadowRoot.querySelector('custom-chapter');
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
