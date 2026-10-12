import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

/**
 * The one action that moves a node.
 *
 * Moving takes two steps in two places. Its button marks the node it stands
 * at and reports `node-mark-change`; the consumer keeps the mark — it lives
 * only as long as the page — and hands it back as `marked`. The action holds
 * no state of its own. Where the new parent is chosen, a host that is its own
 * trigger sets `no-trigger` and calls `requestMove()`.
 */
class CustomNodeMove extends LitElement {
  labels = {
    mark: 'Zum Verschieben markieren',
    unmark: 'Markierung aufheben',
  };

  static properties = {
    nodeId: { type: String, attribute: 'node-id' },
    nodeName: { type: String, attribute: 'node-name' },
    parentId: { type: String, attribute: 'parent-id' },
    // Is this node the marked one? Set by the consumer, which owns the mark.
    marked: { type: Boolean },
    // The host is the trigger (e.g. a tile of the navigation modal): no button
    // of its own; the host calls requestMove().
    noTrigger: { type: Boolean, attribute: 'no-trigger' },
  };

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor() {
    super();
    this.nodeId = null;
    this.nodeName = '';
    this.parentId = null;
    this.marked = false;
    this.noTrigger = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    if (this.noTrigger || !this.canMove()) {
      return '';
    }
    return html`
      <slds-button-icon
        id="button-move"
        icon="${this.marked ? 'utility:clear' : 'utility:cut'}"
        variant="container-filled"
        title="${this.marked ? this.labels.unmark : this.labels.mark}"
        @click=${this._handleClick}
      ></slds-button-icon>
    `;
  }

  /** Does the session carry the edit scope? One place for the rule. */
  canMove() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsed = JSON.parse(authData);
      return (
        parsed?.authenticationResult?.access?.scopes?.includes('edit') || false
      );
    } catch (error) {
      return false;
    }
  }

  /** Reports the wish to mark or unmark; the consumer decides and hands back. */
  _handleClick() {
    this.dispatchEvent(
      new CustomEvent('node-mark-change', {
        detail: {
          marked: !this.marked,
          node: {
            id: this.nodeId,
            name: this.nodeName,
            parentId: this.parentId || null,
          },
        },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-node-move', CustomNodeMove);
