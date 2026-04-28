---
name: slds-v1
description: Build, style, and audit UI components using the Salesforce Lightning Design System v1 (SLDS). Provides HTML blueprint patterns, CSS class naming conventions, icon sprite usage, layout utilities, design tokens, and accessibility guidance for all 85+ SLDS components.
when_to_use: Triggered by requests like "create an SLDS button", "use SLDS card markup", "apply Lightning Design System styles", "what's the SLDS class for a badge", "add an SLDS spinner", "use SLDS form elements", "apply SLDS grid layout", or any mention of SLDS, Salesforce Lightning Design System, or slds-*.
---

# SLDS v1 — Salesforce Lightning Design System

SLDS is a framework-agnostic CSS design system used to build Salesforce-consistent enterprise UI. Every component is a pure HTML + CSS **blueprint** — no JavaScript framework required. Components use a strict BEM-derived class naming convention and rely on a single stylesheet.

For detailed class references, see `REFERENCE.md`.
For HTML blueprint examples, see `examples/components.md`.
For design token values, see `examples/tokens.md`.

---

## 1. Loading the Stylesheet

### CDN (no build step)
```html
<link rel="stylesheet"
  href="https://v1.lightningdesignsystem.com/assets/styles/salesforce-lightning-design-system.css" />
```

### npm package (already installed in this project)
```html
<!-- Served from node_modules or copied to public/assets -->
<link rel="stylesheet"
  href="/assets/styles/salesforce-lightning-design-system.css" />
```

The npm package `@salesforce-ux/design-system` is available at:
```
node_modules/@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css
```

---

## 2. CSS Naming Convention

SLDS uses a BEM-derived convention with the `slds-` prefix:

| Pattern | Meaning | Example |
|---|---|---|
| `slds-[component]` | Root element | `slds-button` |
| `slds-[component]__[element]` | Child element (double underscore) | `slds-card__header` |
| `slds-[component]_[modifier]` | Modifier / variant (single underscore) | `slds-button_brand` |
| `slds-[utility]` | Utility class (spacing, layout, etc.) | `slds-m-top_small` |

**Legacy note:** Older SLDS markup sometimes uses double-hyphen (`slds-button--brand`). Both forms may appear; prefer the single-underscore form.

---

## 3. Icon Sprite System

SLDS uses SVG sprite sheets. Icons live in four sprite sets:

| Sprite | Path | Use for |
|---|---|---|
| `utility` | `/assets/icons/utility-sprite/svg/symbols.svg` | General UI icons (most common) |
| `standard` | `/assets/icons/standard-sprite/svg/symbols.svg` | Object icons (account, contact…) |
| `action` | `/assets/icons/action-sprite/svg/symbols.svg` | Action icons (new, edit, delete…) |
| `doctype` | `/assets/icons/doctype-sprite/svg/symbols.svg` | File-type icons |

### Icon markup pattern
```html
<span class="slds-icon_container slds-icon-utility-settings">
  <svg class="slds-icon slds-icon_small" aria-hidden="true">
    <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#settings"></use>
  </svg>
  <span class="slds-assistive-text">Settings</span>
</span>
```

Icon size modifiers: `slds-icon_xx-small`, `slds-icon_x-small`, `slds-icon_small`, `slds-icon_large`

---

## 4. Layout Utilities

### Grid System
SLDS uses a 12-column flexbox grid:

```html
<div class="slds-grid slds-wrap">
  <div class="slds-col slds-size_1-of-2">Left half</div>
  <div class="slds-col slds-size_1-of-2">Right half</div>
</div>
```

Key grid classes:
- `slds-grid` — flex container (horizontal)
- `slds-grid_vertical` — flex container (vertical)
- `slds-grid_align-center` / `_align-spread` / `_align-end`
- `slds-grid_vertical-align-center`
- `slds-col` — flex child
- `slds-col_bump-left` / `_bump-right` — push item to edge with `margin: auto`
- `slds-wrap` — allow wrapping

### Sizing
```
slds-size_1-of-1   slds-size_1-of-2   slds-size_1-of-3
slds-size_2-of-3   slds-size_1-of-4   slds-size_3-of-4
slds-size_1-of-5   …up to 1-of-12
```

Responsive prefixes: `slds-small-size_*`, `slds-medium-size_*`, `slds-large-size_*`

### Spacing Utilities

Pattern: `slds-{m|p}-{sides}_{size}`

Sides: `top`, `right`, `bottom`, `left`, `horizontal`, `vertical`, `around`
Sizes: `xxx-small` (2px), `xx-small` (4px), `x-small` (8px), `small` (12px), `medium` (16px), `large` (24px), `x-large` (32px), `xx-large` (48px)

```html
<div class="slds-m-top_medium slds-p-around_small">...</div>
```

Remove all spacing: `slds-m-around_none`, `slds-p-top_none`, etc.

---

## 5. Typography Utilities

```
slds-text-heading_large    slds-text-heading_medium    slds-text-heading_small
slds-text-title            slds-text-title_caps
slds-text-body_regular     slds-text-body_small
slds-text-color_default    slds-text-color_weak        slds-text-color_error
slds-text-align_left       slds-text-align_center      slds-text-align_right
slds-truncate              slds-truncate_container_*   slds-assistive-text
```

---

## 6. State & Visibility Utilities

```
slds-hide           hidden via display:none
slds-show           explicit display:block
slds-show_inline-block
slds-is-open        open state (menus, dropdowns)
slds-is-active      active/selected state
slds-is-disabled    disabled state
slds-has-error      error state on form elements
slds-has-focus      focused state
slds-transition-hide / slds-transition-show
```

---

## 7. Accessibility Requirements

- Always add `aria-hidden="true"` on decorative SVG icons
- Provide `<span class="slds-assistive-text">` for icon-only buttons
- Use `role="dialog"` and `aria-modal="true"` on modal containers
- Form elements must have associated `<label>` via `for`/`id` or `aria-labelledby`
- Disabled elements: use both the `disabled` attribute and `slds-is-disabled` class on wrapper where needed
- Live regions: use `aria-live="assertive"` for toast/alert notifications

---

## 8. Common Component Patterns (quick reference)

### Button variants
```
slds-button                      base (unstyled)
slds-button + slds-button_neutral   neutral (bordered)
slds-button + slds-button_brand     brand (blue filled)
slds-button + slds-button_outline-brand  brand outline
slds-button + slds-button_destructive   destructive (red)
slds-button + slds-button_inverse   inverse (white on dark)
slds-button + slds-button_icon      icon-only button
```

### Form element wrapper
Every form field is wrapped in `.slds-form-element`:
```html
<div class="slds-form-element [slds-has-error]">
  <label class="slds-form-element__label" for="field-id">Label</label>
  <div class="slds-form-element__control">
    <!-- input, select, textarea, etc. -->
  </div>
  <!-- optional: error message -->
  <p class="slds-form-element__help">Error message</p>
</div>
```

### Scoped component
Wrap SLDS HTML in a container with the `slds-scope` class to avoid bleeding into non-SLDS areas:
```html
<div class="slds-scope">
  <!-- SLDS components here -->
</div>
```
