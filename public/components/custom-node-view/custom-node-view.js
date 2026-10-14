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
    // The siblings just before and after, `{ previous, next }`, each
    // `{ id, name }` or null — from the host, which knows the tree.
    siblings: { type: Object, attribute: false },
    // The ancestors from the root down, `[{ id, name }]`, without the node
    // itself — its name stands below. Empty for a root.
    path: { type: Array, attribute: false },
    _nodeData: { state: true },
    _loading: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }

    /*
     * Both arrows keep their place, with a button or without one: the name
     * between them must not move when a sibling is missing.
     */
    #item-previous,
    #item-next {
      flex: 0 0 2.5rem;
    }

    #item-name {
      min-width: 0;
    }
  `;

  constructor() {
    super();
    this.id = null;
    this.siblings = { previous: null, next: null };
    this.path = [];
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
        ${this._renderBreadcrumbs()}
        <slds-layout id="node-title" vertical-align-center>
          <slds-layout-item id="item-previous">
            ${this._renderArrow('previous', 'utility:chevronleft')}
          </slds-layout-item>
          <slds-layout-item id="item-name">
            <div class="slds-text-heading_medium slds-text-align_center">
              <span id="node-name">${this._nodeData.name || ''}</span>
            </div>
          </slds-layout-item>
          <slds-layout-item id="item-next">
            ${this._renderArrow('next', 'utility:chevronright')}
          </slds-layout-item>
        </slds-layout>
      </slds-card>
    `;
  }

  /**
   * The way up. Every crumb is a link — the trail ends above the node, whose
   * name stands below — and carries the address of its node, so it can also
   * be opened or copied as such.
   */
  _renderBreadcrumbs() {
    const path = this.path || [];
    if (path.length === 0) {
      return '';
    }
    const items = path.map((node) => ({
      key: node.id,
      label: node.name || '',
      href: `/${node.id}`,
    }));
    return html`<slds-breadcrumbs
      size="small"
      no-current-item
      last-item-as-link
      .items=${items}
      @breadcrumb-select=${(event) => this._navigate(event.detail.key)}
    ></slds-breadcrumbs>`;
  }

  /** The arrow to one sibling, named after it; nothing without one. */
  _renderArrow(which, icon) {
    const sibling = this.siblings?.[which];
    if (!sibling?.id) {
      return '';
    }
    return html`<slds-button-icon
      id="button-${which}"
      icon="${icon}"
      variant="container-transparent"
      label="${sibling.name || ''}"
      @click=${() => this._navigate(sibling.id)}
    ></slds-button-icon>`;
  }

  /** Every way to another node ends here: the host decides what follows. */
  _navigate(id) {
    this.dispatchEvent(
      new CustomEvent('node-view-navigate', {
        detail: { id },
        bubbles: true,
        composed: true,
      })
    );
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
