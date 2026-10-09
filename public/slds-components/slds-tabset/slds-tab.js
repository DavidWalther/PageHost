import {
  LitElement,
  nothing,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

/**
 * One tab of an `slds-tabset` — modelled on `lightning-tab`.
 *
 * Carries the tab's `label` and `value`; its children are the tab's content.
 * Renders into the **light DOM**: the content stays in the consumer's scope, and
 * the tabset sets the panel role, the SLDS classes and the visibility on this
 * host from outside.
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
}

customElements.define('slds-tab', SldsTab);
