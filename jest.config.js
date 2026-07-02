/**
 * Jest configuration.
 *
 * Grenzt die Backend-Testsuite (Jest, `*.tests.js` in `__tests__/`) von den
 * Playwright-Frontend-Tests ab. Jests Default-`testMatch` würde sonst die
 * `ui-tests/*.spec.js` einsammeln und beim Import von `@playwright/test`
 * scheitern.
 */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/ui-tests/'],
};
