import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'components/global-header/global-header.html';
let templatePromise = null;
let loadedMarkUp = null;

class GlobalHeader extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' }); 
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  async loadHtmlMarkup() {
    if (!templatePromise) {
      templatePromise = fetch(templatePath)
        .then(response => response.text())
        .then(html => new DOMParser().parseFromString(html, 'text/html'));
    }
    return templatePromise;
  }

  async connectedCallback() {
    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }
    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));
  }
}

customElements.define('custom-global-header', GlobalHeader);
