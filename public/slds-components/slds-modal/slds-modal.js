import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class SLDSModal extends LitElement {
  static properties = {
    title: { type: String },
    headless: { type: Boolean, reflect: true },
    footless: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true }
  };

  constructor() {
    super();
    this.title = '';
    this.headless = false;
    this.footless = false;
    this.open = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    
    // Handle ESC key to close modal
    this._handleKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._handleKeyDown);
  }

  static get styles() {
    return css`
      :host {
        --slds-modal-z-index: 9001;
        --slds-backdrop-z-index: 9000;
      }

      .slds-backdrop {
        z-index: var(--slds-backdrop-z-index);
      }

      .slds-modal__container {
        z-index: var(--slds-modal-z-index);
      }

      /* Hide modal when not open */
      :host(:not([open])) .slds-backdrop,
      :host(:not([open])) .slds-modal__container {
        display: none;
      }

      /* Show modal when open */
      :host([open]) .slds-backdrop {
        display: block;
      }

      :host([open]) .slds-modal__container {
        display: flex;
      }

      /* Custom styles for headless and footless variants */
      :host([headless]) .slds-modal__header {
        display: none;
      }

      :host([footless]) .slds-modal__footer {
        display: none;
      }

      /* Ensure proper focus management */
      .slds-modal__content:focus {
        outline: none;
      }
    `;
  }

  render() {
    return html`
      <!-- Modal Backdrop -->
      <div class="slds-backdrop slds-backdrop_open" @click="${this._handleBackdropClick}"></div>
      
      <!-- Modal Container -->
      <div class="slds-modal__container">
        <div class="slds-modal__content slds-modal__content_medium" 
             role="dialog" 
             aria-labelledby="modal-heading" 
             aria-modal="true"
             tabindex="-1">
          
              <button class="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" 
                      title="Close" 
                      @click="${this.close}">
                <svg class="slds-button__icon slds-button__icon_large" aria-hidden="true">
                  <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
                </svg>
                <span class="slds-assistive-text">Close</span>

              </button>
          <!-- Modal Header -->
          ${!this.headless ? html`
            <div class="slds-modal__header">
              <h1 id="modal-heading" class="slds-modal__title slds-hyphenate">
                <slot name="headline">${this.title}</slot>
              </h1>
            </div>
          ` : ''}
          
          <!-- Modal Body -->
          <div class="slds-modal__body slds-p-around_medium">
            <slot></slot>
          </div>
          
          <!-- Modal Footer -->
          ${!this.footless ? html`
            <div class="slds-modal__footer">
              <slot name="footer">
                <button class="slds-button slds-button_neutral" @click="${this.close}">
                  Cancel
                </button>
                <button class="slds-button slds-button_brand">
                  Save
                </button>
              </slot>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  firstUpdated() {
    // Set focus management
    if (this.open) {
      this._setFocus();
    }
  }

  updated(changedProperties) {
    if (changedProperties.has('open')) {
      if (this.open) {
        this._setFocus();
        document.body.style.overflow = 'hidden'; // Prevent body scroll
        this._trapFocus();
      } else {
        document.body.style.overflow = ''; // Restore body scroll
        this._restoreFocus();
      }
    }
  }

  open() {
    this.open = true;
    this.dispatchEvent(new CustomEvent('modal-open', {
      detail: { modal: this },
      bubbles: true
    }));
  }

  close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('modal-close', {
      detail: { modal: this },
      bubbles: true
    }));
  }

  toggle() {
    if (this.open) {
      this.close();
    } else {
      this.open();
    }
  }

  _handleBackdropClick(event) {
    // Close modal when backdrop is clicked
    if (event.target.classList.contains('slds-backdrop')) {
      this.close();
    }
  }

  _handleKeyDown(event) {
    if (!this.open) return;
    
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'Tab') {
      this._handleTabKey(event);
    }
  }

  _setFocus() {
    // Focus on the modal content
    const modalContent = this.shadowRoot.querySelector('.slds-modal__content');
    if (modalContent) {
      modalContent.focus();
    }
  }

  _restoreFocus() {
    // Restore focus to the element that opened the modal
    if (this._previousFocus) {
      this._previousFocus.focus();
      this._previousFocus = null;
    }
  }

  _trapFocus() {
    // Store the currently focused element
    this._previousFocus = document.activeElement;
  }

  _handleTabKey(event) {
    // Basic tab trapping - can be enhanced for better accessibility
    const modal = this.shadowRoot.querySelector('.slds-modal__content');
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }
}

// Define the custom element
customElements.define('slds-modal', SLDSModal);
