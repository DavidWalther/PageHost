import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

class SLDSModal extends LitElement {
  static properties = {
    // Nicht `title`: das ist ein globales HTML-Attribut mit nativer Property —
    // die zu ueberschatten haengt dem Host zusaetzlich einen Browser-Tooltip an.
    heading: { type: String },
    headless: { type: Boolean, reflect: true },
    footless: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
  };

  constructor() {
    super();
    this.heading = '';
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

  render() {
    // Only render modal when open is true
    if (!this.open) {
      return html``;
    }

    return html`
      <section
        role="dialog"
        aria-labelledby="modal-heading"
        aria-modal="true"
        tabindex="-1"
        class="slds-modal slds-fade-in-open"
      >
        <!-- Modal Container -->
        <div class="slds-modal__container">
          <button
            class="slds-button slds-button_icon slds-modal__close"
            @click="${this.hide}"
          >
            <svg class="slds-button__icon slds-button__icon_large">
              <use
                href="/assets/icons/utility-sprite/svg/symbols.svg#close"
              ></use>
            </svg>
            <span class="slds-assistive-text">Cancel & Close</span>
          </button>

          <!-- Modal Header -->
          ${
            !this.headless
              ? html`
                  <div class="slds-modal__header">
                    <h1
                      id="modal-heading"
                      class="slds-modal__title slds-hyphenate"
                    >
                      <slot name="headline">${this.heading}</slot>
                    </h1>
                  </div>
                `
              : ''
          }

          <!-- Modal Body -->
          <div class="slds-modal__content slds-p-around_medium">
            <slot></slot>
          </div>

          <!-- Modal Footer -->
          ${
            !this.footless
              ? html`
                  <div class="slds-modal__footer">
                    <slot name="footer"></slot>
                  </div>
                `
              : ''
          }
        </div>
      </section>
      <!-- Modal Backdrop -->
      <div
        class="slds-backdrop slds-backdrop_open"
        @click="${this._handleBackdropClick}"
      ></div>
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
        // Erst merken, wohin der Fokus zurueck soll — _setFocus() verschiebt ihn.
        this._previousFocus = document.activeElement;
        this._setFocus();
        document.body.style.overflow = 'hidden'; // Prevent body scroll
      } else {
        document.body.style.overflow = ''; // Restore body scroll
        this._restoreFocus();
      }
    }
  }

  show() {
    this.open = true;
    this.dispatchEvent(
      new CustomEvent('open', {
        detail: { modal: this },
        bubbles: true,
      })
    );
  }

  hide() {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('close', {
        detail: { modal: this },
        bubbles: true,
      })
    );
  }

  toggle() {
    if (this.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  _handleBackdropClick(event) {
    // Close modal when backdrop is clicked
    if (event.target.classList.contains('slds-backdrop')) {
      this.hide();
    }
  }

  _handleKeyDown(event) {
    if (!this.open) return;

    if (event.key === 'Escape') {
      this.hide();
    } else if (event.key === 'Tab') {
      this._handleTabKey(event);
    }
  }

  // Fokussierbare Elemente in Tab-Reihenfolge: erst der Close-Button aus dem
  // ShadowDOM, dann der geslottete Inhalt aus dem Light DOM. Frueher wurde
  // ausschliesslich im ShadowDOM gesucht — dort steht aber nur ein <slot>, sodass
  // der Trap nie etwas fand und Tab aus dem Dialog herauslief.
  _focusableElements() {
    const nodes = [
      ...this.shadowRoot.querySelectorAll(FOCUSABLE_SELECTOR),
      ...this.querySelectorAll(FOCUSABLE_SELECTOR),
    ];
    return nodes.filter(
      (node) => !node.disabled && node.getAttribute('aria-hidden') !== 'true'
    );
  }

  // Bei Fokus im ShadowDOM meldet document.activeElement nur den Host.
  _activeElement() {
    return this.shadowRoot.activeElement ?? document.activeElement;
  }

  _setFocus() {
    const [firstFocusable] = this._focusableElements();
    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }
    // Kein fokussierbarer Inhalt -> auf den Dialog selbst (traegt tabindex="-1").
    const dialog = this.shadowRoot.querySelector('section.slds-modal');
    if (dialog) {
      dialog.focus();
    }
  }

  _restoreFocus() {
    // Restore focus to the element that opened the modal
    if (this._previousFocus) {
      this._previousFocus.focus();
      this._previousFocus = null;
    }
  }

  _handleTabKey(event) {
    const focusable = this._focusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const active = this._activeElement();

    if (event.shiftKey && active === firstElement) {
      lastElement.focus();
      event.preventDefault();
    } else if (!event.shiftKey && active === lastElement) {
      firstElement.focus();
      event.preventDefault();
    }
  }
}

// Define the custom element
customElements.define('slds-modal', SLDSModal);
