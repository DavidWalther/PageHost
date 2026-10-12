import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import { findNode, findPath, withoutNodes } from '/modules/content-tree.mjs';
import '/components/custom-chapter-edit/custom-chapter-edit.js';
import '/components/custom-node-delete/custom-node-delete.js';
import '/components/custom-node-move/custom-node-move.js';

class NavigationModal extends LitElement {
  //===========================
  // LIT - Methods
  //===========================

  labels = {
    modalTitle: 'Navigation',
    empty: 'Keine Inhalte vorhanden.',
    back: '< zurück',
    createChild: 'Neuen Eintrag anlegen',
    deleteCurrent: 'Diesen Eintrag löschen',
    marked: (name) => `„${name}“ markiert`,
    clearMark: 'Markierung aufheben',
    pasteHere: 'Hier einfügen',
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

    .tile_add svg,
    .tile_delete svg,
    .tile_paste svg {
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
    // Nodes left out, each with everything below it: no tile, no level. The
    // node marked to be moved is one — it cannot become its own new parent.
    hiddenIds: { type: Array, attribute: 'hidden-ids' },
    // The node marked to be moved, `{ id, name, parentId }`, or null. The host
    // owns the mark; the modal names it and moves it.
    marked: { type: Object },
    _tree: { state: true },
    _openPath: { state: true },
  };

  constructor() {
    super();
    this.currentLocation = null;
    this.hiddenIds = [];
    this.marked = null;
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

  /** The tree as the modal lists it: without the nodes in `hidden-ids`. */
  get _shownTree() {
    return withoutNodes(this._tree, this.hiddenIds || []);
  }

  /** Nodes left out while the modal is open: a level through them closes. */
  willUpdate(changed) {
    if (changed.has('hiddenIds')) {
      this._openPath = this._existingPrefix(this._openPath);
    }
  }

  /** The leading part of `path` whose nodes are all still listed. */
  _existingPrefix(path) {
    const kept = [];
    for (const id of path) {
      if (!findNode(this._shownTree, id)) {
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
   * keeps the modal on the top level, and so does a left-out node on the way:
   * the path ends before it.
   */
  _resolveInitialPath() {
    return this._existingPrefix(
      this._locationPath()
        .slice(0, -1)
        .map((node) => node.id)
    );
  }

  /** The nodes listed on the open level. */
  _currentLevel() {
    if (this._openPath.length === 0) {
      return this._shownTree;
    }
    const parent = findNode(
      this._shownTree,
      this._openPath[this._openPath.length - 1]
    );
    return parent?.childnodes || [];
  }

  render() {
    return html`
      <slds-modal heading="${this.labels.modalTitle}" footless>
        ${this.marked?.id ? this._renderMarkedHint() : ''}
        ${this._openPath.length > 0 ? this._renderBack() : ''}
        ${this._renderLevel(this._currentLevel())}
      </slds-modal>
      <!-- The create dialog: opened by the "+" tile, it opens over the modal. -->
      <custom-chapter-edit no-trigger></custom-chapter-edit>
      <!-- The delete action: run by the delete tile, its prompts and all. -->
      <custom-node-delete no-trigger></custom-node-delete>
      <!-- The move action: run by the paste tile with the mark of the host. -->
      <custom-node-move no-trigger></custom-node-move>
    `;
  }

  /** The create dialog decides about the create scope; one place for the rule. */
  get _editor() {
    return this.shadowRoot?.querySelector('custom-chapter-edit') ?? null;
  }

  _canCreate() {
    return this._editor?.checkCreatePermission() ?? false;
  }

  /** The delete action decides about the delete scope, as the editor does. */
  get _deleteAction() {
    return this.shadowRoot?.querySelector('custom-node-delete') ?? null;
  }

  _canDelete() {
    return this._deleteAction?.canDelete() ?? false;
  }

  /** The move action decides about the edit scope, as the others do. */
  get _moveAction() {
    return this.shadowRoot?.querySelector('custom-node-move') ?? null;
  }

  /**
   * Is there a mark to paste here? Not on the level the marked node already
   * hangs on — that move would change nothing. The top level stands for the
   * roots: a root is not pasted there.
   */
  _canPasteHere() {
    if (!this.marked?.id || !(this._moveAction?.canMove() ?? false)) {
      return false;
    }
    return this._currentElementId() !== (this.marked.parentId ?? null);
  }

  firstUpdated() {
    // Editor and the delete and move actions exist only after the first
    // render; ask again for their tiles.
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

  /**
   * What is marked to be moved, on every level: the marked node itself is
   * left out of the tiles, so this is where it can still be seen — and where
   * the mark can be dropped.
   */
  _renderMarkedHint() {
    return html`
      <div id="marked-hint" class="slds-m-bottom_small">
        <span class="slds-pill">
          <span class="slds-pill__label">
            ${this.labels.marked(this.marked.name)}
          </span>
          <button
            class="slds-button slds-button_icon slds-pill__remove"
            title="${this.labels.clearMark}"
            aria-label="${this.labels.clearMark}"
            @click="${this._clearMark}"
          >
            <svg class="slds-button__icon" aria-hidden="true">
              <use
                href="/assets/icons/utility-sprite/svg/symbols.svg#close"
              ></use>
            </svg>
          </button>
        </span>
      </div>
    `;
  }

  /** Asks the host to drop the mark; the host owns it. */
  _clearMark() {
    this.dispatchEvent(
      new CustomEvent('node-mark-clear', {
        detail: { nodeId: this.marked?.id ?? null },
        bubbles: true,
        composed: true,
      })
    );
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
        ${
          this._currentElementId() && this._canDelete()
            ? this._renderDeleteTile()
            : ''
        }
        ${this._canPasteHere() ? this._renderPasteTile() : ''}
      </slds-layout>
    `;
  }

  /**
   * The last tile of an opened level: deletes the current element — the node
   * whose children are listed, not one of them. The top level has no current
   * element and so no such tile.
   */
  _renderDeleteTile() {
    return html`
      <slds-layout-item size="1-of-2" medium-size="1-of-3" large-size="1-of-4">
        <div class="slds-p-vertical_x-small">
          <button
            class="tile tile_delete"
            title="${this.labels.deleteCurrent}"
            aria-label="${this.labels.deleteCurrent}"
            @click="${() => this._deleteCurrent()}"
          >
            <svg aria-hidden="true">
              <use
                href="/assets/icons/utility-sprite/svg/symbols.svg#delete"
              ></use>
            </svg>
          </button>
        </div>
      </slds-layout-item>
    `;
  }

  /**
   * Runs the delete action for the current element. The action asks and
   * reports `node-deleted`; the host then reloads the tree, and the modal
   * stays on what is left of its path — one level higher.
   */
  _deleteCurrent() {
    const action = this._deleteAction;
    action.nodeId = this._currentElementId();
    return action.requestDelete();
  }

  /**
   * The last tile of a level while a node is marked: moves it below the
   * current element — on the top level, to the top level.
   */
  _renderPasteTile() {
    return html`
      <slds-layout-item size="1-of-2" medium-size="1-of-3" large-size="1-of-4">
        <div class="slds-p-vertical_x-small">
          <button
            class="tile tile_paste"
            title="${this.labels.pasteHere}"
            aria-label="${this.labels.pasteHere}"
            @click="${() => this._pasteHere()}"
          >
            <svg aria-hidden="true">
              <use
                href="/assets/icons/utility-sprite/svg/symbols.svg#paste"
              ></use>
            </svg>
          </button>
        </div>
      </slds-layout-item>
    `;
  }

  /**
   * Runs the move action for the mark. The action writes and reports
   * `node-moved`; the host drops the mark and reloads the tree.
   */
  _pasteHere() {
    return this._moveAction.requestMove(this.marked, this._currentElementId());
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
   * same gesture as Ctrl/Cmd + click. Only with a scope that needs it (see
   * `_canOpenAnyLevel`), and only the main button; moving the pointer away or
   * by more than a few pixels (a scroll) cancels it.
   */
  _handleTilePointerDown(node, event) {
    this._cancelHold();
    if (event.button !== 0 || !this._canOpenAnyLevel()) {
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
   * (Windows, Linux) or Cmd + click (macOS).
   */
  _isOpenLevelGesture(event) {
    return !!(event?.ctrlKey || event?.metaKey) && this._canOpenAnyLevel();
  }

  /**
   * A leaf is opened as a level for what its level offers: "+" creates its
   * first child, the delete tile deletes it. Without either scope there is
   * nothing to do there, and the gesture stays a plain click.
   */
  _canOpenAnyLevel() {
    return this._canCreate() || this._canDelete();
  }

  /**
   * Makes the node the current element: its children are listed. The page
   * behind follows only into a node with children — a leaf is opened to
   * create its first child or to be deleted, not to be shown.
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
