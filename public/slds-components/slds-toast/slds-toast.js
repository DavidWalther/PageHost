import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = '/slds-components/slds-toast/slds-toast.html';
let templatePromise = null; // will contain the promise of the fetch the markup
let loadedMarkUp = null; // will be set on the first load of the markup

const THEME_DEFAULT = 'info';
const STATES = new Set(['success', 'info', 'warning', 'error']);

const ICON_URL_PLACEHOLDER = '{!state!}';
const ICON_URL_TPL ="/assets/icons/utility-sprite/svg/symbols.svg#{!state!}"
const THEME_TPL = 'slds-theme_{!state!}';
const ICON_UTILITY_TPL = 'slds-icon-utility-{!state!}';

class SldsToast extends HTMLElement {

    constructor() {
      super();
      const shadowRoot = this.attachShadow({ mode: 'open' });
      this.applyGlobalStyles();
    }

    applyGlobalStyles() {
      addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    }

    // ------------------ react on attribut changes -  ------------------

    static get observedAttributes() {
      return [
        'state',
        'debug' // is only checked for existence
      ];
    }

    attributeChangedCallback(name, oldValue, newValue) {
      // do something with the attribute value

      if (oldValue === newValue) {
        return;
      }

      switch (name) {
        case 'state':
          if (newValue) {
            this.setToastContainerThemeStyle(newValue);
          }
          break;
        default:
          break;
      }
    }

    // ------------------ Attribute getters ------------------

    get isDebug() {
      return this.hasAttribute('debug');
    }

    get state() {
      let attributeValue = this.getAttribute('state');
      // if attribute is not in the list of themes, return default

      if (!STATES.has(attributeValue)) {
        attributeValue = THEME_DEFAULT;
      }
      return attributeValue;
    }

    // ------------------ Lifecycle Callbacks -  ------------------

    async connectedCallback() {
      if (!loadedMarkUp) {
        loadedMarkUp = await this.loadHtmlMarkup();
      }

      const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
      this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

      this.setToastContainerThemeStyle(this.state);
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

    // ------------------ Template getters ------------------

    getMainTemplate() {
      return loadedMarkUp.querySelector('#template-main').content;
    }

    // ------------------ event getters ------------------

    get notifyContainer() {
      return this.shadowRoot.querySelector('.slds-notify');
    }

    get svgIcon() {
      return this.shadowRoot.querySelector('svg.slds-icon');
    }

    get spanAssistiveText() {
      return this.shadowRoot.querySelector('span.slds-assistive-text');
    }

    get iconContainer() {
      return this.shadowRoot.querySelector('.slds-icon_container');
    }

    // ------------------ actions ------------------

    setToastContainerThemeStyle(state) {
      if(!this.notifyContainer) {return; }

      this.notifyContainer.classList.add(THEME_TPL.replace('{!state!}', state));

      let iconSvgElement = this.svgIcon;
      iconSvgElement.innerHTML = `<use xlink:href="${ICON_URL_TPL.replace(ICON_URL_PLACEHOLDER, state)}"></use>`;

      this.spanAssistiveText.innerHTML = state;

      let iconContainer = this.iconContainer;
      iconContainer.classList.add(ICON_UTILITY_TPL.replace('{!state!}', state));
    }
}

customElements.define('slds-toast', SldsToast);