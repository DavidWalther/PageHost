# slds-input

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[input](https://v1.lightningdesignsystem.com/components/input/) as a
`<slds-input>` custom element.

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

| Attribute     | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `label`       | Text of the form-element label. Absent → empty label.          |
| `value`       | Initial value written to the control (`.value`).               |
| `type`        | Selects the control strategy (see below). Absent → `text`.     |
| `placeholder` | Placeholder of the control. Omitted entirely when not set.     |
| `required`    | Boolean; marks the control as required.                        |
| `min`         | Minimum value, passed straight through (useful with `number`). |

All of them are reactive. The label's `for` is bound to the control's `id`, so the
two stay associated for every type. The component keeps **no** internal value state
— user input is surfaced only through the `change` event (see below); it does not
update the element's own `value`.

## Types (strategy)

| `type`        | Rendered control                          |
| ------------- | ----------------------------------------- |
| `date`        | `<input type="date" id="input-date">`     |
| `number`      | `<input type="number" id="input-number">` |
| `text`        | `<input type="text" id="input-text">`     |
| anything else | falls back to the `text` strategy         |

Adding a type: register another strategy in `inputTypeStrategies` keyed by the
`type` string; `render()` stays untouched.

## Events

| Event    | Detail            | Description                                                                                            |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `change` | `{ type, value }` | Bubbles. Re-dispatched from the control's native `change`; `type`/`value` come from the input element. |

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. The component adds no local styles.
