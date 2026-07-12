# slds-modal

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[modal](https://v1.lightningdesignsystem.com/components/modals/) as a
`<slds-modal>` custom element: a dialog section plus a backdrop, with the content
provided through slots.

The component renders **nothing** while it is closed. Opening it is normally done
**imperatively** via `show()` — that is how all four consumers use it.

## Usage

```html
<script type="module" src="/slds-components/slds-modal/slds-modal.js"></script>

<slds-modal heading="Edit chapter" @close="${this._handleClose}">
  <p>Body content…</p>
  <div slot="footer">
    <button class="slds-button">Save</button>
  </div>
</slds-modal>
```

```js
// Open / close from the outside:
this.shadowRoot.querySelector('slds-modal').show();
this.shadowRoot.querySelector('slds-modal').hide();
```

## Attributes

| Attribute  | Type    | Default | Description                                                                 |
| ---------- | ------- | ------- | --------------------------------------------------------------------------- |
| `open`     | Boolean | `false` | Whether the dialog is shown. Reflected. While `false`, nothing is rendered. |
| `heading`  | String  | `''`    | Heading text, used unless the `headline` slot is filled.                    |
| `headless` | Boolean | `false` | Omits the header region. Reflected.                                         |
| `footless` | Boolean | `false` | Omits the footer region. Reflected.                                         |

> The heading attribute used to be called `title`, which shadowed the _global_ HTML
> `title` attribute and gave the host an unwanted browser tooltip. Use `heading`.

## Slots

| Slot        | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| _(default)_ | Body content (`slds-modal__content`).                             |
| `headline`  | Header content. Falls back to the `heading` attribute when empty. |
| `footer`    | Footer content. Only rendered when `footless` is not set.         |

## Methods

| Method     | Description                                        |
| ---------- | -------------------------------------------------- |
| `show()`   | Opens the dialog and fires `open`.                 |
| `hide()`   | Closes the dialog and fires `close`.               |
| `toggle()` | Calls `show()` or `hide()` depending on the state. |

## Events

| Event   | `detail`          | Description                                               |
| ------- | ----------------- | --------------------------------------------------------- |
| `open`  | `{ modal: this }` | Fired by `show()`. Bubbles.                               |
| `close` | `{ modal: this }` | Fired by `hide()` and by every close path below. Bubbles. |

## Closing

Three paths close the dialog, and each one fires `close`:

- the **close button** in the top-right corner,
- a click on the **backdrop**,
- the **Escape** key (a `keydown` listener on `document`, active only while open).

## Accessibility

The dialog carries `role="dialog"`, `aria-modal="true"` and
`aria-labelledby="modal-heading"`, and the close button has assistive text.

Focus is managed while the dialog is open:

- On open, focus moves to the first focusable element — the close button, followed
  by whatever the slots contain. If there is nothing focusable, the dialog section
  itself takes focus (it carries `tabindex="-1"`).
- **Tab is trapped**: tabbing past the last element wraps to the first, and
  Shift+Tab from the first wraps to the last. The candidates are collected from the
  shadow root (close button) _and_ the slotted light DOM, since the dialog content
  is projected rather than owned.
- On close, focus returns to the element that had it before the dialog opened.

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. While the dialog is open, the component sets
`document.body.style.overflow = 'hidden'` to suppress background scrolling and
restores it on close.

## Consumers

`custom-login-module`, `custom-navigation-modal`, `custom-settings-modal` and
`custom-chapter-edit` — all of them wrap `<slds-modal>`, open it with `show()`
and listen for `close`.
