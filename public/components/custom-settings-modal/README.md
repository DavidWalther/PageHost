# custom-settings-modal

A Web Component (LitElement) that renders the application's **settings modal**. It
wraps [`slds-modal`](../../slds-components/slds-modal/slds-modal.js) and currently
provides an empty skeleton; concrete settings are added later.

---

## Import

```html
<script
  type="module"
  src="/components/custom-settings-modal/custom-settings-modal.js"
></script>
```

The component depends on `slds-modal` being registered as well.

---

## Usage

Place the element once (e.g. inside the application shell) and open it
programmatically:

```html
<custom-settings-modal></custom-settings-modal>
```

```javascript
const settings = document.querySelector('custom-settings-modal');
settings.show(); // open the modal
settings.hide(); // close the modal
```

A typical trigger is a gear icon in the header:

```html
<slds-button-icon
  icon="utility:settings"
  size="small"
  variant="container-transparent"
></slds-button-icon>
```

```javascript
gearButton.addEventListener('sldsbuttonclick', () => settings.show());
```

---

## Methods

| Method   | Description                                   |
| -------- | --------------------------------------------- |
| `show()` | Opens the modal (delegates to `slds-modal`).  |
| `hide()` | Closes the modal (delegates to `slds-modal`). |

The modal can also be closed via the ESC key, the close button, or a backdrop
click — these are handled by the underlying `slds-modal`.

---

## Notes

- Visible to all users (no login requirement).
- Persistence of settings (localStorage) is planned but not yet implemented.
