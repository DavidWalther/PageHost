import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

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
    this.handleNavigationEvent = this.handleNavigationEvent.bind(this);
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

  async connectedCallback() {
    // check location for story id
    const firstUrlParameter = window.location.pathname.split('/').pop();
    // take first four characters of the url parameter
    const isFirstUrlParameterSet = firstUrlParameter.length > 0;

    // Save ID to session storage if present
    if (isFirstUrlParameterSet) {
      this.writeToStorage('session', 'redirectId', firstUrlParameter);
      window.location.href = window.location.origin; // Redirect to host URL
      return;
    }

    const initParameter = await this.handleRedirectId();

    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    // Append the main template
    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    this.initializeStoryContainer(initParameter);
    this.fireQueryEvent_Metadata(this.queryEventCallback_Metadata.bind(this));
    this.fireQueryEvent_AllStories(this.queryEventCallback_AllStories.bind(this));

    // Listen for navigation events
    this.addEventListener('navigation', this.handleNavigationEvent);
  }

  disconnectedCallback() {
    // Remove event listener when the component is disconnected
    this.removeEventListener('navigation', this.handleNavigationEvent);
  }

  /**
   * Description: 
   * If a redirectId is present in the session storage, the method will read the redirectId from the session storage and
   * determine the initmode and initId based on the redirectId. The initmode and initId will be returned as an object.
   */
  async handleRedirectId() {
    const redirectIdFromSessionStorage = await this.readFromStorage('session', 'redirectId');
    const initParameter = {};
    initParameter.initmode = null;
    if (redirectIdFromSessionStorage !== null) {
      this.clearStorage('session', 'redirectId');

      const parameterPrefix = redirectIdFromSessionStorage.substring(0, 4);
      const tableName = recordIdPrefixToPostgresTableName[parameterPrefix];

      initParameter.initId = redirectIdFromSessionStorage;

      // initmode is set to 'none' if the parameter is not a defined key in the recordIdPrefixToPostgresTableName object
      initParameter.initmode = 'none';

      if (tableName) {
        initParameter.initmode = tableName.toLowerCase();
      }
    }
    return initParameter;
  }

  // ============ Storage methods ============

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

  // ============ Panel methods ============
  async initializePanel(allStories) {
    const buttonPanelOpen = this.shadowRoot.querySelector('#button-panel_open');
    buttonPanelOpen.addEventListener('click', this.openPanel.bind(this)); // Bind this to the openPanel method

    const dummyPills = [];
    const storyData = allStories;

    storyData.forEach((story) => {
      dummyPills.push(this.createButtonElement(story.name, story.id, () => {
        this.clearStoryContainer();
        this.loadStory(story.id);
        this.chapterElement.removeAttribute('id'); // Clear the id attribute of the chapter component
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

  // ========== Story Container methods ===========

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

  /**
   * asynch method to initialize the story container by url parameter
   */
  async initializeStoryContainer(parameterObject) {
    const initmode = parameterObject.initmode;
    const initParameter = parameterObject.initId;

    this.clearStoryContainer();
    switch(initmode) {
      case 'story':
        const storyId = initParameter;
        this.fireQueryEvent_Story(storyId, this.queryEventCallback_Story.bind(this));
        break;
      case 'chapter':
        const chapterId = initParameter;
        this.fetchChapters(chapterId).then(chapter => {
          this.clearStoryContainer();

          if(!chapter.id && !chapter.length > 0) {
            this.showStoryNotFound();
          }
          if(chapter.length > 0) {
            this.loadStoryAndChapter(chapter[0].storyid, chapter[0].id);
          }
          if(chapter.id) {
            this.loadStoryAndChapter(chapter.storyid, chapter.id);
          }
        })
        .catch(error => {
          this.clearStoryContainer();
          this.showStoryNotFound();
        })
        .finally(() => {
        });
        break;
      case 'none':
        this.clearStoryContainer();
        this.showStoryNotFound();
      break;
      default:
        this.loadStory('000s00000000000011');
        break;
    }
  }

  /**
   * If a custom storyElement exists, update the 'story-id' attribute and remove the 'chapter-id' attribute
   * If not, create a new custom story element, set the 'story-id' attribute and append it to the storyContainer,
   * This method will pass the storyId to the custom-story element
   */
  loadStory(storyId) {
    console.log('load story: ' + storyId);

    const storyElement = this.storyElement;
    if(!storyElement) {
      const customStory = document.createElement('custom-story');
      this.storyContainer.appendChild(customStory);
    }
    this.storyElement.setAttribute('story-id', storyId);
    this.storyElement.setAttribute('chapter-buttons_number-max', 2);
  }

  loadStoryAndChapter(storyId, chapterId) {
    console.log('load story: ' + storyId + ' and chapter: ' + chapterId);

    this.loadStory(storyId);

    const chapterElement = this.chapterElement;
    if(!chapterElement) {
      const customChapter = document.createElement('custom-chapter');
      this.storyContainer.appendChild(customChapter);
    }
    this.chapterElement.setAttribute('id', chapterId);
  }

  // method to clear everything inside the story container
  clearStoryContainer() {
    const storyElements = this.storyContainer.querySelectorAll('*');
    // remove all custom-story elements
    storyElements.forEach(storyElement => {
      if(storyElement.tagName === 'SLDS-SPINNER') { return; }

      storyElement.remove();
    });
  }

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

  // ----- Fetching data from the server -----

  async fetchChapters(chapterId) {
    return fetch(`/data/query/chapter?id=${chapterId}`)
    .then(response => response.json());
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

  fireQueryEvent_Story(storyId, callback) {
    let payload = {
        object: 'story',
        id: storyId
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

  queryEventCallback_Story(error, data) {
    this.clearStoryContainer();
    if(data) {
      this.loadStory(data.id);
    }
    if(error) {
      console.error(error);
      this.showStoryNotFound();
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

  // --------- Handle Navigation Event ---------

  handleNavigationEvent(event) {
    const { type, value } = event.detail;
    if (type === 'chapter') {
      this.loadStoryAndChapter(this.storyElement.getAttribute('story-id'), value);
    }
  }
}

customElements.define('app-bookstore', Bookstore);  // Define the custom element