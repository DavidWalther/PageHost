usecase-beta
systemBoundary "Pagehost"
  browseTree
  readContent
  openDeepLink
  signIn
  manageNode
  manageContent
  publishRecord
  fetchSitemap
end

actor Visitor
actor Operator
actor Crawler
actor IdentityProvider

Visitor --> browseTree
Visitor --> readContent
Visitor --> openDeepLink
Crawler --> fetchSitemap
Operator --> signIn
Operator --> manageNode
Operator --> manageContent
Operator --> publishRecord
signIn --> IdentityProvider
