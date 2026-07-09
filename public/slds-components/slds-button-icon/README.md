# slds-button-icon

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
icon-only button as a `<slds-button-icon>` custom element. It reproduces the
previous (legacy) behaviour one-to-one — only the implementation changed from the
native markup-caching pattern to Lit.

## Usage

```html
<script
  type="module"
  src="/slds-components/slds-button-icon/slds-button-icon.js"
></script>

<slds-button-icon
  icon="utility:settings"
  size="small"
  variant="container-transparent"
></slds-button-icon>
```

## Attributes

| Attribute   | Type    | Default            | Description                                                                                                                        |
| ----------- | ------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `icon`      | String  | —                  | Icon in the form `type:name` (e.g. `utility:settings`). Drives the sprite `use` href and the (capitalised) assistive text.         |
| `variant`   | String  | `container-filled` | One of `icon-only`, `container-transparent`, `container-filled`. Missing → `container-filled`; any other value → no variant class. |
| `size`      | String  | —                  | One of `large`, `small`, `x-small`, `xx-small`. Any other/missing value → no size class.                                           |
| `disabled`  | Boolean | absent             | If present, the inner `<button>` is disabled (and therefore fires no click).                                                       |
| `no-border` | —       | —                  | **Deprecated no-op.** Present in the legacy API but has no effect (kept as a no-op for compatibility; see `EPC/Missed.md`).        |

## Clicks

The component dispatches **no custom event**. The inner `<button>` lives in the
shadow root, so a native `click` bubbles and is retargeted to the host — attach a
plain `click` listener on `<slds-button-icon>` (e.g. Lit `@click`), exactly as the
consumers (`custom-chapter`, `custom-story`, `custom-chapter-edit`, `bookstore`)
do. When `disabled` is set, the button fires no click.

> Note: earlier documentation mentioned an `sldsbuttonclick` event — that event
> was never dispatched by the component and no consumer relied on it. Use the
> native `click` on the host instead.

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. The component adds no local styles.
