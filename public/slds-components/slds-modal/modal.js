import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class SLDSModal extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'headless', 'footless', 'open'];
  }

  constructor() {
    super();
    
    // Create shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // Default properties
    this._title = '';
    this._headless = false;
    this._footless = false;
    this._open = false;
    
    // Bind methods
    this._handleKeydown = this._handleKeydown.bind(this);
  }

  get title() { return this._title; }
  set title(value) { 
    this._title = value; 
    this.render();
  }

  get headless() { return this._headless; }
  set headless(value) { 
    this._headless = this.hasAttribute('headless'); 
    this.render();
  }

  get footless() { return this._footless; }
  set footless(value) { 
    this._footless = this.hasAttribute('footless'); 
    this.render();
  }

  get open() { return this._open; }
  set open(value) { 
    this._open = value;
    if (value) {
      this.setAttribute('open', '');
      this.style.display = 'block';
      document.body.style.overflow = 'hidden'; // Prevent body scroll
      this.focus();
    } else {
      this.removeAttribute('open');
      this.style.display = 'none';
      document.body.style.overflow = ''; // Restore body scroll
    }
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'title':
        this._title = newValue || '';
        break;
      case 'headless':
        this._headless = this.hasAttribute('headless');
        break;
      case 'footless':
        this._footless = this.hasAttribute('footless');
        break;
      case 'open':
        this._open = this.hasAttribute('open');
        break;
    }
    this.render();
  }

  connectedCallback() {
    this.render();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    
    // Set initial state
    this.style.display = this._open ? 'block' : 'none';
    
    // Add event listeners
    document.addEventListener('keydown', this._handleKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._handleKeydown);
    document.body.style.overflow = ''; // Restore body scroll
  }

  render() {
    const modalId = `modal-${Math.random().toString(36).substring(2, 11)}`;
    const modalClasses = `slds-modal${this._open ? ' slds-fade-in-open' : ''}`;
    const backdropClasses = `slds-backdrop${this._open ? ' slds-backdrop_open' : ''}`;
    
    this.shadowRoot.innerHTML = `
      <!-- Modal backdrop -->
      <div class="${backdropClasses}" data-backdrop="true"></div>
      
      <!-- Modal -->
      <section 
        class="${modalClasses}" 
        aria-labelledby="${modalId}-heading" 
        aria-modal="true" 
        role="dialog" 
        tabindex="-1"
      >
        <div class="slds-modal__container">
          
          <!-- Modal Header -->
          ${!this._headless ? `
            <header class="slds-modal__header">
              <button 
                class="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" 
                title="Close"
                data-action="close"
              >
                <svg class="slds-button__icon slds-button__icon_large" aria-hidden="true">
                  <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
                </svg>
                <span class="slds-assistive-text">Close</span>
              </button>
              <h2 id="${modalId}-heading" class="slds-modal__title slds-hyphenate">
                <slot name="headline">${this._title}</slot>
              </h2>
            </header>
          ` : ''}

          <!-- Modal Content -->
          <div class="slds-modal__content slds-p-around_medium${this._headless ? ' slds-modal__content_headless' : ''}${this._footless ? ' slds-modal__content_footless' : ''}">
            <slot></slot>
          </div>

          <!-- Modal Footer -->
          ${!this._footless ? `
            <footer class="slds-modal__footer">
              <button class="slds-button slds-button_neutral" data-action="close">Cancel</button>
              <button class="slds-button slds-button_brand" data-action="save">Save</button>
            </footer>
          ` : ''}

        </div>
      </section>
    `;

    // Add event listeners after rendering
    this.shadowRoot.addEventListener('click', (event) => {
      const action = event.target.dataset.action;
      const isBackdrop = event.target.dataset.backdrop;
      
      if (action === 'close') {
        this._handleClose();
      } else if (action === 'save') {
        this._handleSave();
      } else if (isBackdrop) {
        this._handleBackdropClick(event);
      }
    });
  }

  _handleClose() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', {
      detail: { 
        action: 'close'
      },
      bubbles: true
    }));
  }

  _handleSave() {
    this.dispatchEvent(new CustomEvent('save', {
      detail: { 
        action: 'save'
      },
      bubbles: true
    }));
  }

  _handleBackdropClick(event) {
    // Close modal when clicking on backdrop
    if (event.target.dataset.backdrop) {
      this._handleClose();
    }
  }

  _handleKeydown(event) {
    if (event.key === 'Escape' && this._open) {
      this._handleClose();
    }
  }

  show() {
    this.open = true;
    this.dispatchEvent(new CustomEvent('show', {
      detail: { 
        action: 'show'
      },
      bubbles: true
    }));
  }

  hide() {
    this._handleClose();
  }
}

// Define the custom element
customElements.define('slds-modal', SLDSModal);