# slds-toggle

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[checkbox toggle](https://v1.lightningdesignsystem.com/components/checkbox-toggle/)
(a switch). It wraps the SLDS `slds-checkbox_toggle` blueprint and exposes it as
a `<slds-toggle>` custom element that emits a `toggle` event on change.

## Usage

```html
<script type="module" src="/slds-components/slds-toggle/toggle.js"></script>

<slds-toggle
  label="Enable feature"
  enabled-label="Enabled"
  disabled-label="Disabled"
  name="feature"
  checked
></slds-toggle>
```

## Properties

| Property        | Attribute        | Type    | Default | Description                                                                          |
| --------------- | ---------------- | ------- | ------- | ------------------------------------------------------------------------------------ |
| `label`         | `label`          | String  | –       | Text shown next to the switch (`slds-form-element__label`).                          |
| `enabledLabel`  | `enabled-label`  | String  | –       | Text rendered in the "on" state span (`slds-checkbox_on`).                           |
| `disabledLabel` | `disabled-label` | String  | –       | Text rendered in the "off" state span (`slds-checkbox_off`).                         |
| `name`          | `name`           | String  | –       | `name` attribute of the underlying `<input type="checkbox">`.                        |
| `checked`       | `checked`        | Boolean | `false` | Current state of the switch. Reflected to the attribute, so it can be read from DOM. |
| `disabled`      | `disabled`       | Boolean | `false` | Disables the switch (sets the `disabled` attribute on the input).                    |
| `direction`     | `direction`      | String  | `ltr`   | Set to `"right-to-left"` to render the control with `dir="rtl"` on the wrapper.      |

## Events

| Event    | `detail`                             | Description                                        |
| -------- | ------------------------------------ | -------------------------------------------------- |
| `toggle` | `{ checked: Boolean, name: String }` | Fired whenever the user flips the switch. Bubbles. |

```js
document.querySelector('slds-toggle').addEventListener('toggle', (event) => {
  console.log(event.detail.name, event.detail.checked);
});
```

## Examples

### Basic

```html
<slds-toggle
  label="Notifications"
  enabled-label="On"
  disabled-label="Off"
></slds-toggle>
```

### Pre-checked and named

```html
<slds-toggle
  label="Dark mode"
  enabled-label="Enabled"
  disabled-label="Disabled"
  name="dark-mode"
  checked
></slds-toggle>
```

### Disabled

```html
<slds-toggle label="Locked setting" disabled></slds-toggle>
```

### Right-to-left

```html
<slds-toggle label="تفعيل" direction="right-to-left"></slds-toggle>
```

## Rendered markup

The component reproduces the SLDS checkbox-toggle blueprint inside its shadow
root, adding `slds-grid` on the label for label/switch layout:

```html
<div dir="ltr">
  <div class="slds-form-element">
    <label class="slds-checkbox_toggle slds-grid" for="toggle-…">
      <span class="slds-form-element__label slds-m-bottom_none">Label</span>
      <input
        type="checkbox"
        name="…"
        id="toggle-…"
        aria-describedby="toggle-…"
      />
      <span class="slds-checkbox_faux_container" aria-live="assertive">
        <span class="slds-checkbox_faux"></span>
        <span class="slds-checkbox_on">Enabled label</span>
        <span class="slds-checkbox_off">Disabled label</span>
      </span>
    </label>
  </div>
</div>
```

## SLDS blueprint coverage

The full `slds-checkbox_toggle` blueprint is entirely CSS-driven off the
visually-hidden `<input type="checkbox">` — no JavaScript is required for its
visuals. The table below records the blueprint's functional scope and what this
component exposes.

### Interaction states (automatic, from the SLDS stylesheet)

| State                 | Blueprint behaviour                                           | Covered |
| --------------------- | ------------------------------------------------------------- | :-----: |
| unchecked             | Grey track, knob left, `slds-checkbox_off` text visible       |   ✅    |
| checked               | Blue track, knob slides right + checkmark, `_on` text visible |   ✅    |
| hover                 | Darker track, `cursor: pointer`                               |   ✅    |
| focus / focus-visible | Focus ring (box-shadow / outline)                             |   ✅    |
| checked + hover/focus | Darker blue track                                             |   ✅    |
| disabled              | Greyed track, `pointer-events: none`, `cursor: default`       |   ✅    |
| disabled + checked    | Greyed knob / checkmark                                       |   ✅    |

These come for free once the blueprint markup and SLDS stylesheet are in place
(injected here via `addGlobalStylesToShadowRoot`); the component does not need
to implement them.

### Form-level features (blueprint conventions)

| Feature                     | Blueprint markup                                        | Covered |
| --------------------------- | ------------------------------------------------------- | :-----: |
| Label                       | `slds-form-element__label`                              |   ✅    |
| On/off state text           | `slds-checkbox_on` / `slds-checkbox_off`                |   ✅    |
| `name` on the input         | `<input name="…">`                                      |   ✅    |
| Checked / disabled state    | `[checked]` / `[disabled]` on the input                 |   ✅    |
| Live announcement of state  | `aria-live="assertive"` on the faux container           |   ✅    |
| `aria-describedby` on input | `aria-describedby="…"`                                  |   ✅    |
| Required indicator          | `<abbr class="slds-required" title="required">*</abbr>` |   ❌    |
| Error state + help text     | `slds-has-error` + `slds-form-element__help`            |   ❌    |

**Gaps:** the component does not expose the required indicator or the
error/help-text variants of the blueprint. Add them if a consuming form needs
inline validation.

## Accessibility

- The `<input>` is associated with its `<label>` via a per-render generated
  `id` / `for` pair, as required by SLDS form elements.
- `aria-live="assertive"` on `slds-checkbox_faux_container` announces state
  changes, matching the SLDS blueprint.
- SLDS styles are injected into the shadow root via
  `addGlobalStylesToShadowRoot` from `/modules/global-styles.mjs`.

## Notes / deviations from project conventions

- The `toggle` event name is a bare single word; project conventions prefer
  qualified, kebab-case event names (e.g. `toggle-change`). It is kept as-is
  because it is public API consumed by `custom-publishing`, `custom-chapter-edit`
  and the `bookstore` application via `@toggle`; renaming it is a separate,
  breaking change.
