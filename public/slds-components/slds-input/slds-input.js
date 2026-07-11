import {
  LitElement,
  html,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

// Strategy-Registry für die Control-Varianten je `type`. Jede Strategie liefert
// das Markup des Form-Controls (gleiche Schnittstelle: render({ value, onChange })).
// Ein neuer Typ = ein neuer Eintrag (Open/Closed) — keine switch-Kaskade.
const inputTypeStrategies = {
  date: {
    render: ({ value, onChange }) => html`
      <div class="slds-form-element__control">
        <input
          type="date"
          id="input-date"
          class="slds-input input-element"
          .value=${value ?? ''}
          @change=${onChange}
        />
      </div>
    `,
  },
  text: {
    render: ({ value, onChange }) => html`
      <div class="slds-form-element__control">
        <input
          type="text"
          id="input-text"
          class="slds-input input-element"
          .value=${value ?? ''}
          @change=${onChange}
        />
      </div>
    `,
  },
};

// Unbekannter/fehlender Typ -> text-Fallback (entspricht dem Legacy-default-Zweig).
const resolveInputTypeStrategy = (type) =>
  inputTypeStrategies[type] ?? inputTypeStrategies.text;

class SldsInput extends LitElement {
  static properties = {
    value: { type: String },
    label: { type: String },
    type: { type: String },
  };

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    const control = resolveInputTypeStrategy(this.type).render({
      value: this.value,
      onChange: (event) => this.handleChangeInput(event),
    });

    return html`
      <div class="slds-form-element">
        <label class="slds-form-element__label" for="input-sample1"
          >${this.label ?? ''}</label
        >
        ${control}
      </div>
    `;
  }

  handleChangeInput(event) {
    event.stopPropagation();
    event.preventDefault();
    const eventChange = new CustomEvent('change', {
      bubbles: true,
      detail: {
        type: event.target.type,
        value: event.target.value,
      },
    });
    this.dispatchEvent(eventChange);
  }
}

customElements.define('slds-input', SldsInput);
