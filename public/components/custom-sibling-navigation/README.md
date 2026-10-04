# custom-sibling-navigation

Previous / next at the end of the contents: two buttons that lead to the
siblings of the shown node — `‹ <previous name>` and `<next name> ›`.

The component **knows no tree**. The host works out the neighbours (in the
app: `app-bookstore` with `findSiblings` from `/modules/content-tree.mjs`) and
passes them in; it also decides what a choice does.

## Import

```js
import '/components/custom-sibling-navigation/custom-sibling-navigation.js';
```

## Properties

| Property   | Type                     | Description                               |
| :--------- | :----------------------- | :---------------------------------------- |
| `previous` | `{ id, name }` or `null` | The sibling before; no button when `null` |
| `next`     | `{ id, name }` or `null` | The sibling after; no button when `null`  |

Without either neighbour nothing is rendered. Both are properties only (no
attributes) — set them from the template with `.previous` / `.next`.

## Events

| Event            | `detail` | Description                                    |
| :--------------- | :------- | :--------------------------------------------- |
| `sibling-select` | `{ id }` | A button was clicked. Bubbles and is composed. |

## Usage

```js
html`<custom-sibling-navigation
  .previous=${siblings.previous}
  .next=${siblings.next}
  @sibling-select=${this.handleSiblingSelect}
></custom-sibling-navigation>`;
```

The buttons are SLDS neutral buttons; „next“ stays on the right even without a
„previous“.
