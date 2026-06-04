---
name: project-bookstore-nav
description: Navigation architecture and known UX/a11y issues in the bookstore reading app — story-to-story and chapter selection flows
metadata:
  type: project
---

Bookstore is a Lit web-component SPA (no router library). Navigation is driven entirely by custom DOM events (`navigation`, `loaded`) and URL path-segment parsing. Stories contain chapters; chapters contain paragraphs.

**Key architectural facts:**
- `app-bookstore` (bookstore.js) owns `<custom-story>` + `<custom-chapter>` as static shadow-DOM children — never created/destroyed, only given new `id` attributes.
- Story switching: user opens `<slds-panel id="sidebar">` via `#button-panel_open` in the header, clicks a dynamically-created `<button>` per story in `#pill-container`, a `navigation` event fires on `app-bookstore` and is handled by `handleNavigationEvent`.
- Chapter switching inside a story: `<custom-story>` renders either individual `<button>` elements or an `<slds-combobox>` (when `chapter-buttons_number-max` is exceeded), and fires a `navigation` event of type `chapter`.
- URL deep-linking: path prefix `000s` = story, `000c` = chapter, `000p` = paragraph. Only `window.history.replaceState` is used — never `pushState`. There is NO `popstate` listener anywhere.
- Focus management: no `focus()` calls after any navigation transition.
- ARIA live regions: absent — no `aria-live` anywhere in the navigation flow.
- The panel `<slds-button-icon id="button-panel_open">` has no `title` attribute set at the call site in bookstore.js; the slds-button-icon template auto-populates assistive text from the icon name ("Rows").
- `showStoryNotFound()` exists but is never called (dead code). Errors from `storyChangeCallback` and `queryEventCallback_AllStories` are silently `console.error`-only — no user-visible feedback.
- Panel close button label is hardcoded "Collapse Panel Header" in slds-panel.html.
- Chapter buttons: currently selected chapter is `disabled` (not just visually styled), which removes it from the tab order.
- `slds-combobox`: no `aria-expanded` sync to actual open state; dropdown toggled via CSS class only. Keyboard navigation of dropdown items is missing (only blur/keyup for filtering).
- `_handleChapterDeleted` in bookstore.js calls `this.chapterElement.removeAttribute('id')` but does NOT call `chapterElement.clearContent()`, meaning stale content can remain visible.
- Toast auto-dismisses in 900 ms — very short for users with cognitive or motor disabilities.

**Why:** Recorded after full code review of story navigation flow per user request on 2026-05-31.
**How to apply:** Use when reviewing follow-up navigation or accessibility work; avoid re-flagging already-documented issues unless asking to fix them.
