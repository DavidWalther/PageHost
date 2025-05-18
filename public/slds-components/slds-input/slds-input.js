import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'slds-components/slds-input/slds-input.html';
let templatePromise = null;
let loadedMarkUp = null;

class SldsInput extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    this.applyGlobalStyles();
  }

  applyGlobalStyles() {
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  //-------------------
  // Lifecycle hooks
  //-------------------

  async connectedCallback() {
    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));
    this.handleAttributeTypeChange(this.getAttribute('type'));
    this.handleAttributeValueChange(this.getAttribute('value'));
    this.handleAttributeLabelChange(this.getAttribute('label'));

    this.shadowRoot.querySelectorAll('input.input-element').forEach(element => {
      element.addEventListener('change', this.handleChangeInput.bind(this));
    });
    this._initialized = true;
  }

  //-------------------
  // Listen to outside attribute changes
  //-------------------

  static get observedAttributes() {
    return ['value', 'label', 'type']; // Added 'type' attribute
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if(!this._initialized) {return;}
    switch (name) {
      case 'value':
        this.handleAttributeValueChange(newValue);
        break;
      case 'label':
        this.handleAttributeLabelChange(newValue);
        break;
      case 'type': // Added case for 'type' attribute
        this.handleAttributeTypeChange(newValue);
        break;
      default:
        break;
    }
  }

  handleAttributeValueChange(newValue) {
    // Handle value attribute change

    this.shadowRoot.querySelectorAll('div.slds-form-element > div.slds-form-element__control > .input-element').forEach(element => {
      element.value = newValue;
    });
  }

  handleAttributeLabelChange(newValue) {
    // Handle label attribute change
    this.shadowRoot.querySelector('label.slds-form-element__label').textContent = newValue;
  }

  handleAttributeTypeChange(newValue) {
    // Handle type attribute change

    if(! loadedMarkUp) {
      return;
    }

    switch (newValue) {
      case 'date':
        this.replaceSlotWithTemplate('placeholder-input', '#template-type-date');
        break;
      default:
        this.replaceSlotWithTemplate('placeholder-input', '#template-type-text');
        break;
    }
  }

  //-------------------
  // Event handlers
  //-------------------

  handleChangeInput(event) {
    const eventChange = new CustomEvent('change', {
      bubbles: true,
      detail: {
        type: event.target.type,
        value: event.target.value
      },
    });
    this.dispatchEvent(eventChange);
  }

//-------------------
// Helpers
//-------------------

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

  replaceSlotWithTemplate(slotId, templateId) {
    const slot = this.shadowRoot.querySelector(`slot[name=${slotId}]`);
    if (slot) {
      const templateContent = loadedMarkUp.querySelector(templateId).content;
      const parentNode = slot.parentNode;
      parentNode.replaceChild(templateContent.cloneNode(true), slot);
    }
  }
}

customElements.define('slds-input', SldsInput);
