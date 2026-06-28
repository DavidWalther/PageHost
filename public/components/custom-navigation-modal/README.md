# custom-navigation-modal

A Web Component (LitElement) that renders the application's **navigation modal**. It
wraps [`slds-modal`](../../slds-components/slds-modal/slds-modal.js) and shows the
content tree as tiles: stories on the first level, drill-down into a story's
chapters on the second level. Selecting a tile emits an event the host
(`app-bookstore`) turns into a content load.

---

## Import

```html
<script
  type="module"
  src="/components/custom-navigation-modal/custom-navigation-modal.js"
></script>
```

The component depends on `slds-modal`, `slds-layout` and `slds-layout-item` being
registered as well. On connect it loads the content tree by dispatching a `query`
event (`{ object: 'contents' }`) which the host wires to the backend.

---

## Usage

Place the element once (e.g. inside the application shell) and open it
programmatically:

```html
<custom-navigation-modal
  current-location="000c..."
  @story-select="${this.handleStorySelect}"
  @chapter-select="${this.handleChapterSelect}"
></custom-navigation-modal>
```

```javascript
const nav = document.querySelector('custom-navigation-modal');
nav.show(); // open the modal
nav.hide(); // close the modal
```

---

## Attributes

| Attribute          | Property          | Type     | Description                                                 |
| ------------------ | ----------------- | -------- | ----------------------------------------------------------- |
| `current-location` | `currentLocation` | `String` | Record id of the content currently loaded in the main view. |

### `current-location`

Holds a **single record id** of the currently loaded content; the type is derived
from the id prefix (`000s…` = story, `000c…` = chapter). The host
(`app-bookstore`) is the single source of truth and updates it whenever content is
opened (modal selection, URL deep-link, or chapter switch via the story's own
buttons). The modal never writes the attribute back.

It drives two behaviors:

- **Highlight** — the matching tile is marked in the brand style (`.tile_current`).
  A chapter id highlights both the chapter tile and its parent story tile.
- **Pre-open** — `show()` positions the modal based on the value:
  - story id (`000s…`) → opens on the **story level**, story tile highlighted;
  - chapter id (`000c…`) → opens directly in the **chapter list of the parent
    story** (resolved from the content tree), chapter tile highlighted.

If `show()` is called before the content tree has loaded, the pre-open positioning
is applied automatically once the tree arrives.

> Note: the automatic cover-chapter load that follows a story selection does **not**
> change `current-location` — it stays the selected story.

---

## Events

| Event            | `detail`                 | Description                                                     |
| ---------------- | ------------------------ | --------------------------------------------------------------- |
| `story-select`   | `{ id }`                 | A story tile was clicked. The modal stays open for drill-down.  |
| `chapter-select` | `{ storyId, chapterId }` | A chapter tile was clicked.                                     |
| `query`          | `{ payload, callback }`  | Internal: requests the content tree (`{ object: 'contents' }`). |

All events bubble and are composed.

---

## Methods

| Method   | Description                                                               |
| -------- | ------------------------------------------------------------------------- |
| `show()` | Opens the modal and pre-positions it from `current-location` (see above). |
| `hide()` | Closes the modal (delegates to `slds-modal`).                             |

The modal can also be closed via the ESC key, the close button, or a backdrop
click — these are handled by the underlying `slds-modal`.

---

## Notes

- Tile shape is rectangular (`aspect-ratio: 2 / 1`); the brand-style highlight
  reuses SLDS brand blue (`#0176d3`).
- The drill-down level (`_selectedStory`) is internal state: while the modal is
  open, manual clicks drive it; `current-location` only sets the **initial** level
  on open.
