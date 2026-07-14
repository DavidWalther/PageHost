const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright-Konfiguration für die Frontend-/UI-Tests.
 *
 * - Tests liegen in `ui-tests/` (`*.spec.js`), getrennt von der Jest-Backend-Suite.
 *   `ui-tests/` spiegelt die Struktur von `public/` — ein Spec liegt im Ordner der
 *   Komponente, die er prüft (`ui-tests/slds-components/slds-card/…`). `testDir`
 *   wird rekursiv gescannt, das Default-`testMatch` greift `**\/*.spec.js`; die
 *   Helfer in `ui-tests/support/` matchen es nicht und bleiben außen vor.
 *   Ablage-Regel: `doc/frontend-testing.md`.
 * - Nur Chromium.
 * - Der App-Server wird über `npm start` gestartet. Die Datencallouts werden in
 *   den Tests per `page.route()` gemockt, daher ist kein echtes Postgres/Redis
 *   nötig. Readiness wird über `/` geprüft (liefert 200), bewusst nicht über
 *   `/metadata` (das ohne Redis hängt).
 */
module.exports = defineConfig({
  testDir: 'ui-tests',
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000/',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
