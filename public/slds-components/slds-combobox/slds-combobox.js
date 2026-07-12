import {
  LitElement,
  html,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

const SPRITE = '/assets/icons/utility-sprite/svg/symbols.svg';
const OPTION_CLASSES =
  'slds-media slds-listbox__option slds-listbox__option_plain slds-media_small';
// Das Dropdown schließt verzögert, damit ein Klick auf eine Option noch
// verarbeitet wird, bevor die Liste verschwindet.
const BLUR_CLOSE_DELAY_MS = 50;

class Combobox extends LitElement {
  static properties = {
    label: { type: String },
    placeholder: { type: String },
    options: { type: Array }, // JSON-Array-String [{ value, label, title }]
    value: { type: String },
    disabled: { type: Boolean },
    filterable: { type: Boolean },

    _open: { state: true },
    // Die Legacy schreibt bei einem Options-Klick nicht in `value` zurück,
    // sondern markiert nur — daher ein eigener State neben der Property.
    _selectedValue: { state: true },
    _inputText: { state: true },
    // Nur bei keyup gesetzt: ein Options-Klick lässt den Filter stehen, ein
    // options-Wechsel setzt ihn zurück.
    _filterText: { state: true },
    // Setzt die Legacy ausschließlich beim Options-Klick.
    _activeDescendant: { state: true },
  };

  constructor() {
    super();
    this._open = false;
    this._inputText = '';
    this._filterText = '';
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  willUpdate(changedProperties) {
    if (changedProperties.has('options')) {
      this._filterText = '';
    }
    if (changedProperties.has('value')) {
      this._selectedValue = this.value;
      this._inputText = this.labelForValue(this.value) ?? this._inputText;
    }
  }

  // ------------------ Derived state ------------------

  // Entspricht setInputLabel: ohne Optionen oder ohne Wert bleibt der
  // Input-Text unangetastet; ein Wert ohne passende Option leert ihn.
  labelForValue(selectedValue) {
    if (!this.options || !selectedValue) {
      return undefined;
    }
    const entry = this.options.find((option) => option.value === selectedValue);
    return entry ? entry.label : '';
  }

  get displayedOptions() {
    const options = this.options ?? [];
    if (!this.filterable) {
      return options;
    }
    const filter = this._filterText.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(filter)
    );
  }

  // ------------------ Actions ------------------

  toggleDropdown() {
    this._open = !this._open;
  }

  openDropdown() {
    this._open = true;
  }

  closeDropdown() {
    this._open = false;
  }

  fireSelectEvent(selectedValue) {
    // Qualifizierter Name statt `select`: das ist der native Event-Name der
    // Text-Selektion in <input>/<textarea>. Ein gleichnamiges CustomEvent waere
    // fuer einen Listener am Host nicht davon zu unterscheiden.
    this.dispatchEvent(
      new CustomEvent('combobox-select', {
        detail: { value: selectedValue },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ------------------ Event handlers ------------------

  handleComboboxClick() {
    this.toggleDropdown();
  }

  handleComboboxBlur() {
    setTimeout(() => {
      this.closeDropdown();
    }, BLUR_CLOSE_DELAY_MS);
  }

  handleInputKeyUp(event) {
    const enteredValue = event.target.value;
    this._inputText = enteredValue;
    this._filterText = enteredValue;
  }

  handleOptionClick(event, option) {
    event.stopPropagation();
    this._activeDescendant = option.value;
    this._selectedValue = option.value;
    this._inputText = this.labelForValue(option.value) ?? this._inputText;
    this.fireSelectEvent(option.value);
  }

  // ------------------ Rendering ------------------

  render() {
    const comboboxClasses = [
      'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click',
      this._open ? 'slds-is-open' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div class="slds-form-element">
        <label class="slds-form-element__label" for="combobox-id"
          >${this.label ?? ''}</label
        >
        <div class="slds-form-element__control">
          <div class="slds-combobox_container">
            <div
              class="${comboboxClasses}"
              aria-expanded="${this._open ? 'true' : 'false'}"
              aria-haspopup="listbox"
              role="combobox"
              @click=${() => this.handleComboboxClick()}
            >
              <div
                class="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right"
                role="none"
              >
                <input
                  type="text"
                  class="slds-input slds-combobox__input"
                  id="combobox-id"
                  aria-controls="listbox-id"
                  autocomplete="off"
                  role="textbox"
                  placeholder="${this.placeholder ?? ''}"
                  aria-activedescendant="${this._activeDescendant ?? nothing}"
                  ?readonly=${!this.filterable}
                  ?disabled=${this.disabled}
                  .value=${this._inputText}
                  @blur=${() => this.handleComboboxBlur()}
                  @keyup=${(event) => this.handleInputKeyUp(event)}
                />
                <span
                  class="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
                >
                  <svg
                    class="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
                    aria-hidden="true"
                  >
                    <use href="${SPRITE}#down"></use>
                  </svg>
                </span>
              </div>
              <div
                id="listbox-id"
                class="slds-dropdown slds-dropdown_length-5 slds-dropdown_fluid"
                role="listbox"
              >
                <ul
                  class="slds-listbox slds-listbox_vertical"
                  role="presentation"
                >
                  ${this.displayedOptions.map((option) =>
                    this.renderOption(option)
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderOption(option) {
    const isSelected = option.value === this._selectedValue;
    const optionClasses = [
      OPTION_CLASSES,
      isSelected ? 'slds-is-selected slds-has-focus' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <li
        role="presentation"
        class="slds-listbox__item"
        @click=${(event) => this.handleOptionClick(event, option)}
      >
        <div
          class="${optionClasses}"
          role="option"
          id="${option.value}"
          data-value="${option.value}"
          aria-selected="${isSelected ? 'true' : nothing}"
          aria-checked="${isSelected ? 'true' : nothing}"
        >
          <span class="slds-media__figure slds-listbox__option-icon">
            ${isSelected ? this.renderSelectedIcon() : nothing}
          </span>
          <span
            class="slds-media__body"
            style="color: var(--custom-combobox-option-color);"
          >
            <span class="slds-truncate" title="${option.title}"
              >${option.label}</span
            >
          </span>
        </div>
      </li>
    `;
  }

  renderSelectedIcon() {
    return html`
      <span
        class="slds-icon_container slds-icon-utility-check slds-current-color"
      >
        <svg class="slds-icon slds-icon_x-small" aria-hidden="true">
          <use href="${SPRITE}#check"></use>
        </svg>
      </span>
    `;
  }
}

customElements.define('slds-combobox', Combobox);
