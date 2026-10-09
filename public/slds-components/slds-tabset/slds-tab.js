import {
  LitElement,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

/**
 * Internal: a tab reports a changed `label` or `value` to its tabset, which
 * redraws the tab bar. Not part of the public API.
 */
export const TAB_CHANGE_EVENT = 'slds-tab-change';

/**
 * One tab of an `slds-tabset` — modelled on `lightning-tab`.
 *
 * Carries the tab's `label` and `value`; its children are the tab's content.
 * Renders into the **light DOM**: the content stays in the consumer's scope, and
 * the tabset sets the panel role, the SLDS classes and the visibility on this
 * host from outside. Fires `active` (set off by the tabset) whenever it becomes
 * the shown tab.
 */
class SldsTab extends LitElement {
  static properties = {
    label: { type: String },
    value: { type: String },
  };

  constructor() {
    super();
    this.label = '';
    this.value = undefined;
  }

  createRenderRoot() {
    return this;
  }

  // Light DOM: the children already are the content. A <slot> only projects
  // inside a shadow root and would be a dead element here.
  render() {
    return nothing;
  }

  updated(changedProperties) {
    if (changedProperties.has('label') || changedProperties.has('value')) {
      this.dispatchEvent(new Event(TAB_CHANGE_EVENT, { bubbles: true }));
    }
  }
}

customElements.define('slds-tab', SldsTab);
