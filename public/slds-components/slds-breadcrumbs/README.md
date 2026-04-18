# slds-breadcrumbs

A Web Component (LitElement) that renders a Salesforce Lightning Design System (SLDS) breadcrumb navigation, following the [SLDS Breadcrumbs Blueprint](https://v1.lightningdesignsystem.com/components/breadcrumbs/).

## Attributes

| Attribute    | Type   | Required | Default          | Description                                    |
|--------------|--------|----------|------------------|------------------------------------------------|
| `items`      | Array  | Yes      | `[]`             | JSON array of breadcrumb item objects (see below) |
| `aria-label` | String | No       | `"Breadcrumbs"`  | Accessible label for the `<nav>` element       |

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

| Event             | Detail                                       | Description                          |
|-------------------|----------------------------------------------|--------------------------------------|
| `breadcrumbclick` | `{ key, label, href, index }`                | Fired when a breadcrumb link is clicked |

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

### Listening to click events

```javascript
document.querySelector('slds-breadcrumbs').addEventListener('breadcrumbclick', (event) => {
  const { key, label, href, index } = event.detail;
  console.log(`Clicked: ${label} (key: ${key}, index: ${index})`);
});
```

### Custom aria-label

```html
<slds-breadcrumbs aria-label="Page navigation" items='[...]'></slds-breadcrumbs>
```
