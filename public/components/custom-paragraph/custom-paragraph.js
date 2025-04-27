import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class CustomParagraph extends LitElement {
  static properties = {
    id: { type: String },
    paragraphData: { type: Object },
  };

  static styles = css`
    /* Add SLDS styling for your component here */
  `;

  constructor() {
    super();
    this.id = '';
    this.paragraphData = null;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this.fireQueryEvent_Paragraph(this.id, this.queryEventCallback_Paragraph.bind(this));
  }

  render() {
    if (!this.paragraphData) {
      return html`<slds-spinner size="x-small" ?hidden=${!this.spinner}></slds-spinner>`;
    }

    const { name, htmlcontent, content } = this.paragraphData;
    const displayOption = `${htmlcontent ? 'html' : 'text'}-${this.editable ? 'editable' : 'readonly'}`;

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
      </div>
    `;
  }

  renderHtmlReadonly(htmlcontent) {
    return html`
      <div id="content">
        <div .innerHTML=${htmlcontent}></div>
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
    this.paragraphData = { ...this.paragraphData, [id]: value };
    this.requestUpdate();
  }

  handleClickSave() {
    console.log('Saving data:', this.paragraphData);
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
    this.paragraphData = data;
  }
}

customElements.define('custom-paragraph', CustomParagraph);
