import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import { descendantIds } from '/modules/content-tree.mjs';
import { deleteNode } from '/components/custom-node/delete-node.api.js';

/**
 * The one action that deletes a node.
 *
 * Its button is one trigger; a host that is its own trigger sets `no-trigger`
 * and calls `requestDelete()`. The backend deletes the node with everything
 * below it, so the action asks first: once for the node and its contents,
 * and again when there are nodes below it. Declining either sends nothing.
 */
class CustomNodeDelete extends LitElement {
  labels = {
    deleteNode: 'Knoten löschen',
    nodeDeleted: 'Knoten gelöscht',
    deleteError: 'Fehler beim Löschen des Knotens',
    loadError: 'Der Knoten konnte nicht geladen werden',
    confirmNode: (contentCount) =>
      contentCount === 0
        ? 'Diesen Knoten wirklich löschen?'
        : `Diesen Knoten samt ${contentCount} ${
            contentCount === 1 ? 'Inhalt' : 'Inhalten'
          } wirklich löschen?`,
    confirmBelow: (nodeCount) =>
      nodeCount === 1
        ? 'Darunter liegt 1 weiterer Knoten. Willst du ihn samt seinen Inhalten auch löschen?'
        : `Darunter liegen ${nodeCount} weitere Knoten. Willst du sie samt ihren Inhalten auch löschen?`,
  };

  static properties = {
    nodeId: { type: String, attribute: 'node-id' },
    // The host is the trigger (e.g. a tile of the navigation modal): no button
    // of its own; the host calls requestDelete().
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
    this.noTrigger = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    if (this.noTrigger || !this.canDelete()) {
      return '';
    }
    return html`
      <slds-button-icon
        id="button-delete"
        icon="utility:delete"
        variant="container-filled"
        title="${this.labels.deleteNode}"
        @click=${() => this.requestDelete()}
      ></slds-button-icon>
    `;
  }

  /** Does the session carry the delete scope? One place for the rule. */
  canDelete() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsed = JSON.parse(authData);
      return (
        parsed?.authenticationResult?.access?.scopes?.includes('delete') ||
        false
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Asks, deletes and reports. Resolves to true when the node was deleted.
   *
   * The node tells how many contents go along, the content tree how many
   * nodes — the node itself knows only its direct children.
   */
  async requestDelete() {
    const id = this.nodeId;
    if (!id || !this.canDelete()) {
      return false;
    }

    let node;
    let tree;
    try {
      [node, tree] = await Promise.all([
        this._query({ object: 'node', id }),
        this._query({ object: 'contents' }),
      ]);
    } catch (error) {
      this._toast(this.labels.loadError, 'error');
      return false;
    }

    const below = descendantIds(tree, id);
    const contentCount = (node?.contents || []).length;
    if (!confirm(this.labels.confirmNode(contentCount))) {
      return false;
    }
    if (below.length > 0 && !confirm(this.labels.confirmBelow(below.length))) {
      return false;
    }

    try {
      await deleteNode({ id });
    } catch (error) {
      this._toast(error.message || this.labels.deleteError, 'error');
      return false;
    }

    this._toast(this.labels.nodeDeleted, 'success');
    this.dispatchEvent(
      new CustomEvent('node-deleted', {
        // The answer of the backend does not name what went along; the tree
        // does. A consumer showing any of these nodes has to let go of it.
        detail: { nodeId: id, nodeIds: [id, ...below] },
        bubbles: true,
        composed: true,
      })
    );
    return true;
  }

  /** A `query` event as a promise; the application answers it. */
  _query(payload) {
    return new Promise((resolve, reject) => {
      this.dispatchEvent(
        new CustomEvent('query', {
          detail: {
            payload,
            callback: (error, data) => (error ? reject(error) : resolve(data)),
          },
          bubbles: true,
          composed: true,
        })
      );
    });
  }

  _toast(message, variant) {
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: { message, variant },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-node-delete', CustomNodeDelete);
