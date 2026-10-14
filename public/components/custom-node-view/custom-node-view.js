import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

/**
 * The node itself — shown above its contents (`custom-node-contents`), both
 * always referring to the same node.
 *
 * It shows the name of the node and the ways from it to other nodes: up
 * (breadcrumbs), sideways (the previous and next sibling) and down (its
 * children). It knows no tree: the host works out the path and the siblings
 * and hands them in. Every way to another node is the same event,
 * `node-view-navigate` with its id — what follows is the host's decision.
 */
class CustomNodeView extends LitElement {
  static properties = {
    id: { type: String },
    _nodeData: { state: true },
    _loading: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor() {
    super();
    this.id = null;
    this._nodeData = null;
    this._loading = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  updated(changedProperties) {
    if (changedProperties.has('id')) {
      this.handleIdChange(this.id);
    }
  }

  // ==================================================
  // Rendering
  // ==================================================

  render() {
    if (this._loading) {
      return html`<slds-spinner size="large"></slds-spinner>`;
    }
    if (!this._nodeData?.id) {
      return html``;
    }

    return html`
      <slds-card no-footer no-header>
        <div class="slds-text-heading_medium">
          <span id="node-name">${this._nodeData.name || ''}</span>
        </div>
      </slds-card>
    `;
  }

  // ==================================================
  // Data
  // ==================================================

  handleIdChange(newId) {
    if (!newId || newId === 'null') {
      this._nodeData = null;
      return;
    }
    // The record may be here already — `adoptNode` sets it with the id.
    if (this._nodeData?.id === newId) {
      return;
    }
    this._loading = true;
    this._nodeData = null;
    this.fetchNode(newId);
  }

  /**
   * Takes a record **already loaded**, instead of fetching it. `loaded` comes
   * at once — a listener has to be attached before.
   */
  adoptNode(record) {
    if (!record?.id) {
      return;
    }
    this._loading = false;
    this.applyNodeData(record);
    // The attribute, not only the property: consumers read the id as one.
    this.setAttribute('id', record.id);
  }

  /** Fetches the node again under the same id. Without an id: nothing. */
  reload() {
    if (!this.id || this.id === 'null') {
      return;
    }
    this._loading = true;
    this._nodeData = null;
    this.fetchNode(this.id);
  }

  fetchNode(nodeId) {
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: {
          payload: { object: 'node', id: nodeId },
          callback: (error, data) => {
            if (error) {
              console.error('Error fetching node data:', error);
              this._loading = false;
              return;
            }
            this.applyNodeData(data);
          },
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  applyNodeData(data) {
    this._nodeData = data || {};
    this._loading = false;
    this.dispatchEvent(
      new CustomEvent('loaded', {
        detail: { nodeData: this._nodeData },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-node-view', CustomNodeView);
