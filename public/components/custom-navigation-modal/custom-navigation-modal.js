import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import { findNode, findPath } from '/modules/content-tree.mjs';

class NavigationModal extends LitElement {
  //===========================
  // LIT - Methods
  //===========================

  labels = {
    modalTitle: 'Navigation',
    empty: 'Keine Inhalte vorhanden.',
    back: '< zurück',
  };

  _isOpen = false;

  static styles = css`
    .tile {
      width: 100%;
      aspect-ratio: 2 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0.5rem;
      border: 1px solid #c9c9c9;
      border-radius: 0.25rem;
      background-color: var(--panel-background-color);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .tile:hover {
      border-color: #0176d3;
    }

    .tile_current {
      background-color: #0176d3;
      border-color: #0176d3;
      color: #ffffff;
    }

    .back-button {
      background: none;
      border: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
    }

    .back-button:hover {
      text-decoration: underline;
    }
  `;

  static properties = {
    currentLocation: { type: String, attribute: 'current-location' },
    // The content tree, owned and loaded by the host.
    tree: { attribute: false },
    _openPath: { state: true },
  };

  constructor() {
    super();
    this.currentLocation = null;
    this.tree = [];
    // Ids of the nodes whose children are listed, top down. Empty: the roots.
    this._openPath = [];
    // show() ran before the tree arrived; position once it is there.
    this._positionPending = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  /**
   * A new tree from the host — the first one or a reload after a change.
   * Not yet positioned since show(): position now. Otherwise keep the open
   * level as far as it still exists.
   */
  willUpdate(changed) {
    if (!changed.has('tree')) {
      return;
    }
    if (this._isOpen && this._positionPending) {
      this._positionPending = false;
      this._openPath = this._resolveInitialPath();
    } else {
      this._openPath = this._existingPrefix(this._openPath);
    }
  }

  /** The leading part of `path` whose nodes are all still in the tree. */
  _existingPrefix(path) {
    const kept = [];
    for (const id of path) {
      if (!findNode(this.tree, id)) {
        break;
      }
      kept.push(id);
    }
    return kept;
  }

  /** The path from a root down to the current location, or [] if unknown. */
  _locationPath() {
    return this.currentLocation
      ? findPath(this.tree, this.currentLocation)
      : [];
  }

  /**
   * The levels to open for the current location: every ancestor of it, so the
   * modal lists the location among its siblings. A root (or no location)
   * keeps the modal on the top level.
   */
  _resolveInitialPath() {
    return this._locationPath()
      .slice(0, -1)
      .map((node) => node.id);
  }

  /** The nodes listed on the open level. */
  _currentLevel() {
    if (this._openPath.length === 0) {
      return this.tree;
    }
    const parent = findNode(
      this.tree,
      this._openPath[this._openPath.length - 1]
    );
    return parent?.childnodes || [];
  }

  render() {
    return html`
      <slds-modal heading="${this.labels.modalTitle}" footless>
        ${this._openPath.length > 0 ? this._renderBack() : ''}
        ${this._renderLevel(this._currentLevel())}
      </slds-modal>
    `;
  }

  _renderBack() {
    return html`
      <div class="slds-m-bottom_small">
        <button class="back-button" @click="${this._handleBack}">
          ${this.labels.back}
        </button>
      </div>
    `;
  }

  _renderLevel(nodes) {
    if (nodes.length === 0) {
      return html`
        <div class="slds-align_absolute-center slds-p-around_medium">
          <span>${this.labels.empty}</span>
        </div>
      `;
    }
    // Every node on the way to the location is marked, not only the location.
    const onPath = new Set(this._locationPath().map((node) => node.id));
    return html`
      <slds-layout wrap gutters-small>
        ${nodes.map(
          (node) => html`
            <slds-layout-item
              size="1-of-2"
              medium-size="1-of-3"
              large-size="1-of-4"
            >
              <div class="slds-p-vertical_x-small">
                <button
                  class="tile ${onPath.has(node.id) ? 'tile_current' : ''}"
                  @click="${() => this._handleTileClick(node)}"
                >
                  <span class="tile__name">${node.name}</span>
                </button>
              </div>
            </slds-layout-item>
          `
        )}
      </slds-layout>
    `;
  }

  /**
   * A node with children opens its level; the page behind follows (it shows
   * that node, a cover node loads). A node without children is the choice:
   * the modal reports it and the host closes the modal.
   */
  _handleTileClick(node) {
    if ((node.childnodes || []).length > 0) {
      this._openPath = [...this._openPath, node.id];
      this.dispatchEvent(
        new CustomEvent('navigation-level-open', {
          detail: { id: node.id },
          bubbles: true,
          composed: true,
        })
      );
      return;
    }
    const parentId =
      this._openPath.length > 0
        ? this._openPath[this._openPath.length - 1]
        : null;
    this.dispatchEvent(
      new CustomEvent('navigation-node-select', {
        detail: { id: node.id, parentId },
        bubbles: true,
        composed: true,
      })
    );
  }

  _handleBack() {
    this._openPath = this._openPath.slice(0, -1);
  }

  //===========================
  // Actions
  //===========================

  show() {
    this._isOpen = true;
    this._positionPending = this.tree.length === 0;
    this._openPath = this._resolveInitialPath();
    this.shadowRoot.querySelector('slds-modal').show();
  }

  hide() {
    this._isOpen = false;
    this.shadowRoot.querySelector('slds-modal').hide();
  }
}

customElements.define('custom-navigation-modal', NavigationModal);
