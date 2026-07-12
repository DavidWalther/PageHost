# slds-progress-bar

A Lit web component that renders a Salesforce Lightning Design System (SLDS) progress bar.

## Usage

```html
<script
  type="module"
  src="/slds-components/slds-progress-bar/slds-progress-bar.js"
></script>

<slds-progress-bar percent="60"></slds-progress-bar>
```

## Properties

| Property   | Type    | Default    | Description                                                                                                          |
| ---------- | ------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `percent`  | Number  | `0`        | The current progress value (0–100). Values outside this range are clamped.                                           |
| `size`     | String  | `"medium"` | Bar thickness. Accepted values: `"x-small"`, `"small"`, `"medium"`, `"large"`. `"medium"` applies no modifier class. |
| `circular` | Boolean | `false`    | Applies rounded ends to the bar (`slds-progress-bar_circular`).                                                      |
| `vertical` | Boolean | `false`    | Renders the bar vertically. Progress grows upward via `height`.                                                      |
| `variant`  | String  | `"base"`   | Visual style of the filled portion. Use `"success"` for a green fill.                                                |

## Examples

### Basic

```html
<slds-progress-bar percent="40"></slds-progress-bar>
```

### Success variant

```html
<slds-progress-bar percent="100" variant="success"></slds-progress-bar>
```

### Circular ends, small size

```html
<slds-progress-bar percent="75" size="small" circular></slds-progress-bar>
```

### Vertical

```html
<slds-progress-bar percent="50" vertical></slds-progress-bar>
```

## Accessibility

The component renders a `<div>` with `role="progressbar"` and the ARIA attributes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`. An assistive-text `<span>` inside the value element also announces the percentage (e.g. _"Progress: 60%"_).

## Notes

- `size` is checked against a whitelist (`x-small`, `small`, `medium`, `large`); an
  unknown value applies **no** modifier class.
- `size="medium"` deliberately applies **no** modifier class either: the base class
  `.slds-progress-bar` already has `height: 0.5rem` — the same value as
  `.slds-progress-bar_medium`.
- `percent` is coerced to a number and clamped to 0–100. A non-numeric value falls
  back to `0` rather than producing `NaN`.
