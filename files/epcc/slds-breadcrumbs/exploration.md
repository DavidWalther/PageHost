# Exploration: slds-breadcrumbs Component

## Codebase Structure

### Existing SLDS Components
Located at `public/slds-components/`:
- `slds-button-icon` – plain Web Component (HTMLElement) + HTML template file
- `slds-card` – plain Web Component + HTML template file
- `slds-combobox` – plain Web Component + HTML template file
- `slds-input` – plain Web Component + HTML template file
- `slds-toast` – plain Web Component + HTML template file
- `slds-toggle` – **LitElement** (most recent pattern) – no separate HTML file needed

### Two Component Patterns in the Codebase

#### Pattern A: Plain Web Component (older)
- `class Foo extends HTMLElement`
- Loads HTML from a separate `.html` file via `fetch()`
- Uses `<template id="template-main">` in the HTML file
- Applies global styles via `addGlobalStylesToShadowRoot` in constructor

#### Pattern B: LitElement (newer – target pattern)
- `class Foo extends LitElement`
- Imports from `'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'`
- Renders via `render()` method with `html` tagged template literals
- Applies global styles via `addGlobalStylesToShadowRoot` in `connectedCallback()`
- Uses `static properties = { ... }` for reactive properties
- No separate HTML file needed

### Global Styles Module
`/modules/global-styles.mjs` – exports `addGlobalStylesToShadowRoot(shadowRoot)`
- Reads all document stylesheets and adopts them into the shadow root
- Makes SLDS classes available inside Shadow DOM

---

## SLDS Breadcrumbs Blueprint (v1)

Source: https://v1.lightningdesignsystem.com/components/breadcrumbs/

### HTML Structure
```html
<nav role="navigation" aria-label="Breadcrumbs">
  <ol class="slds-breadcrumb slds-list_horizontal slds-wrap">
    <li class="slds-breadcrumb__item">
      <a href="/parent">Parent Entity</a>
    </li>
    <li class="slds-breadcrumb__item">
      <a href="/child">Parent Record Name</a>
    </li>
  </ol>
</nav>
```

### Key CSS Classes
- `slds-breadcrumb` – on `<ol>`, auto-generates chevron separators via CSS
- `slds-list_horizontal` – renders list horizontally
- `slds-wrap` – allows wrapping
- `slds-breadcrumb__item` – on each `<li>`

### Accessibility
- Wrap in `<nav role="navigation" aria-label="Breadcrumbs">`
- Use `<ol>` (ordered list – order matters)

---

## Component API Design

### Attributes / Properties
| Attribute        | Type    | Description                                                                     | Default          |
|------------------|---------|---------------------------------------------------------------------------------|------------------|
| `items`          | Array   | JSON array of `{ key, label, href }` objects                                    | `[]`             |
| `aria-label`     | String  | Label for the `<nav>` element                                                   | `"Breadcrumbs"`  |
| `overflow`       | Boolean | Activates overflow mode                                                         | `false`          |
| `overflow_limit` | Number  | Max visible items in overflow mode. First + … + last (limit-1). Ignored without `overflow`. | `3` |

### Overflow logic
- `overflow` not set → all items rendered normally
- `overflow` set, `items.length <= overflowLimit` → all items rendered normally
- `overflow` set, `items.length > overflowLimit` → `[items[0], ELLIPSIS, ...items.slice(-(overflowLimit-1))]`

### Events
| Event   | Detail                          | Description                        |
|---------|---------------------------------|------------------------------------|
| `click` | `{ key, label, href, index }`   | Fired when a breadcrumb is clicked |


### Example Usage
```html
<slds-breadcrumbs
  items='[{"label":"Home","href":"/"},{"label":"Accounts","href":"/accounts"},{"label":"ACME Corp","href":"/accounts/123"}]'
></slds-breadcrumbs>
```

---

## Implementation Notes
- Follow `slds-toggle` LitElement pattern exactly
- Use `addGlobalStylesToShadowRoot` in `connectedCallback()`
- `items` attribute is JSON string, LitElement `type: Array` handles parsing
- Custom element name: `slds-breadcrumbs`
- File location: `public/slds-components/slds-breadcrumbs/slds-breadcrumbs.js`
- Add a `README.md` documenting usage (consistent with `slds-button-icon`)
