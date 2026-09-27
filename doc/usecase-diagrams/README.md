# Use case diagrams

Pictures for the cases listed in **[`../useCases.md`](../useCases.md)**. The list
answers _what must hold_; a diagram answers _who wants something and how the
goals relate_. Neither replaces the other.

**One file per diagram.** A single file grows out of hand as soon as the cases get
concrete — and a diagram that has to be found by scrolling is not consulted.

## What is here

| File                         | Shows                                                        |
| :--------------------------- | :----------------------------------------------------------- |
| [`overview.md`](overview.md) | All actors and the goals of the whole application, one level |

More files are added **when a diagram is needed**, not on stock: a picture of
four boxes says nothing the table does not already say.

## Conventions

These four decide whether the diagrams stay usable as more arrive.

**An actor is whoever wants something from the system.** `Visitor`, `Operator`,
`Crawler`, `Browser` (the platform acting on the application's behalf) and
`IdentityProvider` (Google, during sign-in).

**`DataStorage` and `DataCache` are not actors.** PostgreSQL and Redis want
nothing — the application uses them to deliver. They belong inside the boundary,
or nowhere in the picture. Putting them next to `Visitor` mixes _who has a goal_
with _what serves it_, and turns a use case diagram into a dataflow diagram that
is wrong at both jobs. Where the data path is the point, draw a sequence diagram
instead; `../authentication.md` has several.

**Goal level, not variant level.** A box is a goal — "publish a content". It is
not a variant — "publish without the scope". The variants are the rows in
`../useCases.md`, and there are over a hundred of them; they would bury any
diagram.

**Every file must read without a rendered image.** `usecase-beta` is a beta
diagram type, and this repository otherwise uses only `graph` and
`sequenceDiagram`, which have been stable for years. Whether a given Mermaid
version knows the type cannot be checked from inside the repository, so each file
carries prose and a table beside the block — if the block renders as source, the
file still works.

## Adding a diagram

1. One file, named after what it shows (`writing-contents.md`, not `diagram2.md`).
2. Title, then **one** sentence on what the diagram is for.
3. The Mermaid block.
4. A table mapping every box to its `UC-…` ids in `../useCases.md`. Without it
   the picture and the list drift apart, and the drift is invisible.
5. Name the actors if they are not all of them.
6. Add the file to the table above.

Language is English, like the rest of the documentation
(`../coding-conventions.md`, section "Language"). German labels from the
visitor-facing surface are quoted verbatim where they appear.
