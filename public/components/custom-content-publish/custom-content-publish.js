import {
  LitElement,
  html,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/components/custom-publishing/custom-publishing.js';

/**
 * Veröffentlicht **einen Inhalt** in einem eigenen Modal — mit
 * `object-name="node"` auch einen Knoten (für `custom-node-view`).
 *
 * **Übergangslösung.** Geplant ist eine einheitliche Komponente, die Inhalte
 * *und Listen von Inhalten* veröffentlicht. Bis es sie gibt, hält diese hier
 * nichts als einen Auslöser, ein Modal und `custom-publishing` — dünn genug,
 * dass die Ablösung ein getauschtes Tag ist und kein Eingriff in
 * `custom-paragraph`.
 *
 * Genau darum steht sie **neben** dem Editor und nicht in ihm: Wäre das
 * Veröffentlichen ein Tab von `custom-content-edit`, müsste man es später dort
 * herausoperieren.
 */
class CustomContentPublish extends LitElement {
  // Per object: what the trigger and the modal call it. An unknown
  // object-name falls back to a content, as it was before the attribute.
  labels = {
    content: { modalTitle: 'Absatz veröffentlichen' },
    node: { modalTitle: 'Knoten veröffentlichen' },
  };

  static properties = {
    recordId: { type: String, attribute: 'record-id' },
    publishDate: { type: String, attribute: 'publish-date' },
    // `content` (default) or `node`: the node view publishes its node here.
    objectName: { type: String, attribute: 'object-name' },
    // Size of the trigger: x-small next to a paragraph; empty gives the
    // default size of slds-button-icon, as the other actions of a node have.
    triggerSize: { type: String, attribute: 'trigger-size' },
  };

  constructor() {
    super();
    this.recordId = '';
    this.publishDate = '';
    this.objectName = 'content';
    this.triggerSize = 'x-small';
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    if (!this.checkPublishPermission()) {
      return html``;
    }
    const object = this.labels[this.objectName] ? this.objectName : 'content';
    const labels = this.labels[object];

    return html`
      <slds-button-icon
        icon="utility:upload"
        variant="container-filled"
        size="${this.triggerSize || nothing}"
        label="${labels.modalTitle}"
        @click=${this.show}
      ></slds-button-icon>

      <slds-modal heading="${labels.modalTitle}" footless>
        <custom-publishing
          record-id="${this.recordId}"
          object-name="${object}"
          publish-date="${this.publishDate || ''}"
        ></custom-publishing>
      </slds-modal>
    `;
  }

  // ==================================================
  // Öffentliche Schnittstelle
  // ==================================================

  show() {
    const modal = this.shadowRoot.querySelector('slds-modal');
    if (modal) {
      modal.show();
    }
  }

  hide() {
    const modal = this.shadowRoot.querySelector('slds-modal');
    if (modal) {
      modal.hide();
    }
  }

  /**
   * Dieselbe Regel wie der Schalter im Modal (`custom-publishing`): **beide**
   * Scopes. Ohne sie ginge ein Modal auf, dessen einziger Schalter still
   * deaktiviert ist — die Komponente verspräche etwas, das sie nicht hält.
   */
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
}

customElements.define('custom-content-publish', CustomContentPublish);
