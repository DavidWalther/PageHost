import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
// A tabset without tabs is useless — the consumer imports one file, not two.
import '/slds-components/slds-tabset/slds-tab.js';

const PANEL_CLASS = 'slds-tabs_default__content';

// Values for tabs that come without one, like `lightning-tabset` does. Unique
// per page, so two tabsets never hand out the same value.
let generatedValueCount = 0;

/**
 * A set of tabs — modelled on `lightning-tabset`.
 *
 * The tab bar lives in this element's shadow root; the `slds-tab` children are
 * projected through the default slot and stay in the consumer's light DOM.
 */
class SldsTabset extends LitElement {
  static properties = {
    activeTabValue: { type: String, attribute: 'active-tab-value' },
    _tabs: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor() {
    super();
    this.activeTabValue = undefined;
    this._tabs = [];
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  /** The value of the tab that is shown: the requested one, else the first. */
  get _shownValue() {
    const requested = this._tabs.find(
      (tab) => tab.value === this.activeTabValue
    );
    return (requested ?? this._tabs[0])?.value;
  }

  render() {
    const shownValue = this._shownValue;
    return html`
      <div class="slds-tabs_default">
        ${
          this._tabs.length === 0
            ? ''
            : html`<ul class="slds-tabs_default__nav" role="tablist">
                ${this._tabs.map((tab) =>
                this._renderTabItem(tab, tab.value === shownValue)
              )}
              </ul>`
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
        <a class="slds-tabs_default__link" role="tab">${tab.label}</a>
      </li>
    `;
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
    const shownValue = this._shownValue;
    this._tabs.forEach((tab) => {
      const isShown = tab.value === shownValue;
      tab.setAttribute('role', 'tabpanel');
      tab.setAttribute('aria-label', tab.label ?? '');
      tab.classList.add(PANEL_CLASS);
      tab.classList.toggle('slds-show', isShown);
      tab.classList.toggle('slds-hide', !isShown);
    });
  }
}

customElements.define('slds-tabset', SldsTabset);
