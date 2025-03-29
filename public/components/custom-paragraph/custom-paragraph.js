import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'components/custom-paragraph/custom-paragraph.html';
let templatePromise = null;
let loadedMarkup = null;

class CustomParagraph extends HTMLElement {
  
  static get observedAttributes() {
    return [
      'id',
      'editable'
    ];
  }
  
  attributeChangedCallback(attr, oldValue, newValue) {
    if (oldValue === newValue) { return;}
    let modifiedInput = null;

    switch (attr) {
      case 'id':
        this.fireQueryEvent_Paragraph(this.id, this.queryEventCallback_Paragraph.bind(this));
        break;
      case 'editable':

        break;
      default:
        break;
      }
      if (modifiedInput) {
        modifiedInput.value = newValue;
      }
  }

  // ----------------------------------------------
  // Lifecycle methods
  // ----------------------------------------------

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });

    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  async connectedCallback() {
    if (!loadedMarkup) {
      loadedMarkup = await this.loadHtmlMarkup();
    }

    // Append the main template
    const mainTemplateContent = loadedMarkup.querySelector('#template-main').content;
    this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));

    this.fireQueryEvent_Paragraph(this.id, this.queryEventCallback_Paragraph.bind(this));
  }

  // ----------------------------------------------
  // Component methods
  // ----------------------------------------------

  addEditableElements(nameValue, htmlContentValue, textContentValue) {
          // Initialize input fields with attribute values
      this.shadowRoot.getElementById('chapterId').value = this.getAttribute('chapterId') || '';
      this.shadowRoot.getElementById('htmlContent').value = htmlContentValue;
      this.shadowRoot.getElementById('id').value = this.getAttribute('id') || '';
      this.shadowRoot.getElementById('lastupdate').value = this.getAttribute('lastupdate') || '';
      this.shadowRoot.getElementById('name').value = nameValue;
      this.shadowRoot.getElementById('publishdate').value = this.getAttribute('publishdate') || '';
      this.shadowRoot.getElementById('sortnumber').value = this.getAttribute('sortnumber') || '';
      this.shadowRoot.getElementById('storyId').value = this.getAttribute('storyId') || '';

      this.shadowRoot.getElementById('datePublish').setAttribute('value', this.getAttribute('publishdate')?.split('T')[0] || '');
      this.shadowRoot.getElementById('textContent').setAttribute('value', textContentValue);

      this.connectEventListeners();// Add your code here to add editable elements
  }

  createNonEditableHtmlContentElement(name, htmlContent) {
    const contentElem = document.createElement('div');
    contentElem.innerHTML = htmlContent;
    return contentElem;
  }

  createNonEditableTextContentElement(name, textContent) {
    const textContentElem = document.createElement('p');

    let textContentLines = [];
    if(name) {
      textContentLines.push(`<b>${name}</b>`);
    }
    textContent.split('\n').forEach((line) => {;
      textContentLines.push(line);
    });
    textContentElem.innerHTML = textContentLines.join('<br>');
    return textContentElem;
  }

  connectEventListeners() {
    this.shadowRoot.querySelector('#button-save').addEventListener('click', this.handleClickSave.bind(this));

    const inputElements = this.shadowRoot.querySelectorAll('slds-input');
    inputElements.forEach((inputElement) => {
      inputElement.addEventListener('change', this.handleInputChange.bind(this));
    });
  }

  createOutput(paragraphData) {
    let htmlContentValue = paragraphData.htmlcontent || '';
    if (!htmlContentValue || ['false', '0', 'null', 'undefined', 'NaN'].includes(htmlContentValue.toLowerCase())) {
      htmlContentValue = null;
    }

    const textContentValue = paragraphData.content || '';
    const nameValue = paragraphData.name || '';

    let displayOption = '';
    displayOption += htmlContentValue == null ? 'text' : 'html';
    displayOption += '-';
    displayOption += this.getIsEditable() ? 'editable' : 'readonly';

    switch (displayOption) {
      case 'text-readonly': {
        this.replaceSlotWithTemplate('placeholder-content', '#template-non-editable');
        const nonEditContentDiv = this.shadowRoot.getElementById('content');
        nonEditContentDiv.appendChild(this.createNonEditableTextContentElement(nameValue, textContentValue));
        
        this.hideSpinner();
        break;
      }
      case 'html-readonly': {
        this.replaceSlotWithTemplate('placeholder-content', '#template-non-editable');
        const nonEditContentDiv = this.shadowRoot.getElementById('content');
        let  htmlContentElem = this.createNonEditableHtmlContentElement(nameValue, htmlContentValue);
        nonEditContentDiv.appendChild(htmlContentElem);
        
        this.hideSpinner();
        break;
      }
      default: {
        break;
      }
    }
  }

  //--------------------
  // markup modifiers
  //--------------------

  async loadHtmlMarkup() {
    if (!templatePromise) {
      templatePromise = fetch(templatePath)
        .then((response) => response.text())
        .then((html) => {
          return new DOMParser().parseFromString(html, 'text/html');
        });
    }
    return templatePromise;
  }

  handleClickSave() {
    console.log('click save');
    this.buttonSave_disable();
  }

  handleInputChange(event) {
    const eventDetail = {
      id: event.target.id,
      type: event.target.getAttribute('type'),
      value: event.detail.value,
    };
    console.log(eventDetail);

    const eventChange = new CustomEvent('change', {
      bubbles: true,
      detail: eventDetail
    });
  }

  buttonSave_enable() {
    this.shadowRoot.querySelector('#button-save').setAttribute('disabled', false);
  };

  buttonSave_disable() {
    this.shadowRoot.querySelector('#button-save').setAttribute('disabled', true);
  };

  replaceSlotWithTemplate(slotId, templateId) {
    const slot = this.shadowRoot.querySelector(`slot[name=${slotId}]`);
    if (loadedMarkup && slot) {
      const templateContent = loadedMarkup.querySelector(templateId).content;
      const parentNode = slot.parentNode;
      parentNode.replaceChild(templateContent.cloneNode(true), slot);
    }
  }

  getIsEditable() {
    return this.getAttribute('editable') != null;
  }

  showSpinner() {
    if (!this.spinner) { return; }
    this.spinner.removeAttribute('hidden');
  }

  hideSpinner() {
    if (!this.spinner) { return; }
    this.spinner.setAttribute('hidden', '');
  }

  // ----------------------------------------------
  // properties for attributes
  // ----------------------------------------------

  get id() {
    return this.getAttribute('id');
  }

  get name() {
    return this.getAttribute('name');
  }

  // ----------------------------------------------
  // Element getter
  // ----------------------------------------------

  get spinner () {
    return this.shadowRoot.querySelector('slds-spinner');
  }

  // ------------------------------------------
  // Query Event methods
  // ------------------------------------------

  // --------- Fire Query Event methods ---------

 fireQueryEvent_Paragraph(paragraphid, callback) {
    if(!paragraphid) {return;}
    let payload = {
        object: 'paragraph',
        id: paragraphid
    }

    this.showSpinner();
    this.dispatchEvent(new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true
    }));
  } 

  // --------- Query Event Callback methods ---------

  queryEventCallback_Paragraph(error, data) {
    if(error) {
      console.error(error);
      return;
    }
    if(data) {
      this.createOutput(data);
    }
  }
}

customElements.define('custom-paragraph', CustomParagraph);
