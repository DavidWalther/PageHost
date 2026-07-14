/**
 * Jest configuration.
 *
 * Grenzt die Backend-Testsuite (Jest, `*.tests.js` in `__tests__/`) von den
 * Playwright-Frontend-Tests ab. Jests Default-`testMatch` würde sonst die
 * `ui-tests/**\/*.spec.js` einsammeln und beim Import von `@playwright/test`
 * scheitern.
 *
 * `testPathIgnorePatterns` ist ein Regex auf den **vollen Pfad**, nicht ein Glob.
 * `/ui-tests/` greift deshalb auch für die nach Komponente gegliederten
 * Unterordner (`ui-tests/slds-components/slds-card/…`).
 */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/ui-tests/'],
};
