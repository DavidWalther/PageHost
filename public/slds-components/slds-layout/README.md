# slds-layout & slds-layout-item

Web components wrapping the [SLDS Grid System](https://v1.lightningdesignsystem.com/components/utilities/grid/).

Most attributes are **booleans** — add the attribute name to enable the corresponding
SLDS class (`wrap`, `gutters-small`, `bump-right`, …). The **sizes** of
`<slds-layout-item>` are the exception: they take the fraction as a **value**
(`size="1-of-2"`, `medium-size="1-of-3"`).

## Rendering: light DOM, not shadow DOM

Unlike every other `slds-*` component, both elements render into the **light DOM**
(`createRenderRoot() { return this; }`). That has three consequences worth knowing:

- There is **no shadow root** and **no wrapper `<div>`**. The SLDS classes are put
  **on the host element itself** — `<slds-layout>` _is_ the `slds-grid`, and
  `<slds-layout-item>` _is_ the `slds-col`.
- Children stay where they are; nothing is projected through a slot.
- SLDS styles are **not** injected via `addGlobalStylesToShadowRoot`. The classes
  are styled by whatever stylesheet applies in the surrounding scope — the document
  for top-level usage, or the enclosing component's shadow root.

### Why light DOM, and not a shadow root?

Not an oversight — a shadow root **cannot** work here as long as the components reuse
the SLDS grid classes, for two reasons:

1. **A CSS selector never crosses a shadow boundary.** SLDS styles columns
   contextually (`.slds-gutters .slds-col`). Put `.slds-gutters` inside a shadow root
   and `.slds-col` outside, and the rule can never match — gutters would silently die.
2. **The element carrying `slds-col` must _be_ the flex item.** Give both components a
   shadow root with inner `<div>`s and the flex item becomes the `<slds-layout-item>`
   host, while `slds-col` sits on a `div` one level deeper — `flex` and `width` would
   apply to the wrong box.

Both constraints disappear only if the components stop reusing SLDS's grid CSS and own
the rules themselves. That was decided against: SLDS is battle-tested.

### The `class` attribute belongs to the component

Because these components render into the light DOM, their `classList` is technically
open — but it is **managed by the component**. Only the documented attributes should
have an effect.

> **Do not put SLDS classes on a layout host.** Need a margin or padding? Put it on
> your own element inside the item:
>
> ```html
> <!-- nein -->
> <slds-layout-item size="1-of-1" class="slds-m-bottom_medium"
>   >…</slds-layout-item
> >
>
> <!-- ja -->
> <slds-layout-item size="1-of-1">
>   <div class="slds-m-bottom_medium">…</div>
> </slds-layout-item>
> ```
>
> `ui-tests/slds-components/slds-layout/layout-classlist-contract.spec.js` enforces
> this against the running app.

```html
<!-- what you write -->
<slds-layout wrap gutters-small>
  <slds-layout-item size="1-of-2">Left</slds-layout-item>
</slds-layout>

<!-- what ends up in the DOM -->
<slds-layout wrap gutters-small class="slds-grid slds-wrap slds-gutters_small">
  <slds-layout-item size="1-of-2" class="slds-col slds-size_1-of-2"
    >Left</slds-layout-item
  >
</slds-layout>
```

---

## `<slds-layout>`

A flex grid container: adds `slds-grid` to the host element.

### Usage

```html
<slds-layout wrap align-center gutters-small>
  <!-- slds-layout-item children -->
</slds-layout>
```

### Attributes

#### Wrapping

| Attribute | SLDS Class  | Description                     |
| --------- | ----------- | ------------------------------- |
| `wrap`    | `slds-wrap` | Allow items to wrap to next row |

#### Gutters

| Attribute          | SLDS Class              |
| ------------------ | ----------------------- |
| `gutters`          | `slds-gutters`          |
| `gutters-xx-small` | `slds-gutters_xx-small` |
| `gutters-x-small`  | `slds-gutters_x-small`  |
| `gutters-small`    | `slds-gutters_small`    |
| `gutters-medium`   | `slds-gutters_medium`   |
| `gutters-large`    | `slds-gutters_large`    |
| `gutters-xx-large` | `slds-gutters_xx-large` |

#### Horizontal Alignment

| Attribute      | SLDS Class               | Effect                      |
| -------------- | ------------------------ | --------------------------- |
| `align-center` | `slds-grid_align-center` | Center items horizontally   |
| `align-space`  | `slds-grid_align-space`  | Space items with equal gaps |
| `align-spread` | `slds-grid_align-spread` | Space-between items         |
| `align-end`    | `slds-grid_align-end`    | Push items to end           |

#### Vertical Alignment

| Attribute               | SLDS Class                        | Effect                     |
| ----------------------- | --------------------------------- | -------------------------- |
| `vertical`              | `slds-grid_vertical`              | Enables top-down alignment |
| `vertical-align-start`  | `slds-grid_vertical-align-start`  | Align items to top         |
| `vertical-align-center` | `slds-grid_vertical-align-center` | Center items vertically    |
| `vertical-align-end`    | `slds-grid_vertical-align-end`    | Align items to bottom      |

#### Direction / Reverse

| Attribute          | SLDS Class                   | Effect                                                                                                                 |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `reverse`          | `slds-grid_reverse`          | Reverse the horizontal order of items (`flex-direction: row-reverse`)                                                  |
| `reverse-vertical` | `slds-grid_vertical-reverse` | Stack items vertically in reverse order (`flex-direction: column-reverse`) — also switches the grid to a column layout |

---

## `<slds-layout-item>`

A flex child column: adds `slds-col` to the host element (light DOM, see above).

### Usage

```html
<slds-layout wrap>
  <slds-layout-item size="1-of-2" medium-size="1-of-3">...</slds-layout-item>
  <slds-layout-item size="1-of-2" medium-size="2-of-3">...</slds-layout-item>
</slds-layout>
```

### Attributes

#### Sizes

The size is a **string** naming the fraction — one attribute per breakpoint:

| Attribute     | SLDS class           | Applies from     |
| ------------- | -------------------- | ---------------- |
| `size`        | `slds-size_*`        | all widths       |
| `small-size`  | `slds-small-size_*`  | Small (≥ 480px)  |
| `medium-size` | `slds-medium-size_*` | Medium (≥ 768px) |
| `large-size`  | `slds-large-size_*`  | Large (≥ 1024px) |

```html
<slds-layout-item
  size="1-of-1"
  medium-size="1-of-2"
  large-size="1-of-4"
></slds-layout-item>
```

#### Supported fractions

Every fraction SLDS defines — that is, `{n}-of-{d}` with **`d` one of
1, 2, 3, 4, 5, 6, 7, 8, 12** and `n` from `1` to `d`. That makes 48 fractions per
breakpoint (`1-of-1`, `1-of-2`, `2-of-2`, … `12-of-12`).

A value outside that set applies **no** size class — a typo such as `size="1-of-9"`
(SLDS has no ninths) fails visibly rather than silently producing an inert class.

#### Bump (auto-margin push)

| Attribute     | SLDS Class             | Effect                           |
| ------------- | ---------------------- | -------------------------------- |
| `bump-left`   | `slds-col_bump-left`   | Push item left with auto-margin  |
| `bump-right`  | `slds-col_bump-right`  | Push item right with auto-margin |
| `bump-top`    | `slds-col_bump-top`    | Push item up with auto-margin    |
| `bump-bottom` | `slds-col_bump-bottom` | Push item down with auto-margin  |

#### Vertical Alignment (item-level)

| Attribute      | SLDS Class          | Effect                    |
| -------------- | ------------------- | ------------------------- |
| `align-top`    | `slds-align-top`    | Align content to top      |
| `align-middle` | `slds-align-middle` | Center content vertically |
| `align-bottom` | `slds-align-bottom` | Align content to bottom   |

---

## Examples

### Basic two-column layout

```html
<slds-layout wrap gutters-small>
  <slds-layout-item size="1-of-2">Left</slds-layout-item>
  <slds-layout-item size="1-of-2">Right</slds-layout-item>
</slds-layout>
```

### Responsive grid (full-width mobile, thirds on medium+)

```html
<slds-layout wrap>
  <slds-layout-item size="1-of-1" medium-size="1-of-3">Col 1</slds-layout-item>
  <slds-layout-item size="1-of-1" medium-size="1-of-3">Col 2</slds-layout-item>
  <slds-layout-item size="1-of-1" medium-size="1-of-3">Col 3</slds-layout-item>
</slds-layout>
```

### Centered layout with spread items

```html
<slds-layout align-spread vertical-align-center>
  <slds-layout-item size="1-of-4">A</slds-layout-item>
  <slds-layout-item size="1-of-4">B</slds-layout-item>
  <slds-layout-item size="1-of-4" bump-right>C</slds-layout-item>
</slds-layout>
```

### Reversed horizontal order

Items appear right-to-left while keeping the source order in the DOM.

```html
<slds-layout reverse gutters-small>
  <slds-layout-item size="1-of-3">First in DOM, last visually</slds-layout-item>
  <slds-layout-item size="1-of-3">Middle</slds-layout-item>
  <slds-layout-item size="1-of-3">Last in DOM, first visually</slds-layout-item>
</slds-layout>
```

### Reversed vertical stack

```html
<slds-layout reverse-vertical>
  <slds-layout-item>Top in DOM, shown at the bottom</slds-layout-item>
  <slds-layout-item>Bottom in DOM, shown at the top</slds-layout-item>
</slds-layout>
```
