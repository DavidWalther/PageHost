import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'slds-components/slds-combobox/slds-combobox.html';
let templatePromise = null; // this variable makes sure only the first load results in an actual fetch
let loadedMarkUp = null;

class Combobox extends HTMLElement {

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });  // Attach a shadow root

    this.applyGlobalStyles();
  }

  applyGlobalStyles() {
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

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

  // ------------------ Lifecycle Callbacks ------------------

  async connectedCallback() {
    if (!loadedMarkUp) {
      loadedMarkUp = await this.loadHtmlMarkup();
    }

    // Append the main template
    const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    this.shadowRoot.querySelector('.slds-combobox').addEventListener('click', this.handleComboboxClick.bind(this));
    this.inputElem.addEventListener('blur', this.handleComboboxBlur.bind(this));
    this.inputElem.addEventListener('keyup', this.handleInputKeyUp.bind(this));

    this.setInputDisabled(this.disabled);
    this.createComboboxEntries(this.options);
    this.setSelectedValue(this.value);
    this.setComboboxLabel(this.label);
    this.setComboboxPlaceholder(this.placeholder);
    this.setEditable(this.filterable);
  }

  // ------------------ React on attribute changes ------------------

  static get observedAttributes() {
    return [
      'label', 'placeholder',
      'options', // JSON array string [{value, label, title}]
      'value',
      'disabled',
      'filterable'
    ];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if(oldValue === newValue) { return; }

    switch(name) {
      case 'label': {
        this.setComboboxLabel(newValue);
        break;
      }
      case 'placeholder': {
        this.setComboboxPlaceholder(newValue);
        break;
      }
      case 'options': {
        this.clearComboboxEntries();
        this.createComboboxEntries(this.options);
        break;
      }
      case 'value': {
        this.setSelectedValue(newValue);
        break;
      }
      case 'disabled': {
        this.setInputDisabled(newValue);
        break;
      }
      case 'filterable': {
        this.setEditable(newValue);
        break;
      }
    }
  }

  // ------------------ Getters and Setters ------------------

  get value() {
    return this.getAttribute('value');
  }

  get options() {
    return JSON.parse(this.getAttribute('options'));
  }

  get label() {
    return this.getAttribute('label');
  }

  get placeholder() {
    return this.getAttribute('placeholder');
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  get filterable() {
    let truthyValus = [true, '' ];
    let filterableAttribute = this.getAttribute('filterable');
    let filterable = new Set(truthyValus).has(filterableAttribute);

    return filterable;
  }

  // ------------------ Element getters ------------------

  get inputElem() {
    return this.shadowRoot.querySelector('input');
  }
  get dropdownTriggerElem() {
    return this.shadowRoot.querySelector('.slds-dropdown-trigger');
  }

  get labelElem() {
    return this.shadowRoot.querySelector('label.slds-form-element__label');
  }

  // ------------------ Event handlers ------------------

  handleComboboxClick(event) {
    this.toggleDropdown();
  }

  handleComboboxBlur(event) {
    // if elements are hidden right away the click event on the dropdown is not handled
    setTimeout(() => {
      this.closeDropdown();
    }, 50);
  }

  handleInputKeyUp(event) {
    let enteredValue = event.target.value;

    this.filterOptions(enteredValue);
  }

  // ------------------ Actions ------------------

  setEditable(editable ) {
    if (editable === undefined) { return; }

    let inputElem = this.inputElem;
    if(!inputElem) { return; }
    if(editable) {
      inputElem.removeAttribute('readonly');
    } else {
      inputElem.setAttribute('readonly', '');
    }
  }

  filterOptions(enteredValue) {
    if(!this.filterable ) { return; }
    let filteredOptions = this.options.filter((entry) => {
      return entry.label.toLowerCase().includes(enteredValue.toLowerCase());
    });

    this.clearComboboxEntries();
    this.createComboboxEntries(filteredOptions);
  }

  setInputDisabled(disabled) {
    if (!this.inputElem) { return; }
    this.inputElem.disabled = disabled;
  }

  setSelectedValue(value) {
    this.setInputLabel(value);
    this.markSelectedItem(value);
  }

  setComboboxLabel(label) {
    if (!this.labelElem) { return; }
    this.labelElem.textContent = label;
  }

  setComboboxPlaceholder(placeholder) {
    if (!this.inputElem) { return; }
    let placeholderValue = !placeholder ? '' : placeholder;
    this.inputElem.setAttribute('placeholder', placeholderValue);
  }

  setInputLabel(selectedValue) {
    if (!this.inputElem) { return; }
    if (!this.options) { return; }
    if(!selectedValue) { return; }
    let selectedEntry = this.options.find((entry) => entry.value === selectedValue);
    this.inputElem.value = !selectedEntry ? null : selectedEntry.label;
  }

  toggleDropdown() {
    this.dropdownTriggerElem.classList.toggle('slds-is-open');
  }

  openDropdown() {
    this.dropdownTriggerElem.classList.add('slds-is-open');
  }

  closeDropdown() {
    this.dropdownTriggerElem.classList.remove('slds-is-open');
  }

  fireSelectEvent(selectedValue, options) {
    let eventDetail = { value: selectedValue};
    let composed = options && options.composed;
    let bubbles = options && options.bubbles;

    const event = new CustomEvent('select', { detail: eventDetail, composed: composed, bubbles: bubbles});

    this.dispatchEvent(event);
  }

  // ------------------ Helper methods ------------------

  /**
   * Description:
   * Mark the selected item in the dropdown list und deselects all other items
   */
  markSelectedItem(selectedValue) {
    const ulElem = this.shadowRoot.querySelector('ul.slds-listbox');
    if (!ulElem) { return; }

    this.unmarkAllItems();

    const liElems = ulElem.querySelectorAll('li');
    //find seleczted item and mark it
    liElems.forEach((liElem) => {
      if (liElem.querySelector('div').dataset.value === selectedValue) {
        this.markItem(liElem);
      }
    });
  }

   /**
   * Description:
   * removes the hightlightning of all items
   * loops over all list items and
   * - removes the 'slds-is-selected' class
   * - removes the template-selected-icon in li > div > span.slds-listbox__option-icon
   */
  unmarkAllItems() {
    const ulElem = this.shadowRoot.querySelector('ul.slds-listbox');
    if (!ulElem) { return; }

    const liElems = ulElem.querySelectorAll('li');
    liElems.forEach((liElem) => {
      this.unmarkItem(liElem);
    });
  }

  unmarkItem(liElem) {
    const innerDivElem = liElem.querySelector('div');
    innerDivElem.classList.remove('slds-is-selected');
    innerDivElem.classList.remove('slds-has-focus');
    innerDivElem.removeAttribute('aria-selected');
    innerDivElem.removeAttribute('aria-checked');
    const iconSpan = innerDivElem.querySelector('span.slds-listbox__option-icon');
    iconSpan.innerHTML = '';
  }

  /**
   * Description:
   * marks an entry as selected
   * - adds the 'slds-is-selected' class
   * - adds the template-selected-icon in li > div > span.slds-listbox__option-icon
   */
  markItem(liElem) {
    const innerDivElem = liElem.querySelector('div');
    innerDivElem.classList.add('slds-is-selected');
    innerDivElem.classList.add('slds-has-focus');
    innerDivElem.setAttribute('aria-selected', 'true');
    innerDivElem.setAttribute('aria-checked', 'true');
    //selet template 'template-selected-icon'
    const iconTemplate = loadedMarkUp.querySelector('#template-selected-icon');
    const iconContent = iconTemplate.content.cloneNode(true);
    const iconSpan = innerDivElem.querySelector('span.slds-listbox__option-icon');
    iconSpan.appendChild(iconContent);
  }

  /**
   * Description:
   * clears the list entries for the combobox dropdown
   */
  clearComboboxEntries() {
    const ulElem = this.shadowRoot.querySelector('ul.slds-listbox');
    if (!ulElem) { return; }
    while (ulElem.firstChild) {
      ulElem.removeChild(ulElem.firstChild);
    }
  }

  /**
   * Description:
   * Create the list entries for the combobox dropdown
   */
  createComboboxEntries(options) {
    const ulElem = this.shadowRoot.querySelector('ul.slds-listbox');
    if (!ulElem) { return; }
    options.forEach((valueEntry) => {
      const content = this.createComboboxEntry(valueEntry);
      ulElem.appendChild(content);
    });
  }

  /**
   * Description:
   * creates a list entry for the combobox dropdown
   */
  createComboboxEntry(valueEntry) {
    const templateContent = loadedMarkUp.querySelector('#template-list-item').content;
    const content = templateContent.cloneNode(true);
    const divElem = content.querySelector('div');
    divElem.id = valueEntry.value;
    divElem.dataset.value = valueEntry.value;
    const spanElem = content.querySelector('span.slds-media__body');
    spanElem.textContent = valueEntry.label;
    spanElem.title = valueEntry.title;
    spanElem.style.color = 'var(--custom-combobox-option-color)';

    let liElement = content.querySelector('li');
    liElement.addEventListener('click', event => {
      event.stopPropagation();
      const value = event.currentTarget.querySelector('div').dataset.value;
      this.inputElem.setAttribute('aria-activedescendant', value);
      this.setInputLabel(value);
      this.markSelectedItem(value);
      this.fireSelectEvent(value);
    });
    return content;
  }
}

customElements.define('slds-combobox', Combobox);
