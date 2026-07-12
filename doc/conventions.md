# Frontend-Komponenten — Konventionen

Verbindliche Regeln für Webkomponenten in `public/`. Diese Datei ist die
**kanonische Quelle**; ältere Beschreibungen (z. B. `ChatGPT-Role-Context.md`)
sind nur noch Verweise hierher.

## Zwei Komponenten-Typen

| Typ             | Ordner                    | HTML-Tag-Präfix | Zweck                                                 |
| :-------------- | :------------------------ | :-------------- | :---------------------------------------------------- |
| SLDS-Bausteine  | `public/slds-components/` | `slds-`         | generisch, wiederverwendbar, **nicht** app-spezifisch |
| App-Komponenten | `public/components/`      | `custom-`       | anwendungsspezifisch                                  |

Dateistruktur je Komponente: `<name>/<name>.js` (Logik), dazu eine `README.md`.

## Verbindliches Muster: Lit

**Alle** Komponenten (`custom-*` und `slds-*`) werden mit **Lit** gebaut,
eingebunden per CDN (kein Bundler):

```js
import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';

class CustomExample extends LitElement {
  static properties = { id: { type: String } };

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // SLDS-Styles ins ShadowDOM
  }

  render() {
    return html`<div class="slds-box">…</div>`;
  }
}
customElements.define('custom-example', CustomExample);
```

- SLDS-Styles kommen über `addGlobalStylesToShadowRoot` aus
  `/modules/global-styles.mjs` ins ShadowDOM (einmal global geladen).
- SLDS-Klassen fürs Styling verwenden → Skill **`slds-v1`**.
- Lit-Patterns (Properties, Templates, Direktiven, Events) → Skill
  **`lit-web-components`**.

### SVG-Icons: `href` statt `xlink:href` (wichtig!)

SLDS-Icons werden per Sprite-Referenz in einem SVG-`<use>` eingebunden. In Lit
**immer das SVG2-Attribut `href` verwenden, nie `xlink:href`**:

```js
// richtig — Icon löst auf:
html`<svg class="slds-icon"><use href="${sprite}#${name}"></use></svg>`;
// falsch — Icon fehlt (kein Fehler, nur unsichtbar):
html`<svg class="slds-icon"><use xlink:href="${sprite}#${name}"></use></svg>`;
```

- **Fehlverhalten:** Eine **dynamische** `xlink:href`-Bindung setzt lit-html per
  `setAttribute('xlink:href', …)` **ohne** den XLink-Namespace. Das SVG-`<use>`
  erkennt diesen nicht-genamespaceten Wert **nicht** als Referenz → `href.baseVal`
  bleibt leer, das **Icon fehlt** (kein Konsolenfehler).
- **Nur dynamische Bindings brechen.** Ein **statisches** `xlink:href` im
  Lit-Template funktioniert, weil lit das Template vom HTML-Parser verarbeiten
  lässt und der den XLink-Namespace setzt (wie früher beim `.html`-Markup).
  Trotzdem gilt ausnahmslos `href`: Sobald jemand das statische Attribut später
  zu einer Bindung macht, verschwindet das Icon **still**.
- **Test-Regel:** Im Playwright-Test die **aufgelöste** Referenz prüfen
  (`use.href.baseVal`), **nicht** `getAttribute('xlink:href')` — letzteres liefert
  den String auch dann, wenn das Icon gar nicht auflöst, und lässt den Bug durch.
- Historie: als Bug aufgetreten und behoben in `slds-toast` und
  `slds-button-icon` (2026-07-09); bei den Ports von `slds-panel` und
  `slds-combobox` von vornherein auf `href` gezogen.

## Historie: abgelöste Muster

Beide früheren Muster sind vollständig abgelöst — sie tauchen im Code nicht mehr
auf und dürfen nicht wiederbelebt werden:

- **Natives `HTMLElement` + Markup-Caching** (`.html`-Datei, `loadHtmlMarkup` /
  geteiltes `templatePromise`): mit der Portierung von `slds-combobox`
  (2026-07-12) restlos auf Lit migriert. Es gibt keine `.html`-Komponentendateien
  mehr.
- **SLDS-Preloader über `/modules/slds.js`** (`sharedStyleSheetConst`): existiert
  nicht mehr, ersetzt durch `/modules/global-styles.mjs`.

Bewusst ausgelassene Fixes aus den Portierungen (latente Legacy-Eigenheiten, die
originalgetreu übernommen wurden) sind in `EPC/Missed.md` protokolliert.

## Allgemein

- Mobile-first.
- Formatter: Prettier (`.prettierrc`) — nur die im Teilschritt geänderte Datei
  formatieren (Commit-Disziplin, siehe EPC-Workflow).
- Frontend wird mit **Playwright**-UI-Tests abgesichert (`ui-tests/*.spec.js`).
  Setup und Muster: **`doc/frontend-testing.md`**.
