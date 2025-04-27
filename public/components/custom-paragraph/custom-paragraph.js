import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class CustomParagraph extends LitElement {
  static properties = {
    id: { type: String },
  };

  static styles = css`
    /* Add SLDS styling for your component here */
    #content {
      position: relative;
    }

    #content button {
      display: none;
    }

    #content:hover {
      border-radius: 5px;
      bolder-width: 1px;
      border-style: solid;
      border-color:#abafb8;
      padding: 3px;
    }

    #content:hover button {
      display: block;
    }
  `;

  constructor() {
    super();
    this.id = '';
    this._paragraphData = null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this.fireQueryEvent_Paragraph(this.id, this.queryEventCallback_Paragraph.bind(this));
  }

  render() {
    if (!this._paragraphData) {
      return html`<slds-spinner size="x-small" ?hidden=${!this.spinner}></slds-spinner>`;
    }

    const { name, htmlcontent, content, editable } = this._paragraphData;
    const displayOption = `${htmlcontent ? 'html' : 'text'}-${editable ? 'editable' : 'readonly'}`;

    switch (displayOption) {
      case 'text-readonly':
        return this.renderTextReadonly(name, content);
      case 'html-readonly':
        return this.renderHtmlReadonly(htmlcontent);
      case 'text-editable':
      case 'html-editable':
        return this.renderEditable(name, htmlcontent, content);
      default:
        return html``;
    }
  }

  renderTextReadonly(name, content) {
    return html`
      <div id="content">
        <p>
          ${name ? html`<b>${name}</b><br>` : ''}
          ${content.split('\n').map((line) => html`${line}<br>`)}
        </p>
        <button  @click=${this.handleClickSave}>Action</button>
      </div>
    `;
  }

  renderHtmlReadonly(htmlcontent) {
    return html`
      <div id="content">
        <div .innerHTML=${htmlcontent}></div>
        <button  @click=${this.handleClickSave}>Action</button>
      </div>
    `;
  }

  renderEditable(name, htmlcontent, content) {
    return html`
      <slds-card no-footer no-header>
        <div class="slds-grid slds-wrap">
          <div class="slds-col slds-size_1-of-3">
            <label for="name">Name</label>
            <input type="text" id="name" .value=${name || ''} @input=${this.handleInputChange} />
          </div>
          <div class="slds-col slds-size_1-of-3">
            <label for="htmlContent">HTML Content</label>
            <textarea id="htmlContent" .value=${htmlcontent || ''} @input=${this.handleInputChange}></textarea>
          </div>
          <div class="slds-col slds-size_1-of-3">
            <label for="textContent">Content</label>
            <textarea id="textContent" .value=${content || ''} @input=${this.handleInputChange}></textarea>
          </div>
          <div class="slds-col slds-size_1-of-12">
            <button id="button-save" @click=${this.handleClickSave}>Save</button>
          </div>
        </div>
      </slds-card>
    `;
  }

  handleInputChange(event) {
    const { id, value } = event.target;
    this._paragraphData = { ...this._paragraphData, [id]: value };
    this.requestUpdate();
  }

  handleClickSave() {
    console.log('Saving data:', this._paragraphData);
  }

  fireQueryEvent_Paragraph(paragraphid, callback) {
    if (!paragraphid) return;
    const payload = { object: 'paragraph', id: paragraphid };
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true,
      })
    );
  }

  queryEventCallback_Paragraph(error, data) {
    if (error) {
      console.error(error);
      return;
    }
    this._paragraphData = data;
    this.requestUpdate();
  }
}

customElements.define('custom-paragraph', CustomParagraph);
