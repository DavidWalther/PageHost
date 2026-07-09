# slds-global-header

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[global header](https://v1.lightningdesignsystem.com/components/global-header/)
as a `<slds-global-header>` custom element. It reproduces the previous (legacy)
behaviour one-to-one — only the implementation changed from the native
markup-caching pattern to Lit.

## Usage

```html
<script
  type="module"
  src="/slds-components/slds-global-header/slds-global-header.js"
></script>

<slds-global-header>
  <img slot="logo" src="/assets/logo.svg" alt="Logo" />
  <div slot="search"><!-- global search --></div>
  <div slot="actions"><!-- global actions --></div>
</slds-global-header>
```

The component renders the SLDS header structure
(`header.slds-global-header_container` → `.slds-global-header` with three
`.slds-global-header__item` regions) and projects the provided content through
the named slots.

## Attributes

None. The component is purely presentational.

## Slots

| Slot      | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `logo`    | Logo / branding, left region.                                     |
| `search`  | Global search, centre region (`slds-global-header__item_search`). |
| `actions` | Global actions, right region.                                     |

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. The component adds no local styles (the legacy
template had none).
