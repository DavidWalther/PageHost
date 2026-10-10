import {
  LitElement,
  html,
  css,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/components/custom-node/custom-node.js';
import '/slds-components/slds-tabset/slds-tabset.js';
import '/slds-components/slds-spinner/slds-spinner.js';

/**
 * The feeds of the start page.
 *
 * A feed is not a type of node: the **feed root** is an ordinary node, and its
 * child nodes are the feeds. Which node is the feed root is the consumer's
 * business (`root-id`); the application takes it from the configuration.
 *
 * Each feed is one tab, and a tab shows the feed's contents one below the
 * other — which is exactly what a `custom-node` without child navigation
 * does, so that is what a tab holds. With a single feed there is nothing to
 * choose from, and the feed is shown without a tab bar.
 *
 * A feed is loaded when its tab is shown for the first time, not before: the
 * `custom-node` gets its `id` on the tab's `active` event.
 */
class CustomFeed extends LitElement {
  labels = {
    labelNoFeeds: 'Keine Inhalte vorhanden',
  };

  static properties = {
    rootId: { type: String, attribute: 'root-id' },
    activeFeed: { type: String, attribute: 'active-feed' },
    contentnumber: { type: Number },
    _feeds: { state: true },
    _loading: { state: true },
    _loadedFeedIds: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor() {
    super();
    this.rootId = null;
    this.activeFeed = null;
    this.contentnumber = null;
    this._feeds = [];
    this._loading = false;
    this._loadedFeedIds = new Set();
    this._userChoosesTab = false;
    this._jumpFeedId = null;
    // Capture phase: the note has to be taken before the tabset reacts. With a
    // real click the tabset has already updated — and the tab has already
    // fired `active` — by the time a bubbling listener would run.
    this.userChoiceListener = {
      handleEvent: () => this.noteUserChoice(),
      capture: true,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  willUpdate(changedProperties) {
    if (changedProperties.has('rootId')) {
      this.loadFeeds(this.rootId);
    }
    // The jump belongs to the feed that was asked for together with it — not
    // to whichever tab the user opens afterwards.
    if (changedProperties.has('contentnumber')) {
      this._jumpFeedId = this.contentnumber ? this.activeFeed : null;
    }
  }

  // ==================================================
  // Loading
  // ==================================================

  async loadFeeds(rootId) {
    this._loadedFeedIds = new Set();
    if (!rootId) {
      this._feeds = [];
      this._loading = false;
      return;
    }
    this._loading = true;
    const root = await this.queryNode(rootId);
    // A newer root-id may have been set while this one was on its way.
    if (rootId !== this.rootId) {
      return;
    }
    this._feeds = root?.nodes ?? [];
    this._loading = false;
  }

  queryNode(id) {
    return new Promise((resolve) => {
      this.dispatchEvent(
        new CustomEvent('query', {
          detail: {
            payload: { object: 'node', id },
            callback: (error, data) => resolve(error ? null : data),
          },
          bubbles: true,
          composed: true,
        })
      );
    });
  }

  // ==================================================
  // Rendering
  // ==================================================

  render() {
    if (this._loading) {
      return html`<slds-spinner size="large"></slds-spinner>`;
    }
    if (this._feeds.length === 0) {
      return html`<p id="no-feeds">${this.labels.labelNoFeeds}</p>`;
    }
    if (this._feeds.length === 1) {
      // Nothing to choose from: no tab bar, and nothing to wait for either.
      return this.renderFeed(this._feeds[0], true);
    }
    return html`
      <slds-tabset
        active-tab-value=${this.activeFeed ?? nothing}
        @click=${this.userChoiceListener}
        @keydown=${this.userChoiceListener}
      >
        ${this._feeds.map(
          (feed) => html`
            <slds-tab
              label=${feed.name ?? ''}
              value=${feed.id}
              @active=${() => this.handleFeedActive(feed)}
            >
              ${this.renderFeed(feed, this._loadedFeedIds.has(feed.id))}
            </slds-tab>
          `
        )}
      </slds-tabset>
    `;
  }

  /**
   * The contents of one feed. Without `isLoaded` the node has no id yet and
   * therefore loads nothing.
   *
   * No child navigation: a feed is a leaf. New contents may be created here —
   * the feed is not reachable through the navigation, so this is the only
   * place for it. Deleting the node is not offered: it would delete the feed
   * itself, and feeds cannot be created in the application.
   */
  renderFeed(feed, isLoaded) {
    const isJumpTarget =
      this.contentnumber &&
      (this._jumpFeedId ?? this._feeds[0]?.id) === feed.id;
    return html`
      <custom-node
        data-feed-id=${feed.id}
        id=${isLoaded ? feed.id : nothing}
        contentnumber=${isJumpTarget ? this.contentnumber : nothing}
        no-child-navigation
        can-create-content
      ></custom-node>
    `;
  }

  // ==================================================
  // Tabs
  // ==================================================

  /**
   * A click or a key press on the tabset: the tab change that follows within
   * this turn is the user's choice. The tab's `active` event alone cannot tell
   * — it also fires on start and when `active-feed` is set from outside.
   */
  noteUserChoice() {
    this._userChoosesTab = true;
    setTimeout(() => {
      this._userChoosesTab = false;
    }, 0);
  }

  handleFeedActive(feed) {
    if (!this._loadedFeedIds.has(feed.id)) {
      this._loadedFeedIds = new Set([...this._loadedFeedIds, feed.id]);
    }
    if (!this._userChoosesTab) {
      return;
    }
    this._userChoosesTab = false;
    this.activeFeed = feed.id;
    this.dispatchEvent(
      new CustomEvent('feed-select', {
        detail: { id: feed.id, name: feed.name ?? null },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define('custom-feed', CustomFeed);
