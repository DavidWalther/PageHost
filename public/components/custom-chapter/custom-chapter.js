import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'components/custom-chapter/custom-chapter.html';
let templatePromise = null;
let loadedMarkUp = null;

class CustomChapter extends HTMLElement {
  label = {
    labelNotifcationLinkCopied: 'Link kopiert'
  }

  contentDivElem = null;

  /**
   * @returns {Array} Array of attribute names to observe
   * standard ist defined by Native HTML
   */
  static get observedAttributes() {
    return ['id'];
  }

  /**
   * @param {String} name Name of the attribute that changed
   * @param {String} oldValue Old value of the attribute
   * @param {String} newValue New value of the attribute
   * standard ist defined by Native HTML
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      switch (name) {
        case 'id':
          if ( !newValue || newValue === 'null' ) {
            this.clearContent();
          } else {
            this.fetchAndDisplayChapter(newValue);
          }
          break;
        default:
          break;
      }
    }
  }

  /**
   * includes the shared stylesheet
   */
  constructor() {
    super();
    const shadowRoot =  this.attachShadow({ mode: 'open' });
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this.fetchAndDisplayChapter = this.fetchAndDisplayChapter.bind(this);
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

  /**
   * lifecyle hook called when the component is added to the DOM
   */
  async connectedCallback() {
    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    // Append the main template
    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    this.contentDivElem = this.shadowRoot.querySelector('#chapter-content');
    const chapterId = this.id;
    //this.fetchAndDisplayChapter(chapterId);
  }

  /**
   * @returns {Promise} Promise that resolves to the chapter and it's paragraphs
   */
  async fetchAndDisplayChapter(chapterId) {
    if (!chapterId) {return;}

    this.fireQueryEvent_Chapter(chapterId, this.queryEventCallback_Chapter.bind(this));
  }

  // ----------------------------------------------
  // helpers
  // ----------------------------------------------

  createChapterCard(chapterData) {
    // create card element without buttons
    // it must
    // - be a slds-card element with a span element for the header
    // - have a share button
    // return the card element

    const cardElem = document.createElement('slds-card');
    cardElem.setAttribute('no-footer', '');

    const headerSpanElem = document.createElement('span');
    headerSpanElem.setAttribute('slot', 'header');
    headerSpanElem.textContent = chapterData.name;
    cardElem.appendChild(headerSpanElem);

    const shareButtonElem = this.createShareButton(chapterData.id);
    shareButtonElem.setAttribute('slot', 'actions');
    cardElem.appendChild(shareButtonElem);

    return cardElem;
  }

  createShareButton(uri) {
    const shareButtonElem = document.createElement('slds-button-icon');
    shareButtonElem.setAttribute('icon', 'utility:link');
    shareButtonElem.setAttribute('variant', 'container-filled');
    shareButtonElem.addEventListener('click', () => {
      this.writeToClipboard(location.origin + '/' + uri);
    });
    shareButtonElem.addEventListener('click', () => {
      shareButtonElem.setAttribute('disabled', '');

      const toastContainer = document.createElement('div');
      toastContainer.style.width = '90%';
      toastContainer.style.textAlign = 'center';
      toastContainer.style.position = 'fixed';
      toastContainer.style.top = '10%';
      toastContainer.style.zIndex = '10';

      const toastElement = document.createElement('slds-toast');
      toastElement.setAttribute('state', 'info');
      toastElement.textContent = this.label.labelNotifcationLinkCopied;
      toastContainer.appendChild(toastElement);
      this.shadowRoot.appendChild(toastContainer);

      setTimeout(() => {
          toastContainer.parentNode.removeChild(toastContainer)
      }, 900);
      setTimeout(() => {
          shareButtonElem.removeAttribute('disabled');
      }, 2500);
    });
    return shareButtonElem;
  }

  clearContent() {
    const contentDivElement = this.contentDivElement;
    if (!contentDivElement) {
      return;
    }
    while (contentDivElement.firstChild) {
      contentDivElement.removeChild(contentDivElement.firstChild);
    }
  }

  createContent(paragraphsData, reversed) {
    // create a div element with the class 'slds-grid' and add a div element with the class 'slds-col' for each paragraph
    // return the div element

    let gridElem = document.createElement('div');
    gridElem.classList.add('slds-grid');
    this.setContentReversed(gridElem, reversed);
    paragraphsData.forEach(paragraph => {
      let contentElem;
      contentElem = document.createElement('div');
      contentElem.classList.add('slds-col');
      contentElem.classList.add('slds-p-bottom_small');

      const paragraphElem = document.createElement('custom-paragraph');
      if (paragraph.name) {
        paragraphElem.setAttribute('data-name', paragraph.name);
      }
      paragraphElem.setAttribute('id', paragraph.id);

      contentElem.appendChild(paragraphElem);

      gridElem.appendChild(contentElem);
    });
    return gridElem;
  }

  setContentReversed(gridElement, reversed) {
    // if gridElement is not set, use the default gridElement
    let workingGridElement = gridElement;
    if(!workingGridElement) {
      workingGridElement = this.contentGridElement;
    }

    let styleVertical = 'slds-grid_vertical';
    let styleVerticalReverse = 'slds-grid_vertical-reverse';

    if (reversed) {
      workingGridElement.classList.add(styleVerticalReverse);
      workingGridElement.classList.remove(styleVertical);
    } else {
      workingGridElement.classList.add(styleVertical);
      workingGridElement.classList.remove(styleVerticalReverse);
    }
  }

  // ----------------------------------------------
  // actions
  // ----------------------------------------------

  writeToClipboard(value) {
    navigator.clipboard.writeText(value)
    .then(() => {
      console.log('Text copied to clipboard');
    })
    .catch(err => {
      console.error('Error copying text to clipboard:', err);
    });
  }

  showChapterSpinner() {
    if (!this.spinner) { return; }
    this.spinner.removeAttribute('hidden');
  }

  hideChapterSpinner() {
    if (!this.spinner) { return; }
    this.spinner.setAttribute('hidden', '');
  }

  // ----------------------------------------------
  // getters for elements
  // ----------------------------------------------

  get contentDivElement() {
    return this.shadowRoot.querySelector('#chapter-content');
  }

  get spinner() {
    return this.shadowRoot.querySelector('slds-spinner');
  }

  // getter for grid with paragraphs
  get contentGridElement() {
    return this.shadowRoot.querySelector('.slds-grid');
  }

  // ----------------------------------------------
  // properties for attributes
  // ----------------------------------------------

  /**
   * @returns {String} The chapter id
   */
  get id() {
    return this.getAttribute('id');
  }

  // ------------------------------------------
  // Query Event methods
  // ------------------------------------------

  // --------- Fire Query Event methods ---------

  fireQueryEvent_Chapter(chapterid, callback) {
    let payload = {
        object: 'chapter',
        id: chapterid
    }
    this.clearContent();
    this.showChapterSpinner();
    this.dispatchEvent(new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true
    }));
  }

  // --------- Query Event Callback methods ---------

  queryEventCallback_Chapter(error, data) {
    if (error) {
        console.error('Error fetching chapter data:', error);
    }
    if(data) {
      let chapterData = data;
      let reversed = chapterData.reversed;
      
      let paragraphsData = data.paragraphs;

      // create card with new chapter's content
      let cardElem = this.createChapterCard(chapterData);
      let paragraphElem = this.createContent(paragraphsData, reversed);
      cardElem.appendChild(paragraphElem);

      this.contentDivElement.appendChild(cardElem);
    }
    this.hideChapterSpinner();
  }
}

customElements.define('custom-chapter', CustomChapter);
