# SLDS v1 Reference

## Component Index

All 85+ SLDS v1 component blueprints with their primary CSS classes, organized by category. Component CSS source lives at `node_modules/@salesforce-ux/design-system/css/<component>/`.

---

### Layout & Structure

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **Brand Band** | `slds-brand-band` | `slds-brand-band_small`, `slds-brand-band_medium`, `slds-brand-band_large`, `slds-brand-band__image` |
| **Cards** | `slds-card` | `slds-card__header`, `slds-card__header-title`, `slds-card__body`, `slds-card__body_inner`, `slds-card__footer`, `slds-card__tile` |
| **Form Layout** | `slds-form` | `slds-form_stacked`, `slds-form_horizontal`, `slds-form_compound`, `slds-form__row`, `slds-form__item` |
| **Global Header** | `slds-global-header` | `slds-global-header_container`, `slds-global-header__item`, `slds-global-header__item_logo`, `slds-global-header__item_search` |
| **Global Navigation** | `slds-context-bar` | `slds-context-bar__primary`, `slds-context-bar__secondary`, `slds-context-bar__item`, `slds-context-bar__label-action`, `slds-context-bar__icon-action` |
| **Page Headers** | `slds-page-header` | `slds-page-header__row`, `slds-page-header__col-title`, `slds-page-header__title`, `slds-page-header__meta-text`, `slds-page-header_record-home` |
| **Panels** | `slds-panel` | `slds-panel_docked`, `slds-panel_docked-left`, `slds-panel_docked-right`, `slds-panel__header`, `slds-panel__body`, `slds-panel__section` |
| **Regions** | `slds-region` | `slds-region_narrow`, `slds-region_wide` |
| **Split View** | `slds-split-view_container` | `slds-split-view`, `slds-split-view__list`, `slds-split-view__list-item`, `slds-split-view__list-item-action` |
| **Summary Detail** | `slds-summary-detail` | `slds-summary-detail__action`, `slds-summary-detail__title`, `slds-summary-detail__content` |
| **Tiles** | `slds-tile` | `slds-tile_board`, `slds-tile__title`, `slds-tile__detail` |

---

### Navigation

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **Accordion** | `slds-accordion` | `slds-accordion__list-item`, `slds-accordion__summary`, `slds-accordion__summary-heading`, `slds-accordion__summary-action`, `slds-accordion__section`, `slds-accordion__content` |
| **Breadcrumbs** | `slds-breadcrumb` | `slds-breadcrumb__item`, `slds-list_horizontal` |
| **Builder Header** | `slds-builder-header_container` | `slds-builder-header`, `slds-builder-header__item`, `slds-builder-header__nav`, `slds-builder-header__utilities` |
| **Menus / Dropdown** | `slds-dropdown` | `slds-dropdown_left`, `slds-dropdown_right`, `slds-dropdown_center`, `slds-dropdown__item`, `slds-dropdown__header`, `slds-dropdown-trigger`, `slds-is-open` |
| **Path** | `slds-path` | `slds-path__nav`, `slds-path__item`, `slds-path__link`, `slds-is-complete`, `slds-is-current`, `slds-is-incomplete`, `slds-is-lost`, `slds-is-won` |
| **Scoped Tabs** | `slds-tabs_scoped` | `slds-tabs_scoped__nav`, `slds-tabs_scoped__item`, `slds-tabs_scoped__link`, `slds-tabs_scoped__content`, `slds-is-active` |
| **Tabs** | `slds-tabs_default` | `slds-tabs_default__nav`, `slds-tabs_default__item`, `slds-tabs_default__link`, `slds-tabs_default__content`, `slds-is-active` |
| **Trial Bar** | `slds-trial-header` | `slds-trial-header__title` |
| **Vertical Navigation** | `slds-nav-vertical` | `slds-nav-vertical_compact`, `slds-nav-vertical__section`, `slds-nav-vertical__title`, `slds-nav-vertical__item`, `slds-nav-vertical__action`, `slds-is-active` |
| **Vertical Tabs** | `slds-vertical-tabs` | `slds-vertical-tabs__nav`, `slds-vertical-tabs__nav-item`, `slds-vertical-tabs__link`, `slds-vertical-tabs__content`, `slds-is-active` |

---

### Forms & Inputs

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **Checkbox** | `slds-checkbox` | `slds-checkbox_standalone`, `slds-checkbox__label`, `slds-checkbox_faux` |
| **Checkbox Button** | `slds-checkbox_button` | `slds-checkbox_button__label`, `slds-checkbox_button-group` |
| **Checkbox Button Group** | `slds-checkbox_button-group` | `slds-button_reset`, `slds-checkbox_button` |
| **Checkbox Toggle** | `slds-checkbox_toggle` | `slds-checkbox_faux_container`, `slds-checkbox_faux`, `slds-checkbox_on`, `slds-checkbox_off` |
| **Color Picker** | `slds-color-picker` | `slds-color-picker__selector`, `slds-color-picker__swatches`, `slds-color-picker__swatch-trigger`, `slds-color-picker__custom-tab` |
| **Combobox** | `slds-combobox_container` | `slds-combobox`, `slds-combobox__form-element`, `slds-combobox__object-switcher`, `slds-combobox__dropdown`, `slds-listbox`, `slds-listbox__option`, `slds-is-open` |
| **Date Picker** | `slds-datepicker` | `slds-datepicker__filter`, `slds-datepicker__month`, `slds-day`, `slds-is-today`, `slds-is-selected` |
| **Datetime Picker** | (combines datepicker + timepicker) | See individual components |
| **Dueling Picklist** | `slds-dueling-list` | `slds-dueling-list__column`, `slds-dueling-list__options`, `slds-dueling-list__option` |
| **Form Element** | `slds-form-element` | `slds-form-element__label`, `slds-form-element__control`, `slds-form-element__help`, `slds-form-element__icon`, `slds-has-error` |
| **Input** | `slds-input` | `slds-input_bare`, `slds-input_faux`, `slds-input_height`, `slds-input-has-icon`, `slds-input-has-icon_left`, `slds-input-has-icon_right` |
| **List Builder** | `slds-builder-list` | `slds-builder-list__item` |
| **Lookups** | `slds-lookup` | `slds-lookup__search-control`, `slds-lookup__result-text`, `slds-lookup__item-action` |
| **Radio Button Group** | `slds-radio_button-group` | `slds-radio_button`, `slds-radio_button__label` |
| **Radio Group** | `slds-radio` | `slds-radio__label`, `slds-radio_faux` |
| **Rich Text Editor** | `slds-rich-text-editor` | `slds-rich-text-editor__toolbar`, `slds-rich-text-toolbar-group`, `slds-rich-text-editor__textarea` |
| **Select** | `slds-select` | Use inside `slds-form-element__control` |
| **Slider** | `slds-slider` | `slds-slider__range`, `slds-slider__value`, `slds-slider-container`, `slds-slider_vertical` |
| **Textarea** | `slds-textarea` | Use inside `slds-form-element__control` |
| **Timepicker** | `slds-timepicker` | `slds-dropdown`, `slds-listbox__option`, `slds-is-selected` |
| **Visual Picker** | `slds-visual-picker` | `slds-visual-picker_medium`, `slds-visual-picker_large`, `slds-visual-picker__figure`, `slds-visual-picker__text`, `slds-is-selected` |

---

### Buttons & Actions

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **Button Groups** | `slds-button-group` | `slds-button-group-list` (inside `<ul>`), `slds-button-group-row` |
| **Button Icons** | `slds-button slds-button_icon` | `slds-button_icon-border`, `slds-button_icon-border-filled`, `slds-button_icon-container`, `slds-button_icon-inverse`, `slds-button_icon-x-small`, `slds-button_icon-small`, `slds-button_icon-large` |
| **Buttons** | `slds-button` | `slds-button_neutral`, `slds-button_brand`, `slds-button_outline-brand`, `slds-button_destructive`, `slds-button_text-destructive`, `slds-button_success`, `slds-button_inverse`, `slds-button_reset`, `slds-button_stretch` |
| **Dynamic Menu** | `slds-dynamic-menu` | Uses standard dropdown classes |
| **Publishers** | `slds-publisher` | `slds-publisher__toggle-visibility`, `slds-publisher__actions` |

---

### Data Display

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **Activity Timeline** | `slds-timeline` | `slds-timeline__item`, `slds-timeline__media`, `slds-timeline__content`, `slds-timeline__trigger` |
| **Avatar** | `slds-avatar` | `slds-avatar_x-small`, `slds-avatar_small`, `slds-avatar_medium`, `slds-avatar_large`, `slds-avatar_circle`, `slds-avatar__initials` |
| **Avatar Group** | `slds-avatar-group` | `slds-avatar-group__primary-item`, `slds-avatar-group__secondary-item`, `slds-avatar-group_x-small`, `slds-avatar-group_large` |
| **Badges** | `slds-badge` | `slds-badge_inverse`, `slds-badge_lightest`, `slds-badge__icon`, `slds-badge__icon_left`, `slds-badge__icon_right` |
| **Carousel** | `slds-carousel` | `slds-carousel__panels`, `slds-carousel__panel`, `slds-carousel__image`, `slds-carousel__content`, `slds-carousel__indicator-action`, `slds-is-active` |
| **Chat** | `slds-chat-list` | `slds-chat-listitem`, `slds-chat-listitem_inbound`, `slds-chat-listitem_outbound`, `slds-chat-message`, `slds-chat-message__body` |
| **Data Tables** | `slds-table` | `slds-table_fixed-layout`, `slds-table_bordered`, `slds-table_striped`, `slds-table_cell-buffer`, `slds-table_col-bordered`, `slds-cell-wrap`, `slds-is-selected`, `slds-is-sortable` |
| **Feeds** | `slds-feed` | `slds-feed__list`, `slds-feed__item`, `slds-feed__item-figure`, `slds-feed__item-content` |
| **Files** | `slds-file` | `slds-file__crop`, `slds-file__title`, `slds-file-selector`, `slds-file-selector_files-only`, `slds-file-selector__body` |
| **Illustration** | `slds-illustration` | `slds-illustration_small`, `slds-illustration_large`, `slds-illustration__svg`, `slds-illustration__figure`, `slds-illustration__message` |
| **Map** | `slds-map` | `slds-map__container` |
| **Pills** | `slds-pill` | `slds-pill_link`, `slds-pill-container`, `slds-pill__label`, `slds-pill__remove`, `slds-pill__icon_container`, `slds-pill__action` |
| **Tree** | `slds-tree` | `slds-tree__group`, `slds-tree__item`, `slds-tree__label`, `slds-tree__branch`, `slds-is-open`, `slds-is-selected` |
| **Tree Grid** | `slds-table` | Add `slds-table_tree`, `slds-tree__item`, `slds-tree__row-toggle` |

---

### Feedback & Notifications

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **Alert** | `slds-notify slds-notify_alert` | `slds-notify_alert slds-theme_alert-texture`, `slds-theme_error`, `slds-theme_warning`, `slds-theme_success`, `slds-notify__close` |
| **Docked Composer** | `slds-docked-composer` | `slds-docked-composer_open`, `slds-docked-composer__header`, `slds-docked-composer__body`, `slds-docked-composer__footer` |
| **Docked Form Footer** | `slds-docked-form-footer` | `slds-docked-form-footer__slot`, `slds-docked-form-footer__actions` |
| **Docked Utility Bar** | `slds-utility-bar` | `slds-utility-bar__item`, `slds-utility-bar__action`, `slds-utility-bar__label`, `slds-is-open` |
| **Expandable Section** | `slds-section` | `slds-section__title`, `slds-section__title-action`, `slds-section__content`, `slds-is-open` |
| **Modals** | `slds-modal` | `slds-modal__container`, `slds-modal__header`, `slds-modal__content`, `slds-modal__footer`, `slds-modal__close`, `slds-modal_medium`, `slds-modal_large`, `slds-backdrop`, `slds-backdrop_open` |
| **Notifications** | `slds-notification-container` | `slds-notification`, `slds-notification__header`, `slds-notification__body` |
| **Popovers** | `slds-popover` | `slds-popover_tooltip`, `slds-popover_panel`, `slds-popover_error`, `slds-popover_warning`, `slds-popover__header`, `slds-popover__body`, `slds-popover__footer`, `slds-nubbin_top`, `slds-nubbin_bottom`, `slds-nubbin_left`, `slds-nubbin_right` |
| **Progress Bar** | `slds-progress-bar` | `slds-progress-bar_large`, `slds-progress-bar_circular`, `slds-progress-bar__value`, `slds-progress-bar__value_success` |
| **Progress Indicator** | `slds-progress` | `slds-progress__list`, `slds-progress__item`, `slds-progress__link`, `slds-is-completed`, `slds-is-active`, `slds-is-error`, `slds-progress__marker` |
| **Progress Ring** | `slds-progress-ring` | `slds-progress-ring_large`, `slds-progress-ring_warning`, `slds-progress-ring_expired`, `slds-progress-ring_complete`, `slds-progress-ring__progress`, `slds-progress-ring__content` |
| **Prompt** | `slds-prompt` | `slds-prompt__header`, `slds-prompt__body`, `slds-prompt__footer`, `slds-theme_warning`, `slds-theme_error` |
| **Scoped Notifications** | `slds-scoped-notification` | `slds-scoped-notification_light`, `slds-scoped-notification_dark`, `slds-scoped-notification__media` |
| **Setup Assistant** | `slds-setup-assistant` | `slds-setup-assistant__step`, `slds-setup-assistant__step-summary`, `slds-setup-assistant__step-detail`, `slds-is-completed`, `slds-is-open` |
| **Spinners** | `slds-spinner_container` | `slds-spinner`, `slds-spinner_inline`, `slds-spinner_xx-small`, `slds-spinner_x-small`, `slds-spinner_small`, `slds-spinner_medium`, `slds-spinner_large`, `slds-spinner_brand`, `slds-spinner_inverse`, `slds-spinner__dot-a`, `slds-spinner__dot-b` |
| **Toast** | `slds-notify-container` | `slds-notify_toast`, `slds-notify__content`, `slds-notify__close`, `slds-theme_success`, `slds-theme_error`, `slds-theme_warning` |
| **Tooltips** | `slds-popover slds-popover_tooltip` | `slds-fall-into-ground` (hide), `slds-rise-from-ground` (show), `slds-nubbin_*` |

---

### Media & Icons

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **Dynamic Icons** | `slds-icon_container` | `slds-icon_eq`, `slds-icon_eq__bar`, `slds-icon_strength`, `slds-icon_waffle`, `slds-icon_waffle_container` |
| **Icons** | `slds-icon_container` | `slds-icon`, `slds-icon_xx-small`, `slds-icon_x-small`, `slds-icon_small`, `slds-icon_large`, `slds-icon-text-default`, `slds-icon-text-warning`, `slds-icon-text-error` |

---

### App Chrome & Misc

| Component | Root Class | Key Child/Modifier Classes |
|---|---|---|
| **App Launcher** | `slds-app-launcher` | `slds-app-launcher__header`, `slds-app-launcher__tile`, `slds-app-launcher__tile-figure`, `slds-app-launcher__tile-body` |
| **Counter** | `slds-badge` | Uses badge classes; `slds-badge_inverse` for dark variant |
| **Drop Zone** | `slds-drop-zone` | `slds-drop-zone_drag` (while dragging), `slds-drop-zone__label` |
| **Einstein Header** | `slds-einstein-header` | `slds-einstein-header__figure`, `slds-einstein-header__title` |
| **Expression** | `slds-expression` | `slds-expression__row`, `slds-expression__options`, `slds-expression__group`, `slds-expression__legend` |
| **File Selector** | `slds-file-selector` | `slds-file-selector_images`, `slds-file-selector__body`, `slds-file-selector__dropzone`, `slds-file-selector__input` |
| **Welcome Mat** | `slds-welcome-mat` | `slds-welcome-mat__info-badge`, `slds-welcome-mat__tile`, `slds-welcome-mat__tile-figure`, `slds-welcome-mat__tile-body` |

---

## Design Token Reference

SLDS design tokens are named CSS variables (available in the CSS file as `--slds-*` custom properties) and also as SCSS/JS values in `node_modules/@salesforce-ux/design-system/design-tokens/`.

### Brand Color Tokens (CSS custom properties)

```css
--slds-g-color-brand-base-10: #001639   /* darkest */
--slds-g-color-brand-base-20: #032d60
--slds-g-color-brand-base-30: #014486
--slds-g-color-brand-base-40: #0b5cab
--slds-g-color-brand-base-50: #0176d3   /* primary brand */
--slds-g-color-brand-base-60: #1b96ff   /* brand primary */
--slds-g-color-brand-base-65: #57a3fd
--slds-g-color-brand-base-70: #78b0fd
--slds-g-color-brand-base-80: #aacbff
--slds-g-color-brand-base-90: #d8e6fe
--slds-g-color-brand-base-95: #eef4ff
--slds-g-color-brand-base-100: #ffffff
```

### Neutral Gray Tokens

```css
--slds-g-color-neutral-base-10: #181818   /* near black */
--slds-g-color-neutral-base-20: #2e2e2e
--slds-g-color-neutral-base-30: #444444
--slds-g-color-neutral-base-40: #5c5c5c
--slds-g-color-neutral-base-50: #747474
--slds-g-color-neutral-base-60: #939393
--slds-g-color-neutral-base-65: #a0a0a0
--slds-g-color-neutral-base-70: #aeaeae
--slds-g-color-neutral-base-80: #c9c9c9
--slds-g-color-neutral-base-90: #e5e5e5
--slds-g-color-neutral-base-95: #f3f3f3
--slds-g-color-neutral-base-100: #ffffff
```

### Status Color Tokens

```css
/* Error */
--slds-g-color-error-base-50: #ea001e    /* primary error */
--slds-g-color-error-base-40: #ba0517
--slds-g-color-error-base-60: #fe5c4c
--slds-g-color-error-base-80: #feb8ab
--slds-g-color-error-base-90: #feded8

/* Warning */
--slds-g-color-warning-base-50: #a96404  /* primary warning */
--slds-g-color-warning-base-60: #dd7a01
--slds-g-color-warning-base-70: #fe9339
--slds-g-color-warning-base-80: #ffba90
--slds-g-color-warning-base-90: #fedfd0

/* Success */
--slds-g-color-success-base-50: #2e844a  /* primary success */
--slds-g-color-success-base-60: #3ba755
--slds-g-color-success-base-70: #45c65a
--slds-g-color-success-base-80: #91db8b
--slds-g-color-success-base-90: #cdefc4
```

### Border Tokens

```css
--slds-g-color-border-base-1: #c9c9c9   /* lightest */
--slds-g-color-border-base-2: #aeaeae
--slds-g-color-border-base-3: #939393
--slds-g-color-border-base-4: #747474   /* darkest */
--slds-g-color-border-brand-1: #78b0fd  /* brand light */
--slds-g-color-border-brand-2: #1b96ff  /* brand */
```

### Link Tokens

```css
--slds-g-link-color: #0b5cab
--slds-g-link-color-hover: #014486
--slds-g-link-color-focus: #014486
--slds-g-link-color-active: #032d60
```

### Spacing Scale (rem values)

| Token name suffix | Value |
|---|---|
| `xxx-small` | 0.125rem (2px) |
| `xx-small` | 0.25rem (4px) |
| `x-small` | 0.5rem (8px) |
| `small` | 0.75rem (12px) |
| `medium` | 1rem (16px) |
| `large` | 1.5rem (24px) |
| `x-large` | 2rem (32px) |
| `xx-large` | 3rem (48px) |

### SLDS Utility Theme Classes

```
slds-theme_default         white background
slds-theme_shade           light gray background
slds-theme_inverse         dark (inverted) background
slds-theme_alt-inverse     alternate dark background
slds-theme_success         green background
slds-theme_info            blue background
slds-theme_warning         yellow/orange background
slds-theme_error           red background
slds-theme_offline         dark blue background
```
