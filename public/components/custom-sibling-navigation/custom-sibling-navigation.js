import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

/**
 * Previous / next at the end of the contents: the siblings of the shown node.
 *
 * Knows no tree — the host passes both neighbours as `{ id, name }` (or
 * `null`) and listens for `sibling-select`. A missing neighbour has no button;
 * without neighbours nothing is rendered.
 */
class CustomSiblingNavigation extends LitElement {
  static properties = {
    previous: { attribute: false },
    next: { attribute: false },
  };

  static styles = css`
    .sibling-navigation {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }

    /* Next stays on the right even when there is no previous. */
    .sibling-navigation__next {
      margin-left: auto;
    }
  `;

  constructor() {
    super();
    this.previous = null;
    this.next = null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    if (!this.previous && !this.next) {
      return html``;
    }
    return html`
      <nav class="sibling-navigation slds-m-around_small">
        ${
          this.previous
            ? html`<button
                class="slds-button slds-button_neutral"
                data-direction="previous"
                @click=${() => this._select(this.previous)}
              >
                ‹ ${this.previous.name}
              </button>`
            : ''
        }
        ${
          this.next
            ? html`<button
                class="slds-button slds-button_neutral sibling-navigation__next"
                data-direction="next"
                @click=${() => this._select(this.next)}
              >
                ${this.next.name} ›
              </button>`
            : ''
        }
      </nav>
    `;
  }

  _select(sibling) {
    this.dispatchEvent(
      new CustomEvent('sibling-select', {
        detail: { id: sibling.id },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-sibling-navigation', CustomSiblingNavigation);
