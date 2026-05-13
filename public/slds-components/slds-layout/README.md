# slds-layout & slds-layout-item

Web components wrapping the [SLDS Grid System](https://v1.lightningdesignsystem.com/components/utilities/grid/).  
Each attribute is a **boolean** — simply add the attribute name to enable the corresponding SLDS CSS class.

---

## `<slds-layout>`

A flex grid container. Renders a `<div>` with the `slds-grid` class and a `<slot>` for layout items.

### Usage

```html
<slds-layout wrap align-center gutters-small>
  <!-- slds-layout-item children -->
</slds-layout>
```

### Attributes

#### Wrapping

| Attribute | SLDS Class  | Description                     |
|-----------|-------------|---------------------------------|
| `wrap`    | `slds-wrap` | Allow items to wrap to next row |

#### Gutters

| Attribute         | SLDS Class               |
|-------------------|--------------------------|
| `gutters`         | `slds-gutters`           |
| `gutters-xx-small`| `slds-gutters_xx-small`  |
| `gutters-x-small` | `slds-gutters_x-small`   |
| `gutters-small`   | `slds-gutters_small`     |
| `gutters-medium`  | `slds-gutters_medium`    |
| `gutters-large`   | `slds-gutters_large`     |
| `gutters-xx-large`| `slds-gutters_xx-large`  |

#### Horizontal Alignment

| Attribute      | SLDS Class                  | Effect                        |
|----------------|-----------------------------|-------------------------------|
| `align-center` | `slds-grid_align-center`    | Center items horizontally     |
| `align-space`  | `slds-grid_align-space`     | Space items with equal gaps   |
| `align-spread` | `slds-grid_align-spread`    | Space-between items           |
| `align-end`    | `slds-grid_align-end`       | Push items to end             |

#### Vertical Alignment

| Attribute              | SLDS Class                         | Effect                      |
|------------------------|------------------------------------|-----------------------------|
| `vertical-align-start` | `slds-grid_vertical-align-start`   | Align items to top          |
| `vertical-align-center`| `slds-grid_vertical-align-center`  | Center items vertically     |
| `vertical-align-end`   | `slds-grid_vertical-align-end`     | Align items to bottom       |

---

## `<slds-layout-item>`

A flex child column. Renders directly (no shadow DOM) with the `slds-col` class and a `<slot>`.

### Usage

```html
<slds-layout wrap>
  <slds-layout-item size-1-of-2 medium-size-1-of-3>...</slds-layout-item>
  <slds-layout-item size-1-of-2 medium-size-2-of-3>...</slds-layout-item>
</slds-layout>
```

### Attributes

#### Size (no breakpoint — applies at all sizes)

Attribute pattern: `size-{fraction}`  
SLDS class pattern: `slds-size_{fraction}`

#### Responsive Sizes

| Attribute prefix  | SLDS class prefix       | Breakpoint       |
|-------------------|-------------------------|------------------|
| `small-size-*`    | `slds-small-size_*`     | Small (≥480px)   |
| `medium-size-*`   | `slds-medium-size_*`    | Medium (≥768px)  |
| `large-size-*`    | `slds-large-size_*`     | Large (≥1024px)  |

#### Supported Fractions

The following fractions are supported for all four breakpoint prefixes (`size-*`, `small-size-*`, `medium-size-*`, `large-size-*`):

| Fraction   | Column width      |
|------------|-------------------|
| `1-of-1`   | 100%              |
| `1-of-2`   | 50%               |
| `1-of-3`   | 33.33%            |
| `2-of-3`   | 66.67%            |
| `1-of-4`   | 25%               |
| `2-of-4`   | 50%               |
| `3-of-4`   | 75%               |
| `1-of-5`   | 20%               |
| `2-of-5`   | 40%               |
| `3-of-5`   | 60%               |
| `4-of-5`   | 80%               |
| `1-of-6`   | 16.67%            |
| `2-of-6`   | 33.33%            |
| `3-of-6`   | 50%               |
| `4-of-6`   | 66.67%            |
| `5-of-6`   | 83.33%            |
| `1-of-8`   | 12.5%             |
| `2-of-8`   | 25%               |
| `3-of-8`   | 37.5%             |
| `4-of-8`   | 50%               |
| `5-of-8`   | 62.5%             |
| `6-of-8`   | 75%               |
| `7-of-8`   | 87.5%             |
| `1-of-12`  | 8.33%             |
| `2-of-12`  | 16.67%            |
| `3-of-12`  | 25%               |
| `4-of-12`  | 33.33%            |
| `5-of-12`  | 41.67%            |
| `6-of-12`  | 50%               |
| `7-of-12`  | 58.33%            |
| `8-of-12`  | 66.67%            |
| `9-of-12`  | 75%               |
| `10-of-12` | 83.33%            |
| `11-of-12` | 91.67%            |
| `12-of-12` | 100%              |

#### Bump (auto-margin push)

| Attribute     | SLDS Class           | Effect                        |
|---------------|----------------------|-------------------------------|
| `bump-left`   | `slds-col_bump-left` | Push item left with auto-margin |
| `bump-right`  | `slds-col_bump-right`| Push item right with auto-margin|
| `bump-top`    | `slds-col_bump-top`  | Push item up with auto-margin  |
| `bump-bottom` | `slds-col_bump-bottom`| Push item down with auto-margin|

#### Vertical Alignment (item-level)

| Attribute      | SLDS Class          | Effect                   |
|----------------|---------------------|--------------------------|
| `align-top`    | `slds-align-top`    | Align content to top     |
| `align-middle` | `slds-align-middle` | Center content vertically|
| `align-bottom` | `slds-align-bottom` | Align content to bottom  |

---

## Examples

### Basic two-column layout

```html
<slds-layout wrap gutters-small>
  <slds-layout-item size-1-of-2>Left</slds-layout-item>
  <slds-layout-item size-1-of-2>Right</slds-layout-item>
</slds-layout>
```

### Responsive grid (full-width mobile, thirds on medium+)

```html
<slds-layout wrap>
  <slds-layout-item size-1-of-1 medium-size-1-of-3>Col 1</slds-layout-item>
  <slds-layout-item size-1-of-1 medium-size-1-of-3>Col 2</slds-layout-item>
  <slds-layout-item size-1-of-1 medium-size-1-of-3>Col 3</slds-layout-item>
</slds-layout>
```

### Centered layout with spread items

```html
<slds-layout align-spread vertical-align-center>
  <slds-layout-item size-1-of-4>A</slds-layout-item>
  <slds-layout-item size-1-of-4>B</slds-layout-item>
  <slds-layout-item size-1-of-4 bump-right>C</slds-layout-item>
</slds-layout>
```
