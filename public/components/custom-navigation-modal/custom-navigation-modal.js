import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import { findNode, findPath } from '/modules/content-tree.mjs';
import '/components/custom-chapter-edit/custom-chapter-edit.js';

class NavigationModal extends LitElement {
  //===========================
  // LIT - Methods
  //===========================

  labels = {
    modalTitle: 'Navigation',
    empty: 'Keine Inhalte vorhanden.',
    back: '< zurück',
    createSibling: 'Neuen Eintrag anlegen',
    createFirstChild: 'Ersten Eintrag anlegen in',
  };

  _isOpen = false;

  static styles = css`
    .tile {
      position: relative;
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

    /* Bottom right: how many children wait below this tile. */
    .tile__children {
      position: absolute;
      right: 0.5rem;
      bottom: 0.25rem;
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      font-size: 0.75rem;
    }

    .tile__children svg {
      width: 0.75rem;
      height: 0.75rem;
      fill: currentColor;
    }

    /* Holds a tile and, for a tile without children, its small "+". */
    .tile-wrap {
      position: relative;
    }

    .tile__add {
      position: absolute;
      right: 0.5rem;
      bottom: 0.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      padding: 0;
      border: 1px solid currentColor;
      border-radius: 0.25rem;
      background: none;
      color: inherit;
      cursor: pointer;
    }

    /* On the marked tile the small "+" takes the tile's white text colour. */
    .tile_current + .tile__add {
      color: #ffffff;
    }

    .tile__add svg,
    .tile_add svg {
      fill: currentColor;
    }

    .tile__add svg {
      width: 0.75rem;
      height: 0.75rem;
    }

    .tile_add svg {
      width: 1.25rem;
      height: 1.25rem;
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
      <!-- The create dialog: opened by the "+" tiles, it opens over the modal. -->
      <custom-chapter-edit no-trigger></custom-chapter-edit>
    `;
  }

  /** The create dialog decides about the create scope; one place for the rule. */
  get _editor() {
    return this.shadowRoot?.querySelector('custom-chapter-edit') ?? null;
  }

  _canCreate() {
    return this._editor?.checkCreatePermission() ?? false;
  }

  firstUpdated() {
    // The editor exists only after the first render; ask again for the "+".
    this.requestUpdate();
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
    const canCreate = this._canCreate();
    // Every node on the way to the location is marked, not only the location.
    const onPath = new Set(this._locationPath().map((node) => node.id));
    return html`
      ${
        nodes.length === 0
          ? html`<div class="slds-align_absolute-center slds-p-around_medium">
              <span>${this.labels.empty}</span>
            </div>`
          : ''
      }
      <slds-layout wrap gutters-small>
        ${nodes.map(
          (node) => html`
            <slds-layout-item
              size="1-of-2"
              medium-size="1-of-3"
              large-size="1-of-4"
            >
              <div class="slds-p-vertical_x-small tile-wrap">
                <button
                  class="tile ${onPath.has(node.id) ? 'tile_current' : ''}"
                  @click="${() => this._handleTileClick(node)}"
                >
                  <span class="tile__name">${node.name}</span>
                  ${this._renderChildMarker(node)}
                </button>
                ${canCreate ? this._renderFirstChildButton(node) : ''}
              </div>
            </slds-layout-item>
          `
        )}
        ${canCreate ? this._renderSiblingTile(nodes) : ''}
      </slds-layout>
    `;
  }

  /** The last tile of a level: a new node on this level (a root on top). */
  _renderSiblingTile(nodes) {
    const parentId =
      this._openPath.length > 0
        ? this._openPath[this._openPath.length - 1]
        : null;
    return html`
      <slds-layout-item size="1-of-2" medium-size="1-of-3" large-size="1-of-4">
        <div class="slds-p-vertical_x-small">
          <button
            class="tile tile_add"
            title="${this.labels.createSibling}"
            aria-label="${this.labels.createSibling}"
            @click="${() => this._openCreate(parentId, nodes)}"
          >
            <svg aria-hidden="true">
              <use
                href="/assets/icons/utility-sprite/svg/symbols.svg#add"
              ></use>
            </svg>
          </button>
        </div>
      </slds-layout-item>
    `;
  }

  /**
   * A tile without children selects, so its level can never be opened: its
   * small "+" creates its first child instead.
   */
  _renderFirstChildButton(node) {
    if ((node.childnodes || []).length > 0) {
      return '';
    }
    const label = `${this.labels.createFirstChild} ${node.name}`;
    return html`<button
      class="tile__add"
      title="${label}"
      aria-label="${label}"
      @click="${() => this._openCreate(node.id, [])}"
    >
      <svg aria-hidden="true">
        <use href="/assets/icons/utility-sprite/svg/symbols.svg#add"></use>
      </svg>
    </button>`;
  }

  /** Opens the create dialog for a child of parentId (none: a root). */
  _openCreate(parentId, siblings) {
    const editor = this._editor;
    if (parentId) {
      editor.setAttribute('story-id', parentId);
    } else {
      editor.removeAttribute('story-id');
    }
    editor.chapters = siblings;
    // story-id is read on open; let the editor take it over first.
    editor.updateComplete.then(() => editor.openCreate());
  }

  /**
   * Shows that a tile leads further: the number of its children and a
   * chevron. Screen readers hear the number as words instead.
   */
  _renderChildMarker(node) {
    const count = (node.childnodes || []).length;
    if (count === 0) {
      return '';
    }
    const words = count === 1 ? '1 Eintrag' : `${count} Einträge`;
    return html`<span class="tile__children">
      <span class="tile__count" aria-hidden="true">${count}</span>
      <svg aria-hidden="true">
        <use
          href="/assets/icons/utility-sprite/svg/symbols.svg#chevronright"
        ></use>
      </svg>
      <span class="slds-assistive-text">${words}</span>
    </span>`;
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
