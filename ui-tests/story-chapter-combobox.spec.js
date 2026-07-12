const { test, expect } = require('@playwright/test');
const { mockBookstoreCallouts } = require('./support/mock-callouts');
const { cacheLitBundle } = require('./support/component-page');

/**
 * App-Test für die Kapitelauswahl per Combobox.
 *
 * `custom-story` rendert die `<slds-combobox>` **nur**, wenn eine Story mehr
 * Kapitel hat als `chapter-buttons_number-max` (der `bookstore` setzt 2). Die
 * Standard-Mockdaten haben genau 2 Kapitel — dieser Pfad war deshalb von **keinem**
 * Test abgedeckt: Der `combobox-select`-Contract zwischen Komponente und Consumer
 * konnte brechen, ohne dass die Suite rot wurde. Genau das sichert dieser Test ab.
 */

const STORY_WITH_MANY_CHAPTERS = {
  id: '000s00000000000011',
  name: 'Mock Story 1',
  sortnumber: 1,
  publishdate: '2022-01-01 00:00:00',
  chapters: [1, 2, 3, 4].map((n) => ({
    id: `000c0000000000000${n}`,
    storyid: '000s00000000000011',
    name: `Mock Chapter ${n}`,
    sortnumber: n,
    publishdate: '2022-01-01 00:00:00',
  })),
};

test.describe('Story: Kapitelauswahl per Combobox', () => {
  test.beforeEach(async ({ page }) => {
    await mockBookstoreCallouts(page);
    await cacheLitBundle(page);
    // Mehr Kapitel als chapter-buttons_number-max (2) -> die Combobox erscheint.
    await page.route('**/data/query/story**', (route) =>
      route.fulfill({ json: STORY_WITH_MANY_CHAPTERS })
    );

    await page.goto('/');
    await expect(page.locator('app-bookstore')).toBeAttached();
  });

  // Greift auf die Combobox im Shadow-DOM von custom-story zu.
  async function readCombobox(page) {
    return page.evaluate(() => {
      const app = document.querySelector('app-bookstore');
      const story = app.shadowRoot.querySelector('custom-story');
      const combobox = story?.shadowRoot?.querySelector('slds-combobox');
      if (!combobox) return { present: false };

      const options = [
        ...combobox.shadowRoot.querySelectorAll('ul.slds-listbox li'),
      ];
      return {
        present: true,
        optionCount: options.length,
        selectedChapter: story.selectedChapter,
      };
    });
  }

  test('bei mehr Kapiteln als Buttons erscheint die Combobox', async ({
    page,
  }) => {
    await expect
      .poll(async () => (await readCombobox(page)).present)
      .toBe(true);

    const state = await readCombobox(page);
    expect(state.optionCount).toBe(4);
  });

  test('Options-Klick stellt das Kapitel im Consumer um', async ({ page }) => {
    await expect
      .poll(async () => (await readCombobox(page)).present)
      .toBe(true);

    const result = await page.evaluate(async () => {
      const app = document.querySelector('app-bookstore');
      const story = app.shadowRoot.querySelector('custom-story');
      const combobox = story.shadowRoot.querySelector('slds-combobox');

      combobox.shadowRoot.querySelector('.slds-combobox').click();
      await combobox.updateComplete;
      combobox.shadowRoot.querySelectorAll('ul.slds-listbox li')[2].click();
      await combobox.updateComplete;
      await story.updateComplete;

      return {
        selectedChapter: story.selectedChapter,
        inputText: combobox.shadowRoot.querySelector('input').value,
      };
    });

    // Der Consumer hört auf `combobox-select` — bricht der Event-Name, bleibt
    // selectedChapter null und dieser Test schlägt fehl.
    expect(result.selectedChapter).toBe('000c00000000000003');
    expect(result.inputText).toBe('Mock Chapter 3');
  });
});
