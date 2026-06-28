# Frontend-Komponenten — Konventionen

Verbindliche Regeln für Webkomponenten in `public/`. Diese Datei ist die
**kanonische Quelle**; ältere Beschreibungen (z. B. `ChatGPT-Role-Context.md`)
sind nur noch Verweise hierher.

## Zwei Komponenten-Typen

| Typ | Ordner | HTML-Tag-Präfix | Zweck |
| :-- | :-- | :-- | :-- |
| SLDS-Bausteine | `public/slds-components/` | `slds-` | generisch, wiederverwendbar, **nicht** app-spezifisch |
| App-Komponenten | `public/components/` | `custom-` | anwendungsspezifisch |

Dateistruktur je Komponente: `<name>/<name>.js` (Logik), optional
`<name>/<name>.html` (Markup, nur beim Legacy-Muster, s. u.).

## Bevorzugtes Muster: Lit (für alles Neue)

Neue Komponenten — und bereits **alle `custom-*`** sowie neuere `slds-*` —
werden mit **Lit** gebaut, eingebunden per CDN (kein Bundler):

```js
import { LitElement, html, css } from
  'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
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

## Legacy-Muster: nativ + Markup-Caching

Einige ältere `slds-*`-Komponenten (z. B. `slds-card`, `slds-input`,
`slds-spinner`, `slds-toast`) nutzen noch natives `HTMLElement` mit
Template-Caching aus einer `.html`-Datei (`loadHtmlMarkup` / geteiltes
`templatePromise`).

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
- Frontend wird **nicht** automatisch getestet.
