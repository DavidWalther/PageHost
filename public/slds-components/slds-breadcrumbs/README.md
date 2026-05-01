# slds-breadcrumbs

A Web Component (LitElement) that renders a Salesforce Lightning Design System (SLDS) breadcrumb navigation, following the [SLDS Breadcrumbs Blueprint](https://v1.lightningdesignsystem.com/components/breadcrumbs/).

## Attributes

| Attribute           | Type    | Required | Default         | Description                                              |
|---------------------|---------|----------|-----------------|----------------------------------------------------------|
| `items`             | Array   | Yes      | `[]`            | Array of breadcrumb item objects (see below)             |
| `aria-label`        | String  | No       | `"Breadcrumbs"` | Accessible label for the `<nav>` element                 |
| `size`              | String  | No       | `"medium"`      | Text size: `small`, `medium`, or `large`                 |
| `card-container`    | Boolean | No       | `false`         | Wraps the component inside an `slds-card`                |
| `overflow`          | Boolean | No       | `false`         | Activates overflow mode; limits visible items            |
| `overflow_limit`    | Number  | No       | `3`             | Max visible items when overflow is active (ignored if `overflow` is not set) |
| `last-item-as-link` | Boolean | No       | `false`         | By default the last item (current page) renders as a plain `<span>` per the SLDS spec. Set to `true` to render it as a clickable link instead. |

### Item Object Shape

```json
{
  "key": "unique-key",
  "label": "Display Text",
  "href": "/optional/link"
}
```

| Field   | Type   | Required | Description                                       |
|---------|--------|----------|---------------------------------------------------|
| `key`   | String | Yes      | Unique identifier; included in the click event    |
| `label` | String | Yes      | Text shown in the breadcrumb                      |
| `href`  | String | No       | Navigation URL; omit to render an anchor without `href` |

## Events

| Event   | Detail                        | Description                                                                         |
|---------|-------------------------------|-------------------------------------------------------------------------------------|
| `click` | `{ key, label, href, index }` | Fired when a breadcrumb link is clicked. The last item only fires this event when `last-item-as-link` is set. |

## Usage

```html
<script type="module" src="/slds-components/slds-breadcrumbs/slds-breadcrumbs.js"></script>

<slds-breadcrumbs
  items='[
    {"key":"home","label":"Home","href":"/"},
    {"key":"accounts","label":"Accounts","href":"/accounts"},
    {"key":"record","label":"ACME Corp"}
  ]'
></slds-breadcrumbs>
```

### Overflow mode

When `overflow` is set and there are more items than `overflow_limit`, the component shows:
- the **first item**
- a `…` separator (not clickable)
- the **last `(overflow_limit - 1)` items**

```html
<!-- 5 items, limit 3 → shows: Home › … › Contacts › ACME Corp -->
<slds-breadcrumbs
  overflow
  overflow_limit="3"
  items='[
    {"key":"home","label":"Home","href":"/"},
    {"key":"accounts","label":"Accounts","href":"/accounts"},
    {"key":"list","label":"Contacts","href":"/contacts"},
    {"key":"record","label":"ACME Corp"}
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

### Custom aria-label

```html
<slds-breadcrumbs aria-label="Page navigation" items='[...]'></slds-breadcrumbs>
```

### Last item as link

By default the last item (current page) renders as a plain `<span>` with `aria-current="page"`, meaning it is not clickable:

```html
<slds-breadcrumbs
  items='[{"key":"home","label":"Home","href":"/"},{"key":"page","label":"Current Page"}]'
></slds-breadcrumbs>
```

Set `last-item-as-link` to opt in to rendering the last item as a clickable `<a>`:

```html
<slds-breadcrumbs
  last-item-as-link
  items='[{"key":"home","label":"Home","href":"/"},{"key":"page","label":"Current Page"}]'
></slds-breadcrumbs>
```

`aria-current="page"` is still applied to the last item's `<li>` in both cases.
