# Frontend-Komponenten — Konventionen

Verbindliche Regeln für Webkomponenten in `public/`. Diese Datei ist die
**kanonische Quelle**; ältere Beschreibungen (z. B. `ChatGPT-Role-Context.md`)
sind nur noch Verweise hierher.

## Zwei Komponenten-Typen

| Typ             | Ordner                    | HTML-Tag-Präfix | Zweck                                                 |
| :-------------- | :------------------------ | :-------------- | :---------------------------------------------------- |
| SLDS-Bausteine  | `public/slds-components/` | `slds-`         | generisch, wiederverwendbar, **nicht** app-spezifisch |
| App-Komponenten | `public/components/`      | `custom-`       | anwendungsspezifisch                                  |

Dateistruktur je Komponente: `<name>/<name>.js` (Logik), optional
`<name>/<name>.html` (Markup, nur beim Legacy-Muster, s. u.).

## Bevorzugtes Muster: Lit (für alles Neue)

Neue Komponenten — und bereits **alle `custom-*`** sowie neuere `slds-*` —
werden mit **Lit** gebaut, eingebunden per CDN (kein Bundler):

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
  bleibt leer, das **Icon fehlt** (kein Konsolenfehler). Legacy-Markup mit
  statischem `xlink:href` funktionierte, weil dort der HTML-Parser den Namespace
  gesetzt hat — beim Lit-Port geht das verloren.
- **Test-Regel:** Im Playwright-Test die **aufgelöste** Referenz prüfen
  (`use.href.baseVal`), **nicht** `getAttribute('xlink:href')` — letzteres liefert
  den String auch dann, wenn das Icon gar nicht auflöst, und lässt den Bug durch.
- Betroffen/behoben: `slds-toast`, `slds-button-icon` (2026-07-09).

## Legacy-Muster: nativ + Markup-Caching

Eine ältere `slds-*`-Komponente (`slds-combobox`) nutzt noch natives
`HTMLElement` mit Template-Caching aus einer `.html`-Datei (`loadHtmlMarkup` /
geteiltes `templatePromise`).

- **Für neue Komponenten nicht mehr verwenden.** Lit ist der Standard.
- Beim Anfassen einer Legacy-Komponente: bestehendes Muster respektieren oder
  bewusst auf Lit migrieren — nicht mischen.
- **Veraltet:** Der frühere SLDS-Preloader über `/modules/slds.js`
  (`sharedStyleSheetConst`) existiert **nicht mehr**. Aktuell ist
  `/modules/global-styles.mjs`.

## Allgemein

- Mobile-first.
- Formatter: Prettier (`.prettierrc`) — nur die im Teilschritt geänderte Datei
  formatieren (Commit-Disziplin, siehe EPC-Workflow).
- Frontend wird mit **Playwright**-UI-Tests abgesichert (`ui-tests/*.spec.js`).
  Setup und Muster: **`doc/frontend-testing.md`**.
