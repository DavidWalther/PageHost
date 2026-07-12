import {
  LitElement,
  html,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

// Gemeinsames Control-Markup aller Typen. `placeholder`/`min` werden weggelassen,
// wenn sie nicht gesetzt sind (`nothing`), statt als leere Attribute zu landen.
const renderControl = (
  type,
  { inputId, value, onChange, placeholder, required, min }
) => html`
  <div class="slds-form-element__control">
    <input
      type=${type}
      id=${inputId}
      class="slds-input input-element"
      .value=${value ?? ''}
      placeholder=${placeholder ?? nothing}
      min=${min ?? nothing}
      ?required=${required}
      @change=${onChange}
    />
  </div>
`;

// Strategy-Registry für die Control-Varianten je `type`. Jede Strategie kennt die
// `id` ihres Controls (das Label bindet sein `for` daran) und liefert das Markup.
// Ein neuer Typ = ein neuer Eintrag (Open/Closed) — keine switch-Kaskade.
const inputTypeStrategies = {
  date: {
    inputId: 'input-date',
    render: (context) => renderControl('date', context),
  },
  number: {
    inputId: 'input-number',
    render: (context) => renderControl('number', context),
  },
  text: {
    inputId: 'input-text',
    render: (context) => renderControl('text', context),
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
    placeholder: { type: String },
    required: { type: Boolean },
    min: { type: String },
  };

  constructor() {
    super();
    this.required = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  render() {
    const strategy = resolveInputTypeStrategy(this.type);
    const control = strategy.render({
      inputId: strategy.inputId,
      value: this.value,
      placeholder: this.placeholder,
      required: this.required,
      min: this.min,
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
