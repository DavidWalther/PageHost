# slds-panel

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[docked panel](https://v1.lightningdesignsystem.com/components/panels/) as a
`<slds-panel>` custom element. It reproduces the previous (legacy) behaviour
one-to-one — only the implementation changed from the native markup-caching
pattern to Lit.

The panel is docked to the left, slides in over the page and comes with its own
full-screen overlay (`.screencover`). Clicking either the close button or the
overlay closes the panel.

> **No consumer at the moment.** The last consumer was removed in
> `981eb3b bookstore: remove sidebar button and panel markup` (2026-06-22). The
> component is still loaded on every page and precached by the service worker.
> `ui-tests/slds-components/slds-panel/slds-panel.spec.js` is the only description
> of its contract.

## Usage

```html
<script type="module" src="/slds-components/slds-panel/slds-panel.js"></script>

<slds-panel id="sidebar">
  <span slot="header">Chapters</span>
  <ul>
    <!-- panel body -->
  </ul>
</slds-panel>

<script>
  document.querySelector('#sidebar').openPanel();
</script>
```

## Attributes

None. The panel is opened and closed through its methods, not through an
attribute.

## Methods

| Method         | Description                             |
| -------------- | --------------------------------------- |
| `openPanel()`  | Opens the panel and shows the overlay.  |
| `closePanel()` | Closes the panel and hides the overlay. |

The panel starts closed. Both the close button and a click on the overlay call
`closePanel()`. The component dispatches no events.

## Slots

| Slot     | Description                                               |
| -------- | --------------------------------------------------------- |
| `header` | Panel title, rendered inside `.slds-panel__header-title`. |
| default  | Panel content, rendered inside `.slds-panel__body`.       |

## State classes

The open state is reflected in the shadow DOM exactly as the legacy version did:

| State            | `.slds-panel`  | `.screencover` |
| ---------------- | -------------- | -------------- |
| closed (initial) | —              | `slds-hide`    |
| open             | `slds-is-open` | `slds-show`    |

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. Positioning (fixed, `z-index`, width and the
overlay colour) is kept as inline styles, unchanged from the legacy template.
`public/styles/darkmode.css` themes `.slds-panel` through the adopted global
stylesheets.
