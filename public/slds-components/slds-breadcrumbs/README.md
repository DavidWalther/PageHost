# slds-breadcrumbs

A Web Component (LitElement) that renders a Salesforce Lightning Design System (SLDS) breadcrumb navigation, following the [SLDS Breadcrumbs Blueprint](https://v1.lightningdesignsystem.com/components/breadcrumbs/).

---

## Import

```html
<script type="module" src="/slds-components/slds-breadcrumbs/slds-breadcrumbs.js"></script>
```

---

## Attributes

| Attribute           | Type    | Required | Default         | Description                                                        |
|---------------------|---------|----------|-----------------|--------------------------------------------------------------------|
| `items`             | Array   | Yes      | `[]`            | Array of breadcrumb item objects (see [Item shape](#item-shape))   |
| `aria-label`        | String  | No       | `"Breadcrumbs"` | Accessible label for the `<nav>` element                           |
| `size`              | String  | No       | `"medium"`      | Text size: `small`, `medium`, or `large`                           |
| `card-container`    | Boolean | No       | `false`         | Wraps the breadcrumbs inside an `slds-card`                        |
| `overflow`          | Boolean | No       | `false`         | Activates overflow mode; collapses middle items into `…`           |
| `overflow_limit`    | Number  | No       | `3`             | Max visible items when overflow is active (ignored without `overflow`) |
| `last-item-as-link` | Boolean | No       | `false`         | Renders the last (current) item as a clickable `<a>` instead of a `<span>` |

---

## Item shape

Each entry in the `items` array must be an object with the following fields:

```json
{
  "key": "unique-key",
  "label": "Display Text",
  "href": "/optional/link"
}
```

| Field   | Type   | Required | Description                                                  |
|---------|--------|----------|--------------------------------------------------------------|
| `key`   | String | Yes      | Unique identifier; passed through in the `click` event       |
| `label` | String | Yes      | Text shown in the breadcrumb item                            |
| `href`  | String | No       | Navigation URL; omit to render the anchor without an `href`  |

---

## Events

| Event   | Detail                        | Description                                                                                                 |
|---------|-------------------------------|-------------------------------------------------------------------------------------------------------------|
| `click` | `{ key, label, href, index }` | Fired when a breadcrumb link is clicked. The last item fires this event only when `last-item-as-link` is set. |

---

## Size

The `size` attribute controls the text size and the spacing between items.

| Value    | SLDS class applied          |
|----------|-----------------------------|
| `small`  | `slds-text-heading_small`   |
| `medium` | `slds-text-heading_medium`  |
| `large`  | `slds-text-heading_large`   |

---

## Overflow

When `overflow` is set and the number of items exceeds `overflow_limit`, the component collapses the middle items into a non-interactive `…` placeholder:

- The **first item** is always visible.
- A `…` separator replaces the hidden middle items.
- The **last `overflow_limit - 1` items** remain visible.

Example with 5 items and `overflow_limit="3"`:

```
Home  ›  …  ›  Contacts  ›  ACME Corp
```

---

## Usage

### Basic

```html
<slds-breadcrumbs
  items='[
    {"key":"home","label":"Home","href":"/"},
    {"key":"accounts","label":"Accounts","href":"/accounts"},
    {"key":"record","label":"ACME Corp"}
  ]'
></slds-breadcrumbs>
```

### With overflow

```html
<slds-breadcrumbs
  overflow
  overflow_limit="3"
  items='[
    {"key":"home","label":"Home","href":"/"},
    {"key":"accounts","label":"Accounts","href":"/accounts"},
    {"key":"contacts","label":"Contacts","href":"/contacts"},
    {"key":"record","label":"ACME Corp"}
  ]'
></slds-breadcrumbs>
```

### Inside a card

```html
<slds-breadcrumbs
  card-container
  items='[
    {"key":"home","label":"Home","href":"/"},
    {"key":"page","label":"Current Page"}
  ]'
></slds-breadcrumbs>
```

### Listening to click events

```javascript
document.querySelector('slds-breadcrumbs').addEventListener('click', (event) => {
  const { key, label, href, index } = event.detail;
  console.log(`Clicked: ${label} (key: ${key}, index: ${index})`);
});
```

### Custom `aria-label`

```html
<slds-breadcrumbs
  aria-label="Page navigation"
  items='[...]'
></slds-breadcrumbs>
```

### Last item as link

By default the last item (current page) renders as a plain `<span>` with `aria-current="page"` — it is not clickable:

```html
<slds-breadcrumbs
  items='[
    {"key":"home","label":"Home","href":"/"},
    {"key":"page","label":"Current Page"}
  ]'
></slds-breadcrumbs>
```

Set `last-item-as-link` to render it as a clickable `<a>` instead:

```html
<slds-breadcrumbs
  last-item-as-link
  items='[
    {"key":"home","label":"Home","href":"/"},
    {"key":"page","label":"Current Page"}
  ]'
></slds-breadcrumbs>
```

`aria-current="page"` is applied to the last item's `<li>` in both cases.
