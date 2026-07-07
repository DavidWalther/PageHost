# slds-spinner

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[spinner](https://v1.lightningdesignsystem.com/components/spinners/) as a
`<slds-spinner>` custom element. It reproduces the previous (legacy) behaviour
one-to-one — only the implementation changed from the native markup-caching
pattern to Lit.

## Usage

```html
<script
  type="module"
  src="/slds-components/slds-spinner/slds-spinner.js"
></script>

<slds-spinner size="large"></slds-spinner>
```

The spinner is always rendered inside a centered placeholder
(`slds-align_absolute-center`, `min-height: 6rem`), so it appears centered with a
reserved height wherever it is placed — no wrapper needed by the consumer.

## Properties

| Property    | Attribute   | Type    | Default | Description                                                                                           |
| ----------- | ----------- | ------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `size`      | `size`      | String  | –       | Size modifier: `xx-small`, `x-small`, `small`, `medium`, `large`. Unknown/omitted → no size class.    |
| `container` | `container` | Boolean | `false` | Wraps the spinner in the `slds-spinner_container` overlay (half-transparent overlay over the parent). |
| `hidden`    | `hidden`    | Boolean | `false` | Native boolean attribute; hides the host via `:host([hidden]) { display: none }`.                     |

The spinner variant is always `slds-spinner_brand` (blue), matching the legacy
behaviour.

## Examples

### Basic (large, centered)

```html
<slds-spinner size="large"></slds-spinner>
```

### Toggle visibility

```html
<slds-spinner size="x-small" ?hidden="${!isLoading}"></slds-spinner>
```

### Overlay over a container

```html
<slds-spinner container></slds-spinner>
```

## Accessibility

The spinner renders `<div role="status">` with an assistive-text span
(`Loading`) plus the SLDS `slds-spinner__dot-a` / `slds-spinner__dot-b` dots.
SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`.
