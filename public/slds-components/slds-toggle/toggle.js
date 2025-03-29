import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

let templatePromise = null; // this variable makes sure only the first load results in an actual fetch
const templatePath = 'slds-components/slds-toggle/toggle.html';

class SLDSToggle extends HTMLElement {
  constructor() {
    super();
    // Attach a shadow DOM tree to the instance
    const shadowRoot = this.attachShadow({ mode: 'open' });
    this.applyGlobalStyles();
  }

  applyGlobalStyles() {
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  //--------------------------
  // Handlers
  //--------------------------

  async connectedCallback() {
    const templateContent = await this.loadHtmlTemplate();
    this.shadowRoot.appendChild(templateContent.cloneNode(true));
  }

  //--------------------------
  // HTML Caching
  //--------------------------

  async loadHtmlTemplate() {
    if (!templatePromise) {
      templatePromise = fetch(templatePath)
      .then(response => response.text())
      .then(html => {
        const htmlTemplate = new DOMParser().parseFromString(html, 'text/html').querySelector('template');
        return htmlTemplate.content.cloneNode(true);
      });
    }
    return templatePromise;
  }
}

// Define the custom element
customElements.define('slds-input-toggle', SLDSToggle);
