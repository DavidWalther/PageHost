# SLDS v1 Component HTML Blueprints

Complete HTML blueprint examples for the most commonly used SLDS v1 components. All examples require the SLDS stylesheet to be loaded. See `SKILL.md` for setup instructions.

---

## Buttons

### Base (unstyled)
```html
<button class="slds-button">Label</button>
```

### Neutral
```html
<button class="slds-button slds-button_neutral">Neutral</button>
```

### Brand (primary action)
```html
<button class="slds-button slds-button_brand">Save</button>
```

### Brand Outline
```html
<button class="slds-button slds-button_outline-brand">Cancel</button>
```

### Destructive
```html
<button class="slds-button slds-button_destructive">Delete</button>
```

### Text Destructive
```html
<button class="slds-button slds-button_text-destructive">Remove</button>
```

### Success
```html
<button class="slds-button slds-button_success">Approve</button>
```

### Inverse (on dark background)
```html
<div class="slds-theme_inverse slds-p-around_medium">
  <button class="slds-button slds-button_inverse">Inverse</button>
</div>
```

### Disabled
```html
<button class="slds-button slds-button_brand" disabled>Disabled</button>
```

### Button with left icon
```html
<button class="slds-button slds-button_neutral">
  <svg class="slds-button__icon slds-button__icon_left" aria-hidden="true">
    <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#add"></use>
  </svg>
  Add
</button>
```

### Button with right icon
```html
<button class="slds-button slds-button_neutral">
  New
  <svg class="slds-button__icon slds-button__icon_right" aria-hidden="true">
    <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
  </svg>
</button>
```

### Icon-only button (bare)
```html
<button class="slds-button slds-button_icon" title="Settings">
  <svg class="slds-button__icon" aria-hidden="true">
    <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#settings"></use>
  </svg>
  <span class="slds-assistive-text">Settings</span>
</button>
```

### Icon-only button (bordered)
```html
<button class="slds-button slds-button_icon slds-button_icon-border" title="More">
  <svg class="slds-button__icon" aria-hidden="true">
    <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#down"></use>
  </svg>
  <span class="slds-assistive-text">More</span>
</button>
```

### Button Group
```html
<div class="slds-button-group" role="group">
  <button class="slds-button slds-button_neutral">Refresh</button>
  <button class="slds-button slds-button_neutral">Edit</button>
  <button class="slds-button slds-button_neutral slds-button_last">Save</button>
</div>
```

---

## Cards

### Base card
```html
<article class="slds-card">
  <div class="slds-card__header slds-grid">
    <header class="slds-media slds-media_center slds-has-flexi-truncate">
      <div class="slds-media__figure">
        <span class="slds-icon_container slds-icon-standard-contact">
          <svg class="slds-icon slds-icon_small" aria-hidden="true">
            <use xlink:href="/assets/icons/standard-sprite/svg/symbols.svg#contact"></use>
          </svg>
        </span>
      </div>
      <div class="slds-media__body">
        <h2 class="slds-card__header-title">
          <a href="#" class="slds-card__header-link slds-truncate" title="Card Title">Card Title</a>
        </h2>
      </div>
    </header>
    <div class="slds-no-flex">
      <button class="slds-button slds-button_neutral">New</button>
    </div>
  </div>
  <div class="slds-card__body slds-card__body_inner">
    <p>Card body content goes here.</p>
  </div>
  <footer class="slds-card__footer">
    <a class="slds-card__footer-action" href="#">View All <span class="slds-assistive-text">Contacts</span></a>
  </footer>
</article>
```

### Card without footer
```html
<article class="slds-card">
  <div class="slds-card__header slds-grid">
    <header class="slds-media slds-media_center slds-has-flexi-truncate">
      <div class="slds-media__body">
        <h2 class="slds-card__header-title">Simple Card</h2>
      </div>
    </header>
  </div>
  <div class="slds-card__body slds-card__body_inner">
    Content goes here.
  </div>
</article>
```

---

## Badges

### Base
```html
<span class="slds-badge">Default</span>
```

### Inverse (dark)
```html
<span class="slds-badge slds-badge_inverse">Inverse</span>
```

### Lightest
```html
<span class="slds-badge slds-badge_lightest">Lightest</span>
```

### With icon (left)
```html
<span class="slds-badge slds-badge_lightest">
  <span class="slds-badge__icon slds-badge__icon_left slds-badge__icon_inverse">
    <span class="slds-icon_container slds-icon-utility-moneybag slds-current-color">
      <svg class="slds-icon slds-icon_xx-small" aria-hidden="true">
        <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#moneybag"></use>
      </svg>
    </span>
  </span>
  Badge Label
</span>
```

---

## Alerts

### Info alert (banner)
```html
<div class="slds-notify_container slds-is-relative">
  <div class="slds-notify slds-notify_alert slds-theme_info" role="alert">
    <span class="slds-assistive-text">Info</span>
    <span class="slds-icon_container slds-icon-utility-info slds-m-right_x-small">
      <svg class="slds-icon slds-icon_x-small" aria-hidden="true">
        <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#info"></use>
      </svg>
    </span>
    <h2>This is an informational alert.</h2>
    <button class="slds-button slds-button_icon slds-button_icon-inverse slds-notify__close" title="Close">
      <svg class="slds-button__icon slds-button__icon_large" aria-hidden="true">
        <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
      </svg>
      <span class="slds-assistive-text">Close</span>
    </button>
  </div>
</div>
```

### Error alert
```html
<div class="slds-notify_container slds-is-relative">
  <div class="slds-notify slds-notify_alert slds-theme_error" role="alert">
    <span class="slds-assistive-text">Error</span>
    <h2>Something went wrong. Please try again.</h2>
    <button class="slds-button slds-button_icon slds-button_icon-inverse slds-notify__close" title="Close">
      <svg class="slds-button__icon slds-button__icon_large" aria-hidden="true">
        <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
      </svg>
      <span class="slds-assistive-text">Close</span>
    </button>
  </div>
</div>
```

---

## Toast Notifications

### Success toast
```html
<div class="slds-notify-container">
  <div class="slds-notify slds-notify_toast slds-theme_success" role="status">
    <span class="slds-assistive-text">Success</span>
    <span class="slds-icon_container slds-icon-utility-success slds-m-right_small slds-no-flex slds-align-top">
      <svg class="slds-icon slds-icon_small" aria-hidden="true">
        <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#success"></use>
      </svg>
    </span>
    <div class="slds-notify__content">
      <h2 class="slds-text-heading_small">Record saved successfully.</h2>
    </div>
    <div class="slds-notify__close">
      <button class="slds-button slds-button_icon slds-button_icon-inverse slds-button_icon-small" title="Close">
        <svg class="slds-button__icon slds-button__icon_large" aria-hidden="true">
          <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
        </svg>
        <span class="slds-assistive-text">Close</span>
      </button>
    </div>
  </div>
</div>
```

### Error toast
```html
<div class="slds-notify-container">
  <div class="slds-notify slds-notify_toast slds-theme_error" role="alert">
    <span class="slds-assistive-text">Error</span>
    <div class="slds-notify__content">
      <h2 class="slds-text-heading_small">An error occurred.</h2>
    </div>
    <div class="slds-notify__close">
      <button class="slds-button slds-button_icon slds-button_icon-inverse slds-button_icon-small" title="Close">
        <svg class="slds-button__icon slds-button__icon_large" aria-hidden="true">
          <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
        </svg>
        <span class="slds-assistive-text">Close</span>
      </button>
    </div>
  </div>
</div>
```

---

## Form Elements

### Text input
```html
<div class="slds-form-element">
  <label class="slds-form-element__label" for="text-input-id">
    <abbr class="slds-required" title="required">*</abbr> First Name
  </label>
  <div class="slds-form-element__control">
    <input type="text" id="text-input-id" placeholder="Jane" class="slds-input" required />
  </div>
</div>
```

### Text input with error
```html
<div class="slds-form-element slds-has-error">
  <label class="slds-form-element__label" for="text-input-error">Email</label>
  <div class="slds-form-element__control">
    <input type="email" id="text-input-error" class="slds-input" value="invalid" aria-describedby="error-msg" />
  </div>
  <p class="slds-form-element__help" id="error-msg" role="alert">Enter a valid email address.</p>
</div>
```

### Input with left icon
```html
<div class="slds-form-element">
  <label class="slds-form-element__label" for="search-input">Search</label>
  <div class="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
    <svg class="slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default" aria-hidden="true">
      <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#search"></use>
    </svg>
    <input type="search" id="search-input" class="slds-input" placeholder="Search..." />
  </div>
</div>
```

### Select
```html
<div class="slds-form-element">
  <label class="slds-form-element__label" for="select-id">Status</label>
  <div class="slds-form-element__control">
    <div class="slds-select_container">
      <select class="slds-select" id="select-id">
        <option value="">Select an option</option>
        <option value="new">New</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>
    </div>
  </div>
</div>
```

### Textarea
```html
<div class="slds-form-element">
  <label class="slds-form-element__label" for="textarea-id">Description</label>
  <div class="slds-form-element__control">
    <textarea id="textarea-id" class="slds-textarea" placeholder="Add notes here..."></textarea>
  </div>
</div>
```

### Checkbox
```html
<div class="slds-form-element">
  <div class="slds-form-element__control">
    <span class="slds-checkbox">
      <input type="checkbox" name="checkbox" id="checkbox-id" />
      <label class="slds-checkbox__label" for="checkbox-id">
        <span class="slds-checkbox_faux"></span>
        <span class="slds-form-element__label">I agree to the terms</span>
      </label>
    </span>
  </div>
</div>
```

### Checkbox Toggle
```html
<div class="slds-form-element">
  <label class="slds-checkbox_toggle slds-grid" for="toggle-id">
    <span class="slds-form-element__label slds-m-bottom_none">Enable Feature</span>
    <input type="checkbox" name="toggle" id="toggle-id" aria-describedby="toggle-id" />
    <span class="slds-checkbox_faux_container" aria-live="assertive">
      <span class="slds-checkbox_faux"></span>
      <span class="slds-checkbox_on">Enabled</span>
      <span class="slds-checkbox_off">Disabled</span>
    </span>
  </label>
</div>
```

### Radio Group
```html
<fieldset class="slds-form-element">
  <legend class="slds-form-element__legend slds-form-element__label">Frequency</legend>
  <div class="slds-form-element__control">
    <span class="slds-radio">
      <input type="radio" name="frequency" id="radio-daily" value="daily" />
      <label class="slds-radio__label" for="radio-daily">
        <span class="slds-radio_faux"></span>
        <span class="slds-form-element__label">Daily</span>
      </label>
    </span>
    <span class="slds-radio">
      <input type="radio" name="frequency" id="radio-weekly" value="weekly" />
      <label class="slds-radio__label" for="radio-weekly">
        <span class="slds-radio_faux"></span>
        <span class="slds-form-element__label">Weekly</span>
      </label>
    </span>
  </div>
</fieldset>
```

---

## Spinners

### Medium spinner (default)
```html
<div class="slds-spinner_container">
  <div role="status" class="slds-spinner slds-spinner_medium slds-spinner_brand">
    <span class="slds-assistive-text">Loading</span>
    <div class="slds-spinner__dot-a"></div>
    <div class="slds-spinner__dot-b"></div>
  </div>
</div>
```

### Small inline spinner
```html
<div role="status" class="slds-spinner slds-spinner_small slds-spinner_inline">
  <span class="slds-assistive-text">Loading</span>
  <div class="slds-spinner__dot-a"></div>
  <div class="slds-spinner__dot-b"></div>
</div>
```

### Spinner sizes
```
slds-spinner_xx-small   slds-spinner_x-small   slds-spinner_small
slds-spinner_medium     slds-spinner_large
```

### Spinner variants
```
slds-spinner_brand      (blue)
slds-spinner_inverse    (white, for dark backgrounds)
```

---

## Modals

```html
<!-- Backdrop -->
<div class="slds-backdrop slds-backdrop_open" role="presentation"></div>

<!-- Modal -->
<section role="dialog" tabindex="-1" aria-modal="true" aria-label="Modal Title" class="slds-modal slds-fade-in-open">
  <div class="slds-modal__container">
    <!-- Header -->
    <header class="slds-modal__header">
      <button class="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" title="Close">
        <svg class="slds-button__icon slds-button__icon_large" aria-hidden="true">
          <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
        </svg>
        <span class="slds-assistive-text">Close</span>
      </button>
      <h1 class="slds-text-heading_medium slds-hyphenate">Modal Title</h1>
    </header>
    <!-- Body -->
    <div class="slds-modal__content slds-p-around_medium">
      <p>Modal content goes here.</p>
    </div>
    <!-- Footer -->
    <footer class="slds-modal__footer">
      <button class="slds-button slds-button_neutral">Cancel</button>
      <button class="slds-button slds-button_brand">Save</button>
    </footer>
  </div>
</section>
```

### Modal size variants
```
slds-modal               default (small)
slds-modal slds-modal_medium
slds-modal slds-modal_large
slds-modal slds-modal_full   (full screen)
```

---

## Data Tables

### Basic table
```html
<table class="slds-table slds-table_cell-buffer slds-table_bordered" role="grid">
  <thead>
    <tr class="slds-line-height_reset">
      <th scope="col">
        <div class="slds-truncate" title="Name">Name</div>
      </th>
      <th scope="col">
        <div class="slds-truncate" title="Status">Status</div>
      </th>
      <th scope="col">
        <div class="slds-truncate" title="Date">Date</div>
      </th>
    </tr>
  </thead>
  <tbody>
    <tr class="slds-hint-parent">
      <th scope="row" data-label="Name">
        <div class="slds-truncate" title="John Doe">
          <a href="#">John Doe</a>
        </div>
      </th>
      <td data-label="Status">
        <div class="slds-truncate" title="Active">Active</div>
      </td>
      <td data-label="Date">
        <div class="slds-truncate" title="2024-01-15">2024-01-15</div>
      </td>
    </tr>
  </tbody>
</table>
```

### Table modifier classes
```
slds-table_fixed-layout    fixed column widths (requires th widths)
slds-table_bordered        borders on all cells
slds-table_striped         alternating row background
slds-table_cell-buffer     default cell padding
slds-table_col-bordered    borders between columns only
```

---

## Avatars

### Image avatar
```html
<span class="slds-avatar slds-avatar_medium">
  <img src="/path/to/avatar.jpg" alt="User Name" title="User Name" />
</span>
```

### Initials avatar
```html
<span class="slds-avatar slds-avatar_medium slds-avatar_circle">
  <abbr class="slds-avatar__initials slds-icon-standard-account" title="John Doe">JD</abbr>
</span>
```

### Avatar sizes
```
slds-avatar_x-small   (24px)
slds-avatar_small     (32px)
slds-avatar_medium    (40px) — default
slds-avatar_large     (48px)
```

---

## Pills

### Base pill
```html
<span class="slds-pill">
  <a href="#" class="slds-pill__action" title="Pill Label">
    <span class="slds-pill__label">Pill Label</span>
  </a>
  <button class="slds-button slds-button_icon slds-button_icon slds-pill__remove" title="Remove">
    <svg class="slds-button__icon slds-button__icon_hint" aria-hidden="true">
      <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
    </svg>
    <span class="slds-assistive-text">Remove Pill Label</span>
  </button>
</span>
```

### Pill container
```html
<div class="slds-pill-container">
  <span class="slds-pill">
    <a href="#" class="slds-pill__action" title="Tag 1">
      <span class="slds-pill__label">Tag 1</span>
    </a>
    <button class="slds-button slds-button_icon slds-pill__remove" title="Remove Tag 1">
      <svg class="slds-button__icon" aria-hidden="true">
        <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
      </svg>
      <span class="slds-assistive-text">Remove Tag 1</span>
    </button>
  </span>
</div>
```

---

## Progress Indicator

```html
<div class="slds-progress slds-progress_shade">
  <ol class="slds-progress__list">
    <li class="slds-progress__item slds-is-completed">
      <button class="slds-button slds-progress__marker" title="Step 1 - Completed">
        <span class="slds-assistive-text">Step 1 - Completed</span>
      </button>
    </li>
    <li class="slds-progress__item slds-is-active">
      <button class="slds-button slds-progress__marker" title="Step 2 - Active">
        <span class="slds-assistive-text">Step 2 - Active</span>
      </button>
    </li>
    <li class="slds-progress__item">
      <button class="slds-button slds-progress__marker" title="Step 3">
        <span class="slds-assistive-text">Step 3</span>
      </button>
    </li>
  </ol>
  <div class="slds-progress-bar slds-progress-bar_x-small" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" role="progressbar">
    <span class="slds-progress-bar__value" style="width: 50%;">
      <span class="slds-assistive-text">Progress: 50%</span>
    </span>
  </div>
</div>
```

---

## Scoped Notification

```html
<div class="slds-scoped-notification slds-media slds-media_center slds-scoped-notification_light" role="status">
  <div class="slds-media__figure">
    <span class="slds-icon_container slds-icon-utility-info slds-icon-utility-info slds-icon_container_circle slds-scoped-notification__icon">
      <svg class="slds-icon slds-icon_small slds-icon-text-default" aria-hidden="true">
        <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#info"></use>
      </svg>
    </span>
  </div>
  <div class="slds-media__body">
    <p>This is a scoped notification message.</p>
  </div>
</div>
```

---

## Breadcrumbs

```html
<nav role="navigation" aria-label="Breadcrumbs">
  <ol class="slds-breadcrumb slds-list_horizontal slds-wrap">
    <li class="slds-breadcrumb__item">
      <a href="#">Parent Section</a>
    </li>
    <li class="slds-breadcrumb__item">
      <a href="#">Child Section</a>
    </li>
    <li class="slds-breadcrumb__item" aria-current="page">
      <span>Current Page</span>
    </li>
  </ol>
</nav>
```

---

## Tabs

```html
<div class="slds-tabs_default">
  <ul class="slds-tabs_default__nav" role="tablist">
    <li class="slds-tabs_default__item slds-is-active" role="presentation">
      <a class="slds-tabs_default__link" role="tab" tabindex="0" id="tab-1" aria-controls="tab-1-panel">Tab One</a>
    </li>
    <li class="slds-tabs_default__item" role="presentation">
      <a class="slds-tabs_default__link" role="tab" tabindex="-1" id="tab-2" aria-controls="tab-2-panel">Tab Two</a>
    </li>
  </ul>
  <div id="tab-1-panel" class="slds-tabs_default__content slds-show" role="tabpanel" aria-labelledby="tab-1">
    <p>Tab one content</p>
  </div>
  <div id="tab-2-panel" class="slds-tabs_default__content slds-hide" role="tabpanel" aria-labelledby="tab-2">
    <p>Tab two content</p>
  </div>
</div>
```
