import {
  LitElement,
  html,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

// Strategy-Registry für die Control-Varianten je `type`. Jede Strategie liefert
// das Markup des Form-Controls (gleiche Schnittstelle: render({ value, onChange })).
// Ein neuer Typ = ein neuer Eintrag (Open/Closed) — keine switch-Kaskade.
// Jede Strategie kennt die `id` ihres Controls; das Label bindet sein `for` daran.
const inputTypeStrategies = {
  date: {
    inputId: 'input-date',
    render: ({ inputId, value, onChange }) => html`
      <div class="slds-form-element__control">
        <input
          type="date"
          id=${inputId}
          class="slds-input input-element"
          .value=${value ?? ''}
          @change=${onChange}
        />
      </div>
    `,
  },
  text: {
    inputId: 'input-text',
    render: ({ inputId, value, onChange }) => html`
      <div class="slds-form-element__control">
        <input
          type="text"
          id=${inputId}
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
    const strategy = resolveInputTypeStrategy(this.type);
    const control = strategy.render({
      inputId: strategy.inputId,
      value: this.value,
      onChange: (event) => this.handleChangeInput(event),
    });

    return html`
      <div class="slds-form-element">
        <label class="slds-form-element__label" for=${strategy.inputId}
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
