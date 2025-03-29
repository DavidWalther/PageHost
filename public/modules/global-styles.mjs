/**
 * This module provides functions to manage global styles in Shadow DOM.
 * 
 * The `getGlobalStyleSheets` function retrieves all global stylesheets from the document
 * and converts them into CSSStyleSheet objects that can be used in Shadow DOM.
 * 
 * The `addGlobalStylesToShadowRoot` function adds the global stylesheets to a given ShadowRoot.
 * 
 * Example usage:
 * 
 * import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";
 * 
 * class CustomElement extends HTMLElement {
 *   constructor() {
 *     super();
 *     const shadowRoot = this.attachShadow({ mode: 'open' });
 *     addGlobalStylesToShadowRoot(shadowRoot);
 *   }
 * }
 * 
 * customElements.define('custom-element', CustomElement);
 */

let globalSheets = null;

export function getGlobalStyleSheets() {
  if (globalSheets === null) {
    globalSheets = Array.from(document.styleSheets)
      .map(x => {
        const sheet = new CSSStyleSheet();
        const css = Array.from(x.cssRules).map(rule => rule.cssText).join(' ');
        sheet.replaceSync(css);
        return sheet;
      });
  }

  return globalSheets;
}

export function addGlobalStylesToShadowRoot(shadowRoot) {
  shadowRoot.adoptedStyleSheets.push(
    ...getGlobalStyleSheets()
  );
}