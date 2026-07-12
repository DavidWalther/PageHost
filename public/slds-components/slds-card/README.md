# slds-card

A Lit web component that renders a Salesforce Lightning Design System (SLDS)
[card](https://v1.lightningdesignsystem.com/components/cards/) as a
`<slds-card>` custom element. It reproduces the previous (legacy) behaviour
one-to-one — only the implementation changed from the native markup-caching
pattern to Lit.

## Usage

```html
<script type="module" src="/slds-components/slds-card/slds-card.js"></script>

<slds-card no-footer>
  <span slot="header">Card title</span>
  <div slot="actions"><!-- buttons --></div>
  <p>Card body content…</p>
</slds-card>
```

The card always renders `<article class="slds-card">` with a header region, a
body region (`slds-card__body_inner`), and — unless `no-footer` is set — a
footer.

## Attributes

| Attribute   | Type    | Default | Description                                                                    |
| ----------- | ------- | ------- | ------------------------------------------------------------------------------ |
| `no-header` | Boolean | `false` | **No-Op** — the header is always rendered (see note below).                    |
| `no-footer` | Boolean | `false` | Omits the footer region.                                                       |
| `no-border` | Boolean | `false` | Adds the `no-border` class to the `<article>` (removes border and box-shadow). |

> **Note — `no-header` is a no-op.** In the legacy component `no-header` never
> had any effect (the header was always rendered), and this Lit port keeps that
> behaviour deliberately to stay a faithful port. Making `no-header` actually
> hide the header would be a behaviour change and needs its own issue.

## Slots

| Slot        | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| _(default)_ | Card body content.                                                                           |
| `header`    | Header title text.                                                                           |
| `actions`   | Header action area (e.g. buttons).                                                           |
| `footer`    | Footer text (inside the footer's assistive text). Only rendered when `no-footer` is not set. |

## Styling

SLDS styles are injected into the shadow root via `addGlobalStylesToShadowRoot`
from `/modules/global-styles.mjs`. The card background uses the
`--slds-c-card-color-background` CSS variable, matching the legacy behaviour.
