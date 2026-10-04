# Overview

Every goal the application serves, on one level, with the actors that hold them.

> **GitHub shows the block below as source**, not as a picture — it does not
> support `usecase-beta` yet. Paste it into Mermaid Live or use an editor preview
> to see the diagram; the two tables below carry the same content either way.

```mermaid
usecase-beta
systemBoundary "Pagehost"
  openTheApp
  browseTheTree
  readAContent
  shareOrOpenALink
  adjustTheApp
  signIn
  manageTheNodeTree
  manageContents
  publishOrWithdraw
  discoverPublishedPages
  installAndWorkOffline
end

actor Visitor
actor Operator
actor Crawler
actor Browser
actor IdentityProvider

Visitor --> openTheApp
Visitor --> browseTheTree
Visitor --> readAContent
Visitor --> shareOrOpenALink
Visitor --> adjustTheApp

Crawler --> discoverPublishedPages
Browser --> installAndWorkOffline

Operator --> signIn
Operator --> manageTheNodeTree
Operator --> manageContents
Operator --> publishOrWithdraw
signIn --> IdentityProvider
```

## What each goal covers

| Goal                     | Cases in [`../useCases.md`](../useCases.md)                                                                      |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `openTheApp`             | UC-A-01 – UC-A-03, UC-A-08 – UC-A-09, UC-A-16 – UC-A-21, UC-B-01                                                 |
| `browseTheTree`          | UC-C-01 – UC-C-09, UC-C-13 – UC-C-19, UC-C-21 – UC-C-24, UC-C-27 – UC-C-31, UC-C-33 – UC-C-36, UC-C-38 – UC-C-42 |
| `readAContent`           | UC-C-10 – UC-C-12                                                                                                |
| `shareOrOpenALink`       | UC-B-02 – UC-B-10, UC-C-20, UC-C-32, UC-C-37                                                                     |
| `adjustTheApp`           | UC-D-01 – UC-D-07                                                                                                |
| `signIn`                 | UC-E-01 – UC-E-18                                                                                                |
| `manageTheNodeTree`      | UC-F-01 – UC-F-12, UC-F-20 – UC-F-23, UC-C-25                                                                    |
| `manageContents`         | UC-G-01 – UC-G-20                                                                                                |
| `publishOrWithdraw`      | UC-F-13 – UC-F-19, UC-G-21 – UC-G-23, UC-C-26                                                                    |
| `discoverPublishedPages` | UC-A-04 – UC-A-05, UC-H-14                                                                                       |
| `installAndWorkOffline`  | UC-A-06 – UC-A-07, UC-A-10 – UC-A-15                                                                             |

## What the picture cannot say

**Visibility is not a goal, so it has no box.** Section H (UC-H-01 – UC-H-16) is a
rule over every reading goal: app membership, the inherited visibility of a node's
parents, and `published_date`. Drawing it as a box would make it look like
something an actor asks for; leaving it out means the diagram must be read
together with section H, never instead of it.

**Neither are the two permission layers.** Every goal on the `Operator` side needs
a session with the right scope (`edit`, `create`, `delete`, or `publish` **and**
`edit` for publishing) **and** the action enabled in
`APPLICATION_ACTIVE_ACTIONS`. The two fail differently — 401 against 403 — which
is exactly what the tables carry and a box cannot.

**`signIn` is drawn as a goal, although it is rarely one.** Nobody signs in for its
own sake; it is the precondition of the three goals beside it. Once the diagram
type is known to support `include`, those three should include it instead.

## Actors

| Actor              | Who                                                                      |
| :----------------- | :----------------------------------------------------------------------- |
| `Visitor`          | Not signed in. The default reader.                                       |
| `Operator`         | Signed in. There is no self-registration.                                |
| `Crawler`          | A search engine reading `sitemap.xml` and `robots.txt`.                  |
| `Browser`          | The platform on the application's behalf: service worker, precache, PWA. |
| `IdentityProvider` | Google, during the sign-in round-trip.                                   |

`DataStorage` and `DataCache` are deliberately absent — see the conventions in
[`README.md`](README.md).
