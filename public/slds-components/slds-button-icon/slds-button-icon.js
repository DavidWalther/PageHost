import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = '/slds-components/slds-button-icon/slds-button-icon.html';
let templatePromise = null;
let loadedMarkup = null;

class SLDSButtonIcon extends HTMLElement {
  constructor() {
    super();
    const shadowRoot =  this.attachShadow({ mode: 'open' });

    this.loadHtmlMarkup();
    this.applyGlobalStyles();
  }

  applyGlobalStyles() {
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  static get observedAttributes() {
    return ['icon', 'disabled', 'no-border', 'size', 'variant'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'icon':
        this.updateIcon(newValue);
        break;
      case 'disabled':
        this.updateDisabled(newValue);
        break;
      case 'size':
        this.updateSize(newValue);
        break;
      case 'variant':
        this.updateVariant(newValue);
        break;
    }
  }
  
  connectedCallback() {
  }

  disconnectedCallback() {
  }

  async loadHtmlMarkup() {
    if (!loadedMarkup) {
      loadedMarkup = await fetch(templatePath)
        .then(response => response.text())
        .then(html => new DOMParser().parseFromString(html, 'text/html'));
    }

    const templateContent = loadedMarkup.querySelector('#template-main').content;
    this.shadowRoot.appendChild(templateContent.cloneNode(true));

    // Initialize attributes
    this.updateIcon(this.getAttribute('icon'));
    this.updateDisabled(this.getAttribute('disabled'));
    this.updateSize(this.getAttribute('size'));
    this.updateVariant(this.getAttribute('variant') === null ? 'container-filled' : this.getAttribute('variant'));
  }

  updateIcon(iconValue) {
    if (!iconValue) return;
    const [type, name] = iconValue.split(':');
    
    const useElement = this.shadowRoot.querySelector('use');
    if (!useElement) return;
    
    useElement.setAttribute('xlink:href', `/assets/icons/${type}-sprite/svg/symbols.svg#${name}`);
    const spanElement = this.shadowRoot.querySelector('.slds-assistive-text');
    spanElement.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  }

  updateDisabled(isDisabled) {
    const buttonElement = this.shadowRoot.querySelector('button');
    if (!buttonElement) return;

    if (isDisabled !== null) {
      buttonElement.setAttribute('disabled', '');
    } else {
      buttonElement.removeAttribute('disabled');
    }
  }

  updateSize(sizeValue) {
    const buttonElement = this.shadowRoot.querySelector('button');
    if (!buttonElement) return;
    const sizes = ['large', 'small', 'x-small', 'xx-small'];

    // Remove all size classes
    sizes.forEach(size => buttonElement.classList.remove(`slds-button_icon-${size}`));

    // Add the new size class if it's valid
    if (sizes.includes(sizeValue)) {
      buttonElement.classList.add(`slds-button_icon-${sizeValue}`);
    }
  }

  updateVariant(variantValue) {
    const buttonElement = this.shadowRoot.querySelector('button');
    if (!buttonElement) return;
    const variants = {
      'icon-only': 'slds-button_icon-container',
      'container-transparent': 'slds-button_icon-border',
      'container-filled': 'slds-button_icon-border-filled'
    };

    // Remove all variant classes
    Object.values(variants).forEach(variantClass => buttonElement.classList.remove(variantClass));

    // Add the new variant class if it's valid
    if (variants[variantValue]) {
      buttonElement.classList.add(variants[variantValue]);
    }
  }
}

customElements.define('slds-button-icon', SLDSButtonIcon);
