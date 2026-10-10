# slds-tabset & slds-tab

Web components for [SLDS Tabs](https://v1.lightningdesignsystem.com/components/tabs/),
modelled on Salesforce's
[`lightning-tabset`](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-tabset.html)
and
[`lightning-tab`](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-tab.html).
The API follows Lightning wherever the platform allows it; the differences are
listed below.

```js
import '/slds-components/slds-tabset/slds-tabset.js'; // also defines slds-tab
```

```html
<slds-tabset active-tab-value="news">
  <slds-tab label="News" value="news" @active="${loadNews}">…</slds-tab>
  <slds-tab label="Versions" value="versions" @active="${loadVersions}"
    >…</slds-tab
  >
</slds-tabset>
```

## API

### `<slds-tabset>`

| Attribute / property                  | Type   | Default    | Description                                                                                                                                                                                                          |
| :------------------------------------ | :----- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active-tab-value` / `activeTabValue` | String | —          | Value of the tab to show. A click or arrow key sets it, so the property names the shown tab once the user has chosen one.                                                                                            |
| `variant`                             | String | `standard` | Only `standard` is built. Any other value falls back to `standard`.                                                                                                                                                  |
| `size`                                | String | —          | Size of the tab labels: `medium` (1rem) or `large` (1.25rem). Without it the SLDS default (0.8125rem) applies; any other value sets no size. Not part of `lightning-tabset`. The content of the tabs keeps its size. |

### `<slds-tab>`

| Attribute / property | Type   | Default   | Description                                                                       |
| :------------------- | :----- | :-------- | :-------------------------------------------------------------------------------- |
| `label`              | String | `''`      | Text of the tab in the tab bar; also the panel's `aria-label`                     |
| `value`              | String | generated | Identifies the tab. Without one the tabset assigns `tab-<n>`, unique on the page. |

The tab's children are its content.

### Event: `active` on `<slds-tab>`

Fired by a tab **whenever it becomes the shown tab**: on start, on a click, on an
arrow key and when `active-tab-value` changes. A click on the tab that is already
shown fires nothing.

As in Lightning the event has **no `detail`** and does **not bubble** — listen on
the tab itself. Load a tab's content lazily on its first `active`.

## Which tab is shown

1. The tab named by `active-tab-value`.
2. Otherwise the **first** tab — also when the value is unknown.
3. When tabs are added or removed, the shown tab stays shown. If it is removed,
   the first remaining tab is shown (and fires `active`).

Tabs may arrive after the tabset (for example from a request): the first tab that
appears becomes the shown one. A changed `label` or `value` updates the tab bar.

## Keyboard

As in `lightning-tabset`:

- **Arrow left / right** show the previous / next tab, wrapping at both ends, and
  move the focus with it (automatic activation).
- Only the shown tab is a tab stop (`tabindex="0"`); the others have `-1`.
- **No Home / End**, no up / down.

## Structure: shadow DOM for the bar, light DOM for the tabs

- `slds-tabset` has a **shadow root** with the tab bar and one **default slot**.
- `slds-tab` has **no shadow root**. It stays in the consumer's light DOM, and so
  does its content: a component inside a tab is styled exactly as if the tab
  were not there.
- The tabset turns each `slds-tab` into the panel from outside. It sets
  `role="tabpanel"`, `aria-label` (the tab's label) and the classes
  `slds-tabs_default__content` and `slds-show` / `slds-hide` on the host.

### The SLDS stylesheet must reach the tabs

Because the tabs live in the consumer's scope, their classes are styled by the
stylesheet of **that** scope — the document for top-level use, or the enclosing
component's shadow root. Every `custom-*` component loads SLDS into its shadow
root (`addGlobalStylesToShadowRoot`), so tabs work there. In a scope without the
SLDS stylesheet, `slds-hide` hides nothing and every tab is visible.

### The `class` attribute of a tab belongs to the tabset

`role`, `aria-label` and the panel classes on `slds-tab` are **managed by the
tabset**. Do not bind `class` on a tab — a template binding replaces the whole
attribute and drops the classes the tabset set. Put your own classes on an
element inside the tab.

## Narrow screens

The tab bar **scrolls sideways** in one row instead of widening the page. A tab
chosen by keyboard is scrolled into view. SLDS itself only offers an overflow
menu ("More") for this, which is not built.

## Differences from Lightning

| Topic                      | Lightning                                            | Here                                                                                                                                                           |
| :------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel labelling            | `aria-labelledby` → tab, `aria-controls` → panel     | `aria-label` on the panel, no `aria-controls`. Id references do not cross the native shadow boundary between bar and panels; LWC's synthetic shadow allows it. |
| Lazy content               | a tab renders its slot after the first activation    | the consumer loads on `active`. Children of a light-DOM tab exist and connect at once.                                                                         |
| Unknown `active-tab-value` | ignored; set before the tabs arrive, no tab is shown | the first tab is shown                                                                                                                                         |
| Label size                 | —                                                    | `size="medium"` / `size="large"`, mapped to `slds-tabs_medium` / `slds-tabs_large`                                                                             |
| Many tabs                  | "More" overflow menu                                 | the tab bar scrolls sideways                                                                                                                                   |
| Registration               | each tab registers by event                          | the tabset reads its slot (`slotchange`); same result, DOM order                                                                                               |

Not built (yet): the variants `scoped` and `vertical`, tab icons
(`icon-name`, `end-icon-name`), `show-error-indicator`, `title` on the tabset and
on the tab, and `focus()`.

### No `title` on a tab

`lightning-tab` has a `title` for the tooltip of its tab. `slds-tab` does not, on
purpose: `title` is a global HTML attribute, and because the tab element **is**
the panel, the browser would show the tooltip over the whole content. The tab in
the bar carries its `label` as tooltip. Do not set `title` on an `slds-tab`.

## Tests

`ui-tests/slds-components/slds-tabset/slds-tabset.spec.js` — structure, selection
and the `active` event, keyboard and ARIA, narrow screens, dark mode and size. The spec loads the
SLDS stylesheet into the document and measures the computed display, because
the visibility of a tab depends on it.
