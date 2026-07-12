/**
 * Seiten-Setup für die **Komponenten**-Specs (`slds-*.spec.js`).
 *
 * Diese Specs mounten eine Webkomponente isoliert und prüfen ihr Shadow-DOM. Sie
 * brauchen dafür **keine** laufende App — nur eine Seite auf demselben Origin, von
 * der aus sich `/slds-components/…` als Modul importieren lässt.
 *
 * Vorher navigierten sie auf `/` und booteten damit die komplette Bookstore-App.
 * Pro Test bedeutete das rund 40 Requests, darunter echte Backend-Callouts
 * (`/metadata`, `/api/1.0/contents/all`, `/data/query/*` — je 600–900 ms) und zwei
 * Fahrten ins offene Internet (Lit vom jsDelivr-CDN, ein Logo von Wikimedia).
 * Bei 100+ Tests auf mehreren Workern hing die Suite damit an fremder
 * Netzwerklatenz und wurde unter Last flaky.
 *
 * Hier wird deshalb
 *   1. das Dokument `/` durch eine leere Seite ersetzt (kein App-Boot, keine
 *      Callouts), und
 *   2. das Lit-Bundle **einmal pro Worker** geholt und danach aus dem Speicher
 *      beantwortet — es bleibt das echte Bundle, nur ohne 100+ CDN-Requests.
 */

const LIT_CDN_URL =
  'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

const BLANK_PAGE =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<title>component test</title></head><body></body></html>';

// Modul-Scope = einmal je Worker-Prozess, nicht je Test.
let litBundle = null;

/**
 * Beantwortet den Lit-CDN-Request aus einem prozessweiten Cache. Auch für die
 * App-Specs sinnvoll, die weiterhin die echte Seite laden.
 */
async function cacheLitBundle(page) {
  if (litBundle === null) {
    const response = await page.request.get(LIT_CDN_URL);
    litBundle = await response.text();
  }

  await page.route(LIT_CDN_URL, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: litBundle,
    })
  );
}

/**
 * Navigiert auf eine leere Seite desselben Origins. Muss statt `page.goto('/')`
 * verwendet werden, wenn der Test nur eine Komponente isoliert mounten will.
 */
async function gotoComponentPage(page) {
  await cacheLitBundle(page);

  await page.route(
    (url) => url.pathname === '/',
    (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: BLANK_PAGE,
      })
  );

  await page.goto('/');
}

module.exports = { gotoComponentPage, cacheLitBundle, LIT_CDN_URL };
