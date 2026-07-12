# slds-combobox

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[combobox](https://v1.lightningdesignsystem.com/components/combobox/) as a
`<slds-combobox>` custom element. It reproduces the previous (legacy) behaviour
one-to-one — only the implementation changed from the native markup-caching
pattern to Lit.

## Usage

```html
<script
  type="module"
  src="/slds-components/slds-combobox/slds-combobox.js"
></script>

<slds-combobox
  label="Kapitel"
  placeholder="Kapitel auswählen"
  options='[{"value":"c1","label":"Alpha","title":"Alpha"}]'
  value="c1"
></slds-combobox>

<script>
  document
    .querySelector('slds-combobox')
    .addEventListener('select', (e) => console.log(e.detail.value));
</script>
```

Consumer in this app: `public/components/custom-story/custom-story.js` renders a
combobox instead of chapter buttons once a story has more chapters than
`chapterButtonsNumberMax`, and navigates on `select`.

## Attributes

| Attribute     | Description                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------- |
| `label`       | Text of the form-element label.                                                              |
| `placeholder` | Placeholder of the input.                                                                    |
| `options`     | **JSON array string**: `[{ value, label, title }]`.                                          |
| `value`       | Selected value — marks the matching option and shows its label in the input.                 |
| `disabled`    | Disables the input.                                                                          |
| `filterable`  | Makes the input editable; typing filters the options by label (substring, case-insensitive). |

Without `filterable` the input is `readonly` — the value is chosen from the
dropdown only.

## Events

| Event    | Detail      | Description                                                                                                    |
| -------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `select` | `{ value }` | Fired when an option is clicked. Does **not** bubble and is **not** composed — listen directly on the element. |

Selecting an option does **not** write back to the `value` attribute; the
component marks the option itself and lets the consumer decide what to do with
the event (that is the legacy contract).

## Behaviour

- Clicking the combobox (including the input) toggles the dropdown
  (`slds-is-open` on the trigger).
- Clicking an option marks it, puts its label in the input, sets
  `aria-activedescendant` and fires `select`. The dropdown stays open.
- Blurring the input closes the dropdown after 50 ms — the delay lets an option
  click land first.
- Changing `options` resets the filter; selecting an option does not.

## Known legacy quirks (reproduced on purpose)

- `aria-expanded` stays `"false"` even while the dropdown is open; only the
  `slds-is-open` class reflects the state.

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. Option labels use the
`--custom-combobox-option-color` custom property (themed in
`public/styles/darkmode.css`).
