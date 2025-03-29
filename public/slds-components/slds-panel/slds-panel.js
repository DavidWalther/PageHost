import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = '/slds-components/slds-panel/slds-panel.html';
let templatePromise = null;
let loadedMarkUp = null;

class SldsPanel extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    this.applyGlobalStyles();
  }

  applyGlobalStyles() {
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

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
    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    this.initializeCloseButton();
  }

  initializeCloseButton() {
    const closeButton = this.shadowRoot.querySelector('.slds-panel__close');
    closeButton.addEventListener('click', () => this.closePanel());
    this.shadowRoot.querySelector('.screencover').addEventListener('click', () => this.closePanel());
  }

  openPanel() {
    this.shadowRoot.querySelector('.slds-panel').classList.add('slds-is-open');
    this.shadowRoot.querySelector('.screencover').classList.add('slds-show');
    this.shadowRoot.querySelector('.screencover').classList.remove('slds-hide');
  }

  closePanel() {
    this.shadowRoot.querySelector('.slds-panel').classList.remove('slds-is-open');
    this.shadowRoot.querySelector('.screencover').classList.add('slds-hide');
    this.shadowRoot.querySelector('.screencover').classList.remove('slds-show');
  }
}

customElements.define('slds-panel', SldsPanel);
