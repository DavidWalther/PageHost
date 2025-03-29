import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'slds-components/slds-card/slds-card.html';
let templatePromise = null; // this variable makes sure only the first load results in an actual fetch
let loadedMarkUp = null;

class Card extends HTMLElement {

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });  // Attach a shadow root

    this.applyGlobalStyles();
  }

  applyGlobalStyles() {
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(`
      article.slds-card {
        background-color: white;
      }
    `);
    this.shadowRoot.adoptedStyleSheets = [styleSheet, ...this.shadowRoot.adoptedStyleSheets];
  }

  // ------------------------------
  // Lifecycle hooks
  // ------------------------------

  async connectedCallback() {
    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    // Append the main template
    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    // Find the slots and replace them with the corresponding templates

    this.replaceSlotWithTemplate('placeholder-header', '#template-header');
    this.replaceSlotWithTemplate('placeholder-header_icon', '#template-header_icon');

    if(! this.isNoFooter) {
      this.replaceSlotWithTemplate('placeholder-footer', '#template-footer');
    }

    const slotTitleText = this.shadowRoot.querySelector('#header');
    if(slotTitleText) {
      const slotParentNode = slotTitleText.parentNode;
      slotParentNode.removeChild(slotParentNode);
      slotParentNode.textContent = 'i Am the title';
    }
    // Loop over the observed attributes and call the attributeChangedCallback
    Card.observedAttributes.forEach(attr => {
      this.attributeChangedCallback(attr, null, this.getAttribute(attr));
    });
  }

  // ------------------------------
  // Attributes
  // ------------------------------

  static get observedAttributes() {
    return ['no-header', 'no-footer', 'no-border'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;

      switch (name) {
        case 'no-header': {
          /*if (this.isNoHeader) {
            this.shadowRoot.querySelector('#header').style.display = 'none';
          } else {
            this.shadowRoot.querySelector('#header').style.display = '';
          }*/
          break;
        }
        case 'no-footer': {
          /*if (this.isNoFooter) {
            this.shadowRoot.querySelector('#footer').style.display = 'none';
          } else {
            this.shadowRoot.querySelector('#footer').style.display = '';
          }*/
          break;
        }
        case 'no-border': {
          if (newValue !== null) {
            this.border_hide();
          } else {
            this.border_show();
          }
          break;
        }
      }
  }

  get isNoHeader() {
    return this.getAttribute('no-header') !== null ? true : false;
  }

  get isNoFooter() {
    return this.getAttribute('no-footer') !== null ? true : false;
  }

  // ------------------------------
  // Loaders
  // ------------------------------

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
    const slot = this.shadowRoot.querySelector(`slot#${slotId}`);
    if (slot) {
      const templateContent = loadedMarkUp.querySelector(templateId).content;
      const parentNode = slot.parentNode;
      parentNode.replaceChild(templateContent.cloneNode(true), slot);
    }
  }

  // ------------------------------
  // Actions
  // ------------------------------

  border_toggle() {
    if(!this.getElement_Article()) return;
    this.getElement_Article().classList.toggle('no-border');
  }
  border_hide() {
    if(!this.getElement_Article()) return;
    this.getElement_Article().classList.add('no-border');
  }

  border_show() {
    if(!this.getElement_Article()) return;
    this.getElement_Article().classList.remove('no-border');
  }

  // ------------------------------
  // Element selectors
  // ------------------------------

  getElement_Article() {
    return this.shadowRoot.querySelector('article');
  }
}

customElements.define('slds-card', Card);  // Define the custom element