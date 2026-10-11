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
    createChild: 'Neuen Eintrag anlegen',
  };

  _isOpen = false;

  // Holding a tile (see `_handleTilePointerDown`): the running timer, where
  // the press started, and until when the click that ends a hold is dropped.
  static HOLD_MS = 500;
  static HOLD_SLOP_PX = 10;
  _holdTimer = null;
  _holdStart = null;
  _holdFired = false;
  _dropClickUntil = 0;

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
      /* Holding a tile opens its level: no callout or text selection on touch. */
      -webkit-touch-callout: none;
      user-select: none;
    }

    /*
     * A tile with children looks like a stack of cards: two offset layers
     * behind it, each drawn as a panel-coloured card with a border. The look
     * lives in this one rule only.
     */
    .tile_stack {
      box-shadow:
        3px 3px 0 -1px var(--panel-background-color),
        3px 3px 0 0 #c9c9c9,
        6px 6px 0 -1px var(--panel-background-color),
        6px 6px 0 0 #c9c9c9;
    }

    .tile:hover {
      border-color: #0176d3;
    }

    .tile_current {
      background-color: #0176d3;
      border-color: #0176d3;
      color: #ffffff;
    }

    .tile_add svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: currentColor;
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
    _tree: { state: true },
    _openPath: { state: true },
  };

  constructor() {
    super();
    this.currentLocation = null;
    this._tree = [];
    // Ids of the nodes whose children are listed, top down. Empty: the roots.
    this._openPath = [];
    // show() ran before the tree arrived; position once it is there.
    this._positionPending = false;
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
    this._loadContents();
  }

  //===========================
  // Data
  //===========================

  _loadContents() {
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: {
          payload: { object: 'contents' },
          callback: (error, data) => {
            if (error) {
              console.error(error);
              return;
            }
            this._tree = Array.isArray(data) ? data : [];
            if (this._isOpen && this._positionPending) {
              // show() ran before the tree was available: position now.
              this._positionPending = false;
              this._openPath = this._resolveInitialPath();
            } else {
              // A reload: stay on the open level as far as it still exists.
              this._openPath = this._existingPrefix(this._openPath);
            }
          },
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** The leading part of `path` whose nodes are all still in the tree. */
  _existingPrefix(path) {
    const kept = [];
    for (const id of path) {
      if (!findNode(this._tree, id)) {
        break;
      }
      kept.push(id);
    }
    return kept;
  }

  /** The path from a root down to the current location, or [] if unknown. */
  _locationPath() {
    return this.currentLocation
      ? findPath(this._tree, this.currentLocation)
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
      return this._tree;
    }
    const parent = findNode(
      this._tree,
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
      <!-- The create dialog: opened by the "+" tile, it opens over the modal. -->
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
    // A hold ends wherever the pointer is let go — after the level changed,
    // the tile it started on is gone. So the end is watched on the whole root.
    const endHold = () => this._endHold();
    this.shadowRoot.addEventListener('pointerup', endHold, true);
    this.shadowRoot.addEventListener('pointercancel', endHold, true);
    this.shadowRoot.addEventListener(
      'click',
      (event) => {
        if (Date.now() < this._dropClickUntil) {
          // The click that ends a hold would select, or hit the "+" tile
          // that now stands under the pointer.
          this._dropClickUntil = 0;
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
  }

  /** The node whose children are listed, or null on the top level. */
  _currentElementId() {
    return this._openPath.length > 0
      ? this._openPath[this._openPath.length - 1]
      : null;
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
              <div class="slds-p-vertical_x-small">
                <button
                  class="tile ${onPath.has(node.id) ? 'tile_current' : ''} ${
                    (node.childnodes || []).length > 0 ? 'tile_stack' : ''
                  }"
                  @click="${(event) => this._handleTileClick(node, event)}"
                  @keydown="${(event) => this._handleTileKeydown(node, event)}"
                  @pointerdown="${(event) =>
                    this._handleTilePointerDown(node, event)}"
                  @pointermove="${this._handleTilePointerMove}"
                  @pointerleave="${this._cancelHold}"
                  @contextmenu="${this._handleTileContextMenu}"
                >
                  <span class="tile__name">${node.name}</span>
                </button>
              </div>
            </slds-layout-item>
          `
        )}
        ${canCreate ? this._renderCreateTile(nodes) : ''}
      </slds-layout>
    `;
  }

  /** The last tile of a level: one more child of the current element. */
  _renderCreateTile(siblings) {
    return html`
      <slds-layout-item size="1-of-2" medium-size="1-of-3" large-size="1-of-4">
        <div class="slds-p-vertical_x-small">
          <button
            class="tile tile_add"
            title="${this.labels.createChild}"
            aria-label="${this.labels.createChild}"
            @click="${() => this._openCreate(this._currentElementId(), siblings)}"
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
   * Opens the create dialog for a child of parentId (none: a root). The
   * action is the dialog's; this tile is only one way to start it.
   */
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
   * A node with children opens its level; the page behind follows (it shows
   * that node, a cover node loads). A node without children is the choice:
   * the modal reports it and the host closes the modal — unless the click is
   * modified (see `_isOpenLevelGesture`), which opens it as a level instead.
   */
  _handleTileClick(node, event) {
    if ((node.childnodes || []).length > 0 || this._isOpenLevelGesture(event)) {
      this._openLevel(node);
      return;
    }
    this.dispatchEvent(
      new CustomEvent('navigation-node-select', {
        detail: { id: node.id, parentId: this._currentElementId() },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Ctrl/Cmd + Enter on a focused tile. Handled on keydown, not via the click
   * the key would trigger: Ctrl + Enter clicks with `ctrlKey` set, but
   * Cmd + Enter on macOS does not click a button at all.
   */
  _handleTileKeydown(node, event) {
    if (event.key !== 'Enter' || !this._isOpenLevelGesture(event)) {
      return;
    }
    event.preventDefault();
    this._openLevel(node);
  }

  /**
   * Holding a tile for half a second — mobile, and any other pointer — is the
   * same gesture as Ctrl/Cmd + click. Only with the create scope, and only the
   * main button; moving the pointer away or by more than a few pixels (a
   * scroll) cancels it.
   */
  _handleTilePointerDown(node, event) {
    this._cancelHold();
    if (event.button !== 0 || !this._canCreate()) {
      return;
    }
    this._holdStart = { x: event.clientX, y: event.clientY };
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this._holdFired = true;
      this._openLevel(node);
    }, NavigationModal.HOLD_MS);
  }

  _handleTilePointerMove(event) {
    if (!this._holdStart) {
      return;
    }
    const dx = event.clientX - this._holdStart.x;
    const dy = event.clientY - this._holdStart.y;
    if (Math.hypot(dx, dy) > NavigationModal.HOLD_SLOP_PX) {
      this._cancelHold();
    }
  }

  /** A press that did not last long enough: nothing happened, nothing to undo. */
  _cancelHold() {
    clearTimeout(this._holdTimer);
    this._holdTimer = null;
    this._holdStart = null;
  }

  /** The pointer was let go. After a hold, the click that follows is dropped. */
  _endHold() {
    if (this._holdFired) {
      this._holdFired = false;
      this._dropClickUntil = Date.now() + NavigationModal.HOLD_MS;
    }
    this._cancelHold();
  }

  /**
   * A long touch opens the system menu (Android) at about the time the hold
   * fires. While a hold runs, the menu stays closed.
   */
  _handleTileContextMenu(event) {
    if (this._holdTimer || this._holdFired) {
      event.preventDefault();
    }
  }

  /**
   * The gesture that opens any tile as a level and never selects: Ctrl + click
   * (Windows, Linux) or Cmd + click (macOS). It exists to create a first child
   * of a leaf, so it only counts with the create scope.
   */
  _isOpenLevelGesture(event) {
    return !!(event?.ctrlKey || event?.metaKey) && this._canCreate();
  }

  /**
   * Makes the node the current element: its children are listed. The page
   * behind follows only into a node with children — a leaf is opened to
   * create its first child, not to be shown.
   */
  _openLevel(node) {
    this._openPath = [...this._openPath, node.id];
    if ((node.childnodes || []).length === 0) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('navigation-level-open', {
        detail: { id: node.id },
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
    this._positionPending = this._tree.length === 0;
    this._openPath = this._resolveInitialPath();
    this.shadowRoot.querySelector('slds-modal').show();
  }

  hide() {
    this._isOpen = false;
    this.shadowRoot.querySelector('slds-modal').hide();
  }

  /**
   * Loads the content tree again — after a node was created, changed,
   * deleted, published or unpublished. An open modal stays on its level as
   * far as that level still exists.
   */
  reload() {
    this._loadContents();
  }
}

customElements.define('custom-navigation-modal', NavigationModal);
