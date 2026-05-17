# slds-progress-bar

A Lit web component that renders a Salesforce Lightning Design System (SLDS) progress bar.

## Usage

```html
<script type="module" src="/slds-components/slds-progress-bar/slds-progress-bar.js"></script>

<slds-progress-bar percent="60"></slds-progress-bar>
```

## Properties

| Property   | Type    | Default    | Description                                                                 |
|------------|---------|------------|-----------------------------------------------------------------------------|
| `percent`  | Number  | `0`        | The current progress value (0–100). Values outside this range are clamped.  |
| `size`     | String  | `"medium"` | Bar thickness. Accepted values: `"x-small"`, `"small"`, `"medium"`, `"large"`. `"medium"` applies no modifier class. |
| `circular` | Boolean | `false`    | Applies rounded ends to the bar (`slds-progress-bar_circular`).             |
| `vertical` | Boolean | `false`    | Renders the bar vertically. Progress grows upward via `height`.             |
| `variant`  | String  | `"base"`   | Visual style of the filled portion. Use `"success"` for a green fill.      |

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

The component renders a `<div>` with `role="progressbar"` and the ARIA attributes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`. An assistive-text `<span>` inside the value element also announces the percentage (e.g. *"Progress: 60%"*).
