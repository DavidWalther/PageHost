import {
  LitElement,
  html,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/components/custom-publishing/custom-publishing.js';

/**
 * Veröffentlicht **einen Inhalt** in einem eigenen Modal.
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
  labels = {
    modalTitle: 'Absatz veröffentlichen',
    labelPublishContent: 'Absatz veröffentlichen',
  };

  static properties = {
    recordId: { type: String, attribute: 'record-id' },
    publishDate: { type: String, attribute: 'publish-date' },
  };

  constructor() {
    super();
    this.recordId = '';
    this.publishDate = '';
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    if (!this.checkPublishPermission()) {
      return html``;
    }

    return html`
      <slds-button-icon
        icon="utility:upload"
        variant="container-filled"
        size="x-small"
        title="${this.labels.labelPublishContent}"
        @click=${this.show}
      ></slds-button-icon>

      <slds-modal heading="${this.labels.modalTitle}" footless>
        <custom-publishing
          record-id="${this.recordId}"
          object-name="content"
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
