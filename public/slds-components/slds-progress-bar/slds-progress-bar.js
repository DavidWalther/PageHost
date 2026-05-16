import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class SLDSProgressBar extends LitElement {
  static properties = {
    percent:  { type: Number },
    size:     { type: String },
    circular: { type: Boolean },
    vertical: { type: Boolean },
    variant:  { type: String }
  };

  constructor() {
    super();
    this.percent  = 0;
    this.size     = 'medium';
    this.circular = false;
    this.vertical = false;
    this.variant  = 'base';
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot);
  }

  render() {
    const clampedPercent = Math.min(100, Math.max(0, this.percent));

    const rootClasses = [
      'slds-progress-bar',
      this.size !== 'medium' ? `slds-progress-bar_${this.size}` : '',
      this.circular ? 'slds-progress-bar_circular' : '',
      this.vertical ? 'slds-progress-bar_vertical' : ''
    ].filter(Boolean).join(' ');

    const valueClasses = [
      'slds-progress-bar__value',
      this.variant === 'success' ? 'slds-progress-bar__value_success' : ''
    ].filter(Boolean).join(' ');

    const style = this.vertical
      ? `height: ${clampedPercent}%;`
      : `width: ${clampedPercent}%;`;

    return html`
      <div
        class="${rootClasses}"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${clampedPercent}"
      >
        <span class="${valueClasses}" style="${style}">
          <span class="slds-assistive-text">Progress: ${clampedPercent}%</span>
        </span>
      </div>
    `;
  }
}

customElements.define('slds-progress-bar', SLDSProgressBar);
