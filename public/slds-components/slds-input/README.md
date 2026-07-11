# slds-input

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[input](https://v1.lightningdesignsystem.com/components/input/) as a
`<slds-input>` custom element. It reproduces the previous (legacy) behaviour
one-to-one — only the implementation changed from the native markup-caching
pattern to Lit.

The control variant per `type` is chosen through a small **strategy registry**
(`inputTypeStrategies`), so adding a new type is a new registry entry rather than
another branch in a `switch` (Open/Closed).

## Usage

```html
<script type="module" src="/slds-components/slds-input/slds-input.js"></script>

<slds-input label="Chapter Name" value="My chapter" type="text"></slds-input>

<script>
  document
    .querySelector('slds-input')
    .addEventListener('change', (e) => console.log(e.detail.value));
</script>
```

Consumer in this app: `public/components/custom-chapter-edit/custom-chapter-edit.js`
mounts two `<slds-input>` fields and reads `event.detail.value` from their
`change` event.

## Attributes

| Attribute | Description                                                |
| --------- | ---------------------------------------------------------- |
| `label`   | Text of the form-element label. Absent → empty label.      |
| `value`   | Initial value written to the control (`.value`).           |
| `type`    | Selects the control strategy (see below). Absent → `text`. |

All three are reactive. The component keeps **no** internal value state — user
input is surfaced only through the `change` event (see below), it does not update
the element's own `value`.

## Types (strategy)

| `type`        | Rendered control                                 |
| ------------- | ------------------------------------------------ |
| `date`        | `<input type="date" id="input-date">`            |
| anything else | `<input type="text" id="input-text">` (fallback) |

`text` is the fallback for every unknown type — this is faithful to the legacy
`default` branch. Values such as `number` therefore render as a **text** input.

Adding a type: register another strategy in `inputTypeStrategies` keyed by the
`type` string; `render()` stays untouched.

## Events

| Event    | Detail            | Description                                                                                            |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `change` | `{ type, value }` | Bubbles. Re-dispatched from the control's native `change`; `type`/`value` come from the input element. |

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. The component adds no local styles.
