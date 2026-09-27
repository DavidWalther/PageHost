# custom-publishing

Publishes or withdraws **one record** — a node or a content — with a single
toggle. It does not know which kind it is working on: the consumer says so
through `object-name`, and the same component serves both.

It performs no callout of its own. Turning the toggle dispatches `publish` or
`unpublish`, which `public/index.js` binds to
`PATCH /api/1.0/actions/publish` and `.../unpublish`.

## Usage

```html
<custom-publishing
  record-id="00cn00000000000001"
  object-name="content"
  publish-date="2022-01-01 00:00:00"
  title="Publish this content"
></custom-publishing>
```

Used inside `custom-content-publish` (for a content) and inside the publish tab
of `custom-chapter-edit` (for a node).

## Properties

| Attribute      | Property      | Type    | Default        | Meaning                                                            |
| -------------- | ------------- | ------- | -------------- | ------------------------------------------------------------------ |
| `record-id`    | `recordId`    | String  | `''`           | Id of the record to publish.                                       |
| `object-name`  | `objectName`  | String  | `''`           | What the record is — `node` or `content`. Goes out in the payload. |
| `publish-date` | `publishDate` | String  | `null`         | Current publication date. **Empty means unpublished.**             |
| `title`        | `title`       | String  | `'Publishing'` | Caption next to the toggle.                                        |
| `disabled`     | `disabled`    | Boolean | `false`        | Disables the publish toggle.                                       |
| `no-safety`    | `noSafety`    | Boolean | `false`        | Drops the safety lock, leaving the publish toggle on its own.      |

Without `record-id` **or** `object-name` nothing is sent — the component returns
silently instead of dispatching an event that no one could answer.

## The safety lock

By default a second toggle sits in front of the publish toggle, and the publish
toggle stays **disabled** while that lock is on (internal state, on after every
render of a fresh instance). Publishing is a step outwards that cannot be undone
by pressing the same switch again — the lock makes it two deliberate actions
instead of one stray tap.

`no-safety` removes the lock for consumers that already guard the action, for
example behind a modal that had to be opened first.

## Permission

`checkPublishPermission()` reads the session from `sessionStorage` and requires
**both** `publish` and `edit`. It is checked twice on purpose:

- while rendering, which leaves the publish toggle **disabled**;
- again when the toggle is operated, which answers with an error toast
  (`Not authenticated or insufficient permissions`) instead of a request.

> Unlike most components here, this one **renders a disabled control** rather
> than nothing. Consumers that prefer the usual behaviour check the scopes
> themselves and leave the component out — `custom-content-publish` does exactly
> that with its trigger.

> Reading the session out of `sessionStorage` happens in several frontend
> components by now. That is known and will be cleaned up in one go.

## Events

All of them bubble and are composed.

| Event         | `detail`                                        | When                                              |
| ------------- | ----------------------------------------------- | ------------------------------------------------- |
| `publish`     | `{ object, payload: { id, object }, callback }` | The toggle went from unpublished to published.    |
| `unpublish`   | `{ object, payload: { id, object }, callback }` | The toggle went the other way.                    |
| `published`   | `{ recordId, objectName }`                      | The callout succeeded. Consumers refetch on this. |
| `unpublished` | `{ recordId, objectName }`                      | Same, after withdrawing.                          |
| `toast`       | `{ message, variant }`                          | Result of the callout, or a refused permission.   |

`published` and `unpublished` must reach the consumer: `custom-paragraph`
refetches its record on them because `published_date` has changed. A consumer
that swallows them shows a stale state.

## Styling

SLDS styles come into the shadow root through `addGlobalStylesToShadowRoot` from
`/modules/global-styles.mjs`. The only own rule makes the container full width.
