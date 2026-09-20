const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * Laden, Verstecken und Nachladen — die Zusagen, die `custom-node` braucht.
 *
 * Diese drei hängen nicht am Editor, sondern am Lebenszyklus des Absatzes:
 *
 * - `no-load` heißt **nicht abrufen** (Lazy Loading weiter unten im Kapitel).
 * - `no-display` heißt **nicht zeigen** (beim Sprung zu einem Inhalt).
 * - `published`/`unpublished` heißen **noch einmal abrufen**: Nach dem
 *   Veröffentlichen hat der Datensatz ein neues `published_date`.
 *
 * Der Absatz wird dafür **isoliert** gemountet. Das geht, weil er seine Daten
 * nicht selbst holt, sondern ein `query`-Ereignis feuert — im Betrieb bindet
 * `public/index.js` es an den Endpunkt, hier antwortet der Test. Genau diese
 * Fuge macht den Abruf zählbar.
 */

const RECORD = {
  id: '00cn00000000000001',
  name: 'Ein Absatz',
  sortnumber: 1,
  published_date: null,
  node_id: '000n00000000000001',
  active_type: 'text',
  items: [{ id: '00ci00000000000001', type: 'text', content: 'Inhalt' }],
};

/**
 * Mountet einen Absatz und hängt einen Zähler an das `query`-Ereignis.
 * `window.__queries` hält die Zahl der Abrufe.
 */
async function mountParagraph(page, { attrs = {} } = {}) {
  await page.evaluate(
    async ({ attrs, record }) => {
      await import('/slds-components/slds-spinner/slds-spinner.js');
      await import('/components/custom-paragraph/custom-paragraph.js');
      document
        .querySelectorAll('custom-paragraph')
        .forEach((el) => el.remove());

      window.__queries = 0;
      document.body.addEventListener('query', (event) => {
        window.__queries += 1;
        event.detail.callback(null, record);
      });

      const el = document.createElement('custom-paragraph');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : value);
      }
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { attrs, record: RECORD }
  );
}

const queries = (page) => page.evaluate(() => window.__queries);

test.describe('custom-paragraph: Laden und Verstecken', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('ohne no-load wird der Inhalt abgerufen und angezeigt', async ({
    page,
  }) => {
    await mountParagraph(page, { attrs: { id: RECORD.id } });

    await expect(page.locator('custom-paragraph')).toContainText('Inhalt');
    expect(await queries(page)).toBe(1);
  });

  test('no-load ruft nichts ab und zeigt einen Platzhalter', async ({
    page,
  }) => {
    await mountParagraph(page, {
      attrs: { id: RECORD.id, 'no-load': true },
    });

    expect(await queries(page)).toBe(0);
    await expect(page.locator('custom-paragraph')).toContainText(
      'Loading paragraph...'
    );
  });

  test('wird no-load entfernt, holt der Absatz seinen Inhalt nach', async ({
    page,
  }) => {
    await mountParagraph(page, {
      attrs: { id: RECORD.id, 'no-load': true },
    });

    await page.evaluate(() =>
      document.querySelector('custom-paragraph').removeAttribute('no-load')
    );

    await expect.poll(() => queries(page)).toBe(1);
    await expect(page.locator('custom-paragraph')).toContainText('Inhalt');
  });

  test('no-display versteckt den Absatz, ohne den Abruf zu verhindern', async ({
    page,
  }) => {
    await mountParagraph(page, {
      attrs: { id: RECORD.id, 'no-display': true },
    });

    expect(await queries(page)).toBe(1);
    await expect(page.locator('custom-paragraph')).toBeHidden();
  });

  test('published und unpublished lösen einen neuen Abruf aus', async ({
    page,
  }) => {
    await mountParagraph(page, { attrs: { id: RECORD.id } });
    expect(await queries(page)).toBe(1);

    await page.evaluate(() =>
      document
        .querySelector('custom-paragraph')
        .dispatchEvent(new CustomEvent('published', { detail: {} }))
    );
    await expect.poll(() => queries(page)).toBe(2);

    await page.evaluate(() =>
      document
        .querySelector('custom-paragraph')
        .dispatchEvent(new CustomEvent('unpublished', { detail: {} }))
    );
    await expect.poll(() => queries(page)).toBe(3);
  });
});

/**
 * Eine neue `id` heißt: Dieses Element stellt einen **anderen** Inhalt dar.
 *
 * Das passiert beim Löschen mitten in einer Liste — Lit setzt Listen ohne
 * Schlüssel über den Index zusammen und teilt die vorhandenen Elemente neu zu,
 * statt sie zu verschieben.
 */
test.describe('custom-paragraph: die id wechselt', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  const setId = (page, id) =>
    page.evaluate(
      (value) =>
        document.querySelector('custom-paragraph').setAttribute('id', value),
      id
    );

  test('der Absatz wirft seinen Stand weg und holt den neuen Inhalt', async ({
    page,
  }) => {
    await mountParagraph(page, { attrs: { id: RECORD.id } });
    expect(await queries(page)).toBe(1);

    await setId(page, '00cn00000000000002');

    await expect.poll(() => queries(page)).toBe(2);
  });

  test('mit no-load bleibt es beim Platzhalter — kein Abruf', async ({
    page,
  }) => {
    await mountParagraph(page, {
      attrs: { id: RECORD.id, 'no-load': true },
    });
    expect(await queries(page)).toBe(0);

    await setId(page, '00cn00000000000002');

    await expect(page.locator('custom-paragraph')).toContainText(
      'Loading paragraph...'
    );
    expect(await queries(page)).toBe(0);
  });
});
