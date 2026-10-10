import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
// A tabset without tabs is useless — the consumer imports one file, not two.
import { TAB_CHANGE_EVENT } from '/slds-components/slds-tabset/slds-tab.js';

const PANEL_CLASS = 'slds-tabs_default__content';

// Only `standard` is built so far; an unknown variant falls back to it, like
// `lightning-tabset` does.
const VARIANT_CLASSES = { standard: 'slds-tabs_default' };
const DEFAULT_VARIANT = 'standard';

// Size of the tab labels — an extension of our own, `lightning-tabset` has
// none. Without a size, or with an unknown one, the SLDS default applies.
const SIZE_CLASSES = { medium: 'slds-tabs_medium', large: 'slds-tabs_large' };

// Own keys only: `size="constructor"` must not find Object.prototype.
const classFor = (classes, key) =>
  Object.hasOwn(classes, key ?? '') ? classes[key] : undefined;

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };

// Values for tabs that come without one, like `lightning-tabset` does. Unique
// per page, so two tabsets never hand out the same value.
let generatedValueCount = 0;

/**
 * A set of tabs — modelled on `lightning-tabset`.
 *
 * The tab bar lives in this element's shadow root; the `slds-tab` children are
 * projected through the default slot and stay in the consumer's light DOM.
 *
 * Which tab is shown: the one named by `active-tab-value`, else the first. A
 * click sets `activeTabValue`, so the property always names the shown tab once
 * the user has chosen one. Each tab that becomes the shown one fires `active`.
 */
class SldsTabset extends LitElement {
  static properties = {
    activeTabValue: { type: String, attribute: 'active-tab-value' },
    variant: { type: String },
    size: { type: String },
    _tabs: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }

    /* Narrow screens: the tab bar scrolls sideways instead of widening the
       page. SLDS only offers an overflow menu for this (hidden tabs behind a
       "More" button); scrolling keeps every tab reachable without one.

       A wrapper scrolls, not the list: SLDS lets a tab item reach 1px below
       the list so that the underline of the shown tab lies on the list's
       border. Overflow on the list itself would cut that pixel. */
    .tab-scroller {
      overflow-x: auto;
      overflow-y: hidden;
    }

    .slds-tabs_default__nav {
      width: max-content;
      min-width: 100%;
    }

    .slds-tabs_default__item {
      flex-shrink: 0;
    }
  `;

  constructor() {
    super();
    this.activeTabValue = undefined;
    this.variant = DEFAULT_VARIANT;
    this.size = undefined;
    this._tabs = [];
    this._shownTab = undefined;
    this._activationPending = false;
    // A tab reports a changed label or value; the bar has to follow.
    this.addEventListener(TAB_CHANGE_EVENT, (event) => {
      event.stopPropagation();
      this.requestUpdate();
    });
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  willUpdate(changedProperties) {
    if (
      !changedProperties.has('_tabs') &&
      !changedProperties.has('activeTabValue')
    ) {
      return;
    }
    const requested = this._tabs.find(
      (tab) => tab.value === this.activeTabValue
    );
    let next;
    if (changedProperties.has('activeTabValue')) {
      // Asked for a tab: that one, or the first if the value is unknown.
      next = requested ?? this._tabs[0];
    } else if (this._tabs.includes(this._shownTab)) {
      // Only the tabs changed and the shown one is still there: keep it.
      next = this._shownTab;
    } else {
      next = requested ?? this._tabs[0];
    }
    if (next !== this._shownTab) {
      this._shownTab = next;
      this._activationPending = !!next;
    }
  }

  render() {
    const classes = [
      classFor(VARIANT_CLASSES, this.variant) ??
        VARIANT_CLASSES[DEFAULT_VARIANT],
      classFor(SIZE_CLASSES, this.size),
    ]
      .filter(Boolean)
      .join(' ');
    return html`
      <div class="${classes}">
        ${
          this._tabs.length === 0
            ? ''
            : html`<div class="tab-scroller">
                <ul class="slds-tabs_default__nav" role="tablist">
                  ${this._tabs.map((tab) =>
                    this._renderTabItem(tab, tab === this._shownTab)
                  )}
                </ul>
              </div>`
        }
        <slot @slotchange=${this._handleSlotChange}></slot>
      </div>
    `;
  }

  _renderTabItem(tab, isActive) {
    return html`
      <li
        class="slds-tabs_default__item ${isActive ? 'slds-is-active' : ''}"
        title=${tab.label}
        role="presentation"
      >
        <a
          class="slds-tabs_default__link"
          role="tab"
          aria-selected=${isActive ? 'true' : 'false'}
          tabindex=${isActive ? '0' : '-1'}
          @click=${() => this._selectTab(tab)}
          @keydown=${this._handleKeyDown}
          >${tab.label}</a
        >
      </li>
    `;
  }

  _selectTab(tab) {
    this.activeTabValue = tab.value;
  }

  // Like `lightning-tabset`: left and right only, wrapping at both ends, and
  // the tab is shown at once (automatic activation) — no Home and End.
  async _handleKeyDown(event) {
    const step = ARROW_STEPS[event.key];
    if (!step || this._tabs.length === 0) {
      return;
    }
    event.preventDefault();
    const count = this._tabs.length;
    const current = Math.max(this._tabs.indexOf(this._shownTab), 0);
    const nextIndex = (current + step + count) % count;
    this._selectTab(this._tabs[nextIndex]);
    await this.updateComplete;
    this.shadowRoot.querySelectorAll('a[role="tab"]')[nextIndex]?.focus();
  }

  _handleSlotChange(event) {
    const tabs = event.target
      .assignedElements()
      .filter((element) => element.localName === 'slds-tab');
    tabs.forEach((tab) => {
      if (!tab.value) {
        generatedValueCount += 1;
        tab.value = `tab-${generatedValueCount}`;
      }
    });
    this._tabs = tabs;
  }

  // The panels are the light-DOM tabs. They are styled in the consumer's scope,
  // so the tabset only sets what makes a tab a panel.
  updated() {
    this._tabs.forEach((tab) => {
      const isShown = tab === this._shownTab;
      tab.setAttribute('role', 'tabpanel');
      tab.setAttribute('aria-label', tab.label ?? '');
      tab.classList.add(PANEL_CLASS);
      tab.classList.toggle('slds-show', isShown);
      tab.classList.toggle('slds-hide', !isShown);
    });
    if (this._activationPending) {
      this._activationPending = false;
      // Like `lightning-tab`: no detail, does not bubble — listen on the tab.
      this._shownTab.dispatchEvent(new CustomEvent('active'));
    }
  }
}

customElements.define('slds-tabset', SldsTabset);
