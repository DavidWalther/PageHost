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

<slds-modal title="Edit chapter" @close="${this._handleClose}">
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

| Attribute  | Type    | Default | Description                                                                    |
| ---------- | ------- | ------- | ------------------------------------------------------------------------------ |
| `open`     | Boolean | `false` | Whether the dialog is shown. Reflected. While `false`, nothing is rendered.    |
| `title`    | String  | `''`    | Heading text, used unless the `headline` slot is filled. **See caveat below.** |
| `headless` | Boolean | `false` | Omits the header region. Reflected.                                            |
| `footless` | Boolean | `false` | Omits the footer region. Reflected.                                            |

> **Caveat — `title` shadows the native attribute.** `title` is a _global_ HTML
> attribute with a native property, so setting it also gives the host element a
> browser tooltip. Renaming it would break all four consumers, so it is a known,
> unfixed wart.

## Slots

| Slot        | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| _(default)_ | Body content (`slds-modal__content`).                                |
| `headline`  | Header content. Falls back to the `title` attribute when left empty. |
| `footer`    | Footer content. Only rendered when `footless` is not set.            |

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

## Accessibility — known limits

The dialog carries `role="dialog"`, `aria-modal="true"` and
`aria-labelledby="modal-heading"`, and the close button has assistive text. Two
pieces of the focus handling do **not** work, however — named here rather than
silently papered over:

- **The focus trap never engages.** `_handleTabKey` looks for focusable elements
  inside `.slds-modal__content` in the _shadow_ root, but the content arrives as
  slotted _light_ DOM — so nothing is ever found and Tab can leave the dialog.
- **Focus does not move into the dialog on open.** `_setFocus()` calls `focus()`
  on `.slds-modal__content`, a `<div>` without `tabindex`, which is not focusable.

Until those are fixed, consumers that need a real focus trap have to provide it
themselves.

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. While the dialog is open, the component sets
`document.body.style.overflow = 'hidden'` to suppress background scrolling and
restores it on close.

## Consumers

`custom-login-module`, `custom-navigation-modal`, `custom-settings-modal` and
`custom-chapter-edit` — all of them wrap `<slds-modal>`, open it with `show()`
and listen for `close`.
