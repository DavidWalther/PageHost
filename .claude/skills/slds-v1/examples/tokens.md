# SLDS v1 Design Token Usage

Design tokens are the atomic building blocks of the SLDS visual design system. This file covers how to consume tokens in your own CSS/SCSS, the full token catalog by category, and practical usage patterns.

---

## How Tokens Work

### CSS Custom Properties (modern approach)

The SLDS stylesheet defines tokens as CSS custom properties on `:root`. You can reference them directly:

```css
.my-component {
  background-color: var(--slds-g-color-brand-base-60);
  border-color: var(--slds-g-color-border-base-1);
  color: var(--slds-g-color-neutral-base-10);
}
```

### SCSS Variables (build pipeline)

If you use SCSS with the `@salesforce-ux/design-system` npm package:

```scss
// Import SLDS token maps
@import '~@salesforce-ux/design-system/scss/index.scss';

.my-component {
  background-color: $brand-accessible;     // #0176d3
  color: $color-text-default;              // #080707
  border: 1px solid $color-border;        // #dddbda
}
```

### JavaScript (token values)

```js
// Token values are available in the design-tokens directory
// node_modules/@salesforce-ux/design-system/design-tokens/
// Individual token files: aliases/colors.yml, components.yml, etc.
```

---

## Color Tokens

### Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `--slds-g-color-brand-base-60` | `#1b96ff` | Primary brand (buttons, links) |
| `--slds-g-color-brand-base-50` | `#0176d3` | Active/hover brand |
| `--slds-g-color-brand-base-40` | `#0b5cab` | Dark brand |
| `--slds-g-color-brand-base-30` | `#014486` | Darker brand |
| `--slds-g-color-brand-base-20` | `#032d60` | Darkest brand |
| `--slds-g-color-brand-base-80` | `#aacbff` | Light brand |
| `--slds-g-color-brand-base-90` | `#d8e6fe` | Lightest brand bg |
| `--slds-g-color-brand-base-95` | `#eef4ff` | Near-white brand bg |

**Usage:**
```css
/* Primary action / interactive element */
.my-button { background-color: var(--slds-g-color-brand-base-60); }
/* Hover state */
.my-button:hover { background-color: var(--slds-g-color-brand-base-50); }
/* Brand tinted background */
.my-header { background-color: var(--slds-g-color-brand-base-95); }
```

---

### Neutral / Gray Colors

| Token | Hex | Usage |
|---|---|---|
| `--slds-g-color-neutral-base-10` | `#181818` | Near-black text |
| `--slds-g-color-neutral-base-20` | `#2e2e2e` | Dark text |
| `--slds-g-color-neutral-base-30` | `#444444` | Secondary text |
| `--slds-g-color-neutral-base-40` | `#5c5c5c` | Muted text |
| `--slds-g-color-neutral-base-50` | `#747474` | Placeholder text |
| `--slds-g-color-neutral-base-60` | `#939393` | Disabled text |
| `--slds-g-color-neutral-base-70` | `#aeaeae` | Light gray |
| `--slds-g-color-neutral-base-80` | `#c9c9c9` | Borders |
| `--slds-g-color-neutral-base-90` | `#e5e5e5` | Subtle borders |
| `--slds-g-color-neutral-base-95` | `#f3f3f3` | Light background |
| `--slds-g-color-neutral-base-100` | `#ffffff` | White |

**Usage:**
```css
/* Body text */
.my-text { color: var(--slds-g-color-neutral-base-10); }
/* Muted/helper text */
.my-meta { color: var(--slds-g-color-neutral-base-50); }
/* Card background */
.my-card { background-color: var(--slds-g-color-neutral-base-100); }
/* Subtle section background */
.my-section { background-color: var(--slds-g-color-neutral-base-95); }
/* Default border */
.my-input { border-color: var(--slds-g-color-neutral-base-80); }
```

---

### Status Colors

#### Error

| Token | Hex | Usage |
|---|---|---|
| `--slds-g-color-error-base-50` | `#ea001e` | Error text / icons |
| `--slds-g-color-error-base-40` | `#ba0517` | Dark error |
| `--slds-g-color-error-base-60` | `#fe5c4c` | Bright error |
| `--slds-g-color-error-base-80` | `#feb8ab` | Light error |
| `--slds-g-color-error-base-90` | `#feded8` | Error background tint |

```css
.my-error-text { color: var(--slds-g-color-error-base-50); }
.my-error-bg   { background-color: var(--slds-g-color-error-base-90); }
```

#### Warning

| Token | Hex | Usage |
|---|---|---|
| `--slds-g-color-warning-base-50` | `#a96404` | Warning text |
| `--slds-g-color-warning-base-60` | `#dd7a01` | Warning icons |
| `--slds-g-color-warning-base-70` | `#fe9339` | Bright warning |
| `--slds-g-color-warning-base-80` | `#ffba90` | Light warning |
| `--slds-g-color-warning-base-90` | `#fedfd0` | Warning background tint |

```css
.my-warning-text { color: var(--slds-g-color-warning-base-50); }
.my-warning-bg   { background-color: var(--slds-g-color-warning-base-90); }
```

#### Success

| Token | Hex | Usage |
|---|---|---|
| `--slds-g-color-success-base-50` | `#2e844a` | Success text |
| `--slds-g-color-success-base-60` | `#3ba755` | Success icons |
| `--slds-g-color-success-base-70` | `#45c65a` | Bright success |
| `--slds-g-color-success-base-80` | `#91db8b` | Light success |
| `--slds-g-color-success-base-90` | `#cdefc4` | Success background tint |

```css
.my-success-text { color: var(--slds-g-color-success-base-50); }
.my-success-bg   { background-color: var(--slds-g-color-success-base-90); }
```

---

### Border Colors

| Token | Hex | Usage |
|---|---|---|
| `--slds-g-color-border-base-1` | `#c9c9c9` | Default border (lightest) |
| `--slds-g-color-border-base-2` | `#aeaeae` | Medium border |
| `--slds-g-color-border-base-3` | `#939393` | Stronger border |
| `--slds-g-color-border-base-4` | `#747474` | Strong/focus border |
| `--slds-g-color-border-brand-1` | `#78b0fd` | Brand border (light) |
| `--slds-g-color-border-brand-2` | `#1b96ff` | Brand border |

```css
/* Default input border */
.my-input {
  border: 1px solid var(--slds-g-color-border-base-1);
}
/* Focus state */
.my-input:focus {
  border-color: var(--slds-g-color-border-brand-2);
  box-shadow: 0 0 3px var(--slds-g-color-border-brand-1);
}
```

---

### Link Colors

```css
a { color: var(--slds-g-link-color); }             /* #0b5cab */
a:hover { color: var(--slds-g-link-color-hover); } /* #014486 */
a:focus { color: var(--slds-g-link-color-focus); } /* #014486 */
a:active { color: var(--slds-g-link-color-active); } /* #032d60 */
```

---

## Spacing Scale

SLDS uses a consistent spacing scale. The utility classes (`slds-m-*`, `slds-p-*`) are the preferred way to apply spacing, but you can use the values directly in custom CSS:

| Utility suffix | rem | px |
|---|---|---|
| `xxx-small` | 0.125rem | 2px |
| `xx-small` | 0.25rem | 4px |
| `x-small` | 0.5rem | 8px |
| `small` | 0.75rem | 12px |
| `medium` | 1rem | 16px |
| `large` | 1.5rem | 24px |
| `x-large` | 2rem | 32px |
| `xx-large` | 3rem | 48px |

```css
/* Using spacing values directly */
.my-component {
  padding: 1rem;          /* medium */
  margin-bottom: 1.5rem;  /* large */
  gap: 0.5rem;            /* x-small */
}
```

---

## Typography Scale

| SLDS class | Font size | Weight | Usage |
|---|---|---|---|
| `slds-text-heading_large` | 1.75rem (28px) | 300 | Page-level headings |
| `slds-text-heading_medium` | 1.25rem (20px) | 300 | Section headings |
| `slds-text-heading_small` | 1rem (16px) | 700 | Component headings |
| `slds-text-title` | 0.875rem (14px) | 700 | Titles |
| `slds-text-title_caps` | 0.75rem (12px) | 700 uppercase | Category labels |
| `slds-text-body_regular` | 0.8125rem (13px) | 400 | Default body text |
| `slds-text-body_small` | 0.75rem (12px) | 400 | Small body / meta text |

```html
<h1 class="slds-text-heading_large">Page Title</h1>
<h2 class="slds-text-heading_medium">Section Title</h2>
<h3 class="slds-text-heading_small">Component Title</h3>
<p class="slds-text-body_regular">Body text content.</p>
<span class="slds-text-body_small slds-text-color_weak">Meta text</span>
<span class="slds-text-title_caps">CATEGORY LABEL</span>
```

---

## Applying Tokens in Custom Components

### Pattern: Themed component using tokens

```html
<style>
  .my-status-banner {
    background-color: var(--slds-g-color-success-base-90);
    border-left: 4px solid var(--slds-g-color-success-base-50);
    color: var(--slds-g-color-success-base-40);
    padding: 0.75rem 1rem;
    border-radius: 0.25rem;
  }
</style>
<div class="my-status-banner">
  <strong>Success:</strong> Your changes have been saved.
</div>
```

### Pattern: Form input using tokens

```html
<style>
  .my-input {
    border: 1px solid var(--slds-g-color-border-base-1);
    border-radius: 0.25rem;
    padding: 0 0.75rem;
    height: 2rem;
    font-size: 0.8125rem;
    color: var(--slds-g-color-neutral-base-10);
    background-color: var(--slds-g-color-neutral-base-100);
    transition: border-color 0.15s ease;
  }
  .my-input:focus {
    outline: none;
    border-color: var(--slds-g-color-border-brand-2);
    box-shadow: 0 0 3px var(--slds-g-color-border-brand-1);
  }
  .my-input:disabled {
    background-color: var(--slds-g-color-neutral-base-95);
    color: var(--slds-g-color-neutral-base-60);
    border-color: var(--slds-g-color-border-base-1);
    cursor: not-allowed;
  }
</style>
<input class="my-input" type="text" placeholder="Enter value..." />
```

### Pattern: Data card using tokens

```html
<style>
  .metric-card {
    background: var(--slds-g-color-neutral-base-100);
    border: 1px solid var(--slds-g-color-border-base-1);
    border-radius: 0.25rem;
    padding: 1.5rem;
  }
  .metric-card__value {
    font-size: 1.75rem;
    font-weight: 300;
    color: var(--slds-g-color-brand-base-50);
  }
  .metric-card__label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.0625rem;
    color: var(--slds-g-color-neutral-base-50);
  }
</style>
<div class="metric-card">
  <p class="metric-card__label">Total Cases</p>
  <p class="metric-card__value">1,284</p>
</div>
```
