import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class CustomPublishing extends LitElement {
  static properties = {
    recordId: { type: String, attribute: 'record-id' },
    objectName: { type: String, attribute: 'object-name' },
    publishDate: { type: String, attribute: 'publish-date' },
    disabled: { type: Boolean }
  };

  static styles = css`
    .publish-container {
      width: 100%;
    }
  `;

  constructor() {
    super();
    this.recordId = '';
    this.objectName = '';
    this.publishDate = null;
    this.disabled = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    const canPublish = this.checkPublishPermission();
    const isPublished = this.publishDate ? true : false;
    const isToggleDisabled = !canPublish || this.disabled;

    return html`
      <div class="publish-container">
        <div class="slds-grid slds-wrap slds-gutters">
          <div class="slds-col slds-size_1-of-2 slds-m-bottom_medium">
            <div class="slds-form-element">
              <label class="slds-form-element__label">
                <abbr class="slds-required" title="required">*</abbr>Published Status
              </label>
            </div>
          </div>
          <div class="slds-col slds-size_1-of-2 slds-m-bottom_medium">
            <div class="slds-form-element__control">
              <slds-toggle
                label="Published"
                enabled-label="Published"
                disabled-label="Unpublished"
                name="publish-toggle"
                ?checked=${isPublished}
                ?disabled=${isToggleDisabled}
                @toggle=${this.handlePublishToggleChange}
              ></slds-toggle>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  checkPublishPermission() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsedData = JSON.parse(authData);
      const scopes = parsedData?.authenticationResult.access?.scopes || [];
      return scopes.includes('publish') && scopes.includes('edit');
    } catch (e) {
      return false;
    }
  }

  async handlePublishToggleChange(event) {
    const isChecked = event.detail.checked;
    const wasPublished = this.publishDate ? true : false;

    // Check permissions again at action time
    if (!this.checkPublishPermission()) {
      this.requestUpdate();
      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: 'Not authenticated or insufficient permissions', variant: 'error' },
        bubbles: true,
        composed: true
      }));
      return;
    }

    // If toggling from unpublished to published, call publish endpoint
    if (!wasPublished && isChecked) {
      this.firePublishEvent();
    }
    // If toggling from published to unpublished, call unpublish endpoint
    else if (wasPublished && !isChecked) {
      this.fireUnpublishEvent();
    }
  }

  firePublishEvent() {
    if (!this.recordId || !this.objectName) return;

    const payload = {
      id: this.recordId,
      object: this.objectName
    };
    let eventDetail = {
      object: this.objectName,
      payload,
      callback: this.publishEventCallback.bind(this),
    };

    this.dispatchEvent(
      new CustomEvent('publish', {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      })
    );
  }

  publishEventCallback(error, data) {
    if (error) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: error, variant: 'error' },
          bubbles: true,
          composed: true,
        })
      );
      return;
    }
    if (data) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: 'Published', variant: 'success' },
          bubbles: true,
          composed: true,
        })
      );
      // Fire published event to notify parent components
      this.dispatchEvent(
        new CustomEvent('published', {
          detail: { 
            recordId: this.recordId, 
            objectName: this.objectName 
          },
          bubbles: true,
          composed: true,
        })
      );
    }
    this.requestUpdate();
  }

  fireUnpublishEvent() {
    if (!this.recordId || !this.objectName) return;

    const payload = {
      id: this.recordId,
      object: this.objectName
    };
    let eventDetail = {
      object: this.objectName,
      payload,
      callback: this.unpublishEventCallback.bind(this),
    };

    this.dispatchEvent(
      new CustomEvent('unpublish', {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      })
    );
  }

  unpublishEventCallback(error, data) {
    if (error) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: error, variant: 'error' },
          bubbles: true,
          composed: true,
        })
      );
      return;
    }
    if (data) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: 'Unpublished', variant: 'success' },
          bubbles: true,
          composed: true,
        })
      );
      // Fire unpublished event to notify parent components
      this.dispatchEvent(
        new CustomEvent('unpublished', {
          detail: { 
            recordId: this.recordId, 
            objectName: this.objectName 
          },
          bubbles: true,
          composed: true,
        })
      );
    }
    this.requestUpdate();
  }
}

customElements.define('custom-publishing', CustomPublishing);
