import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/components/custom-chapter-edit/custom-chapter-edit.js';
import '/components/custom-content-publish/custom-content-publish.js';
import '/components/custom-node-delete/custom-node-delete.js';
import '/components/custom-node-move/custom-node-move.js';

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
  labels = {
    childLabel: 'Auswahl',
    childPlaceholder: 'Eintrag auswählen',
    share: 'Link kopieren',
    linkCopied: 'Link kopiert',
  };

  static properties = {
    id: { type: String },
    // The siblings just before and after, `{ previous, next }`, each
    // `{ id, name }` or null — from the host, which knows the tree.
    siblings: { type: Object, attribute: false },
    // The ancestors from the root down, `[{ id, name }]`, without the node
    // itself — its name stands below. Empty for a root.
    path: { type: Array, attribute: false },
    // Id of the node marked to be moved, wherever it is. The host owns the
    // mark; the view tells its move action whether that is this node.
    markedId: { type: String },
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
    this.markedId = null;
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
        ${this._renderActions()} ${this._renderChildren()}
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

  /**
   * The actions on the node. Each one only under its scope, and without one
   * there is no element at all — an empty one would stand as a gap. Creating
   * a child is not among them: that is the navigation modal's "+" tile.
   */
  _renderActions() {
    const node = this._nodeData;
    const actions = [
      this.hasScope('publish') && this.hasScope('edit')
        ? html`<custom-content-publish
            id="node-publish"
            object-name="node"
            record-id="${node.id}"
            publish-date="${node.published_date || ''}"
          ></custom-content-publish>`
        : null,
      this.hasScope('edit')
        ? html`<custom-chapter-edit
            id="node-edit"
            chapter-id="${node.id}"
            story-id="${node.parent_node_id || ''}"
            name="${node.name || ''}"
            .sortNumber="${node.sortnumber ?? null}"
            ?reversed="${node.reversed || false}"
            @chapter-updated=${this._handleNodeUpdated}
          ></custom-chapter-edit>`
        : null,
      html`<slds-button-icon
        id="button-share"
        icon="utility:link"
        variant="container-filled"
        label="${this.labels.share}"
        @click=${this._handleShareClick}
      ></slds-button-icon>`,
      this.hasScope('edit')
        ? html`<custom-node-move
            id="node-move"
            node-id="${node.id}"
            node-name="${node.name || ''}"
            parent-id="${node.parent_node_id || ''}"
            .marked="${!!node.id && this.markedId === node.id}"
          ></custom-node-move>`
        : null,
      this.hasScope('delete')
        ? html`<custom-node-delete
            id="node-delete"
            node-id="${node.id}"
          ></custom-node-delete>`
        : null,
    ].filter(Boolean);

    return html`<slds-layout
      id="node-actions"
      class="slds-m-top_x-small"
      align-center
      wrap
      gutters-xxx-small
    >
      ${actions.map(
        (action) =>
          html`<slds-layout-item grow-none align-middle
            >${action}</slds-layout-item
          >`
      )}
    </slds-layout>`;
  }

  /** The way down: a combobox of the children, from a single child on. */
  _renderChildren() {
    const children = this._nodeData?.nodes || [];
    if (children.length === 0) {
      return '';
    }
    const options = children.map((child) => ({
      value: child.id,
      label: child.name,
      title: child.name,
    }));
    return html`<div id="child-navigation" class="slds-m-top_small">
      <slds-combobox
        options=${JSON.stringify(options)}
        label="${this.labels.childLabel}"
        placeholder="${this.labels.childPlaceholder}"
        @combobox-select=${(event) => this._navigate(event.detail.value)}
      ></slds-combobox>
    </div>`;
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

  _handleShareClick() {
    const shareUrl = `${location.origin}/${this.id}`;
    navigator.clipboard.writeText(shareUrl).catch((error) => {
      console.error('Error copying text to clipboard:', error);
    });
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: { message: this.labels.linkCopied, variant: 'info' },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** The edit dialog saved: its fields replace the ones shown here. */
  _handleNodeUpdated(event) {
    const updated = event.detail?.chapterData;
    if (!updated) return;
    this._nodeData = { ...this._nodeData, ...updated };
  }

  /** Does the signed-in session carry this scope? */
  hasScope(scope) {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsed = JSON.parse(authData);
      return (
        parsed?.authenticationResult.access?.scopes?.includes(scope) || false
      );
    } catch (error) {
      console.error('Failed to parse authenticationResult:', error);
      return false;
    }
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
