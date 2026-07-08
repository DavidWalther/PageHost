# slds-toast

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[toast](https://v1.lightningdesignsystem.com/components/toast/) notification as a
`<slds-toast>` custom element. It reproduces the previous (legacy) behaviour
one-to-one — only the implementation changed from the native markup-caching
pattern to Lit.

## Usage

```html
<script type="module" src="/slds-components/slds-toast/slds-toast.js"></script>

<slds-toast state="success">Saved successfully</slds-toast>
```

The message is provided via the default slot. The component renders the SLDS
toast container (`slds-notify_toast`) with the theme, icon and assistive text
matching the `state`.

Typically created programmatically — see `showToast()` in `public/index.js`,
which sets `state` and the message text and removes the toast after ~900 ms.

## Attributes

| Attribute | Type   | Default | Description                                                                                 |
| --------- | ------ | ------- | ------------------------------------------------------------------------------------------- |
| `state`   | String | `info`  | One of `success`, `info`, `warning`, `error`. Any other/missing value falls back to `info`. |

The `state` drives three things at once: the theme class `slds-theme_<state>`,
the utility icon (`…/utility-sprite/svg/symbols.svg#<state>` and
`slds-icon-utility-<state>`), and the assistive-text label.

## Slots

| Slot        | Description       |
| ----------- | ----------------- |
| _(default)_ | The message text. |

## Notes

- The legacy `debug` attribute was dropped — it had no effect.
- The legacy component accumulated theme classes when `state` changed after
  creation (it never removed the old one); no consumer exercises that path, so
  the Lit port does not reproduce it. See `EPC/Missed.md`.

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. A local rule keeps the notify container at
`min-width: fit-content`, matching the legacy template.
