import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = '/slds-components/slds-spinner/slds-spinner.html';
let templatePromise = null;
let loadedMarkUp = null;

const PLACEHOLDER_ID = 'placeholder-spinner';
const TEMPLATEID_WITH_CONTAINER = 'template-with-container';
const TEMPLATEID_WITHOUT_CONTAINER = 'template-without-container';

const SIZE_STYLE_MAP = new Map([
  ['xx-small', 'slds-spinner_xx-small'],
  ['x-small', 'slds-spinner_x-small'],
  ['small', 'slds-spinner_small'],
  ['medium', 'slds-spinner_medium'],
  ['large', 'slds-spinner_large']
]);

class SldsSpinner extends HTMLElement {

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    this.applyGlobalStyles();;
  }

  applyGlobalStyles() {
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  // ------------------ react on attribut changes -  ------------------

  static get observedAttributes() {
    return [
      'container', // is only checked for existence
      'debug', // is only checked for existence
      'hidden', // is only checked for existence
      'size' // valid sizes: xx-small, x-small, small, medium, large
    ];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // do something with the attribute value

    if (oldValue === newValue) {
      return;
    }

    switch (name) {
      case 'container':
        this.setContainerTemplate
        break;
      case 'size':
        this.setSpinnerSize();
        break;
      case 'hidden':
        this.setSpinnerVisibility();
        break;
      default:
        break;
    }
  }

  // ------------------ getter methods ------------------

  get isHidden() {
    let falsyValues = ['null', 'undefined', '' , undefined];
    let hidden = this.getAttribute('hidden');
    if (falsyValues.includes(hidden)) {
      return true;
    }
    return false;
  }

  get isContainer() {
    return this.getAttribute('container') !== null;
  }

  get isDebug() {
    return this.getAttribute('debug') !== null;
  }

  // ------------------ lifecycle methods ------------------

  async connectedCallback() {
    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    this.setContainerTemplate();
    this.setSpinnerSize();
  }

  // ------------------ load html markup ------------------

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

  setSpinnerVisibility() {
    if(! this.isHidden) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    const placeholderElement = this.getPlaceholderElement();
    if(!placeholderElement) {
      return;
    }
    placeholderElement.style.display = 'block';
  }

  hide() {
    const placeholderElement = this.getPlaceholderElement();
    if(!placeholderElement) {
      return;
    }
    placeholderElement.style.display = 'none';
  }

  /**
   * select spinner in placeholder and set a style class according to the size
   */
  setSpinnerSize() {
    const placeholderElement = this.getPlaceholderElement();
    if(!placeholderElement) {
      return;
    }
    const spinnerElement = placeholderElement.querySelector('.slds-spinner');
    const size = this.getAttribute('size');

    if (SIZE_STYLE_MAP.has(size)) {
      const sizeStyle = SIZE_STYLE_MAP.get(size);
      spinnerElement.classList.add(sizeStyle);
    }
  }

  // =========================
  // helper methods
  // =========================

  getPlaceholderElement() {
    return this.shadowRoot.querySelector(`#${PLACEHOLDER_ID}`);
  }

  setContainerTemplate() {
    this.addTemplateToElement(this.getContainerToLoad());
  }

  getContainerToLoad() {
    return this.isContainer === true ? TEMPLATEID_WITH_CONTAINER : TEMPLATEID_WITHOUT_CONTAINER;
  }

  addTemplateToElement(templateElementId) {
    const templateElement = loadedMarkUp.querySelector(`#${templateElementId}`);
    const placeholderElement = this.getPlaceholderElement();

    const clone = templateElement.content.cloneNode(true);
    placeholderElement.innerHTML = '';
    placeholderElement.appendChild(clone);
  }
}

customElements.define('slds-spinner', SldsSpinner);
