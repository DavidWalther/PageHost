const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * Tests for `slds-tabset` and `slds-tab`, modelled on `lightning-tabset` and
 * `lightning-tab`.
 *
 * The tabset keeps its tab bar in a shadow root; the tabs stay in the light DOM
 * and are projected through the default slot. Their visibility comes from SLDS
 * classes (`slds-show` / `slds-hide`) that are styled in the consumer's scope —
 * so the mount loads the SLDS stylesheet into the document, as a page does, and
 * the tests measure the computed display instead of trusting the class alone.
 */

const STYLESHEET = '/assets/styles/salesforce-lightning-design-system.min.css';

async function mountTabset(page, markup) {
  await page.evaluate(
    async ({ markup, stylesheet }) => {
      if (!document.querySelector(`link[href="${stylesheet}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheet;
        await new Promise((resolve) => {
          link.onload = resolve;
          document.head.appendChild(link);
        });
      }
      await import('/slds-components/slds-tabset/slds-tabset.js');
      document.body.innerHTML = markup;
      await Promise.all(
        [...document.querySelectorAll('slds-tabset')].map(
          (tabset) => tabset.updateComplete
        )
      );
      // slotchange fires after the first render and triggers a second one.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.all(
        [...document.querySelectorAll('slds-tabset')].map(
          (tabset) => tabset.updateComplete
        )
      );
    },
    { markup, stylesheet: STYLESHEET }
  );
}

function readTabset(page, selector = 'slds-tabset') {
  return page.evaluate((selector) => {
    const tabset = document.querySelector(selector);
    const root = tabset.shadowRoot;
    const tabs = [...tabset.querySelectorAll('slds-tab')];
    return {
      hasShadowRoot: !!root,
      tablistCount: root.querySelectorAll('[role="tablist"]').length,
      items: [...root.querySelectorAll('li.slds-tabs_default__item')].map(
        (item) => ({
          text: item.querySelector('a[role="tab"]')?.textContent.trim(),
          title: item.getAttribute('title'),
          active: item.classList.contains('slds-is-active'),
        })
      ),
      tabs: tabs.map((tab) => ({
        value: tab.value,
        role: tab.getAttribute('role'),
        ariaLabel: tab.getAttribute('aria-label'),
        classes: [...tab.classList],
        display: getComputedStyle(tab).display,
        hasShadowRoot: !!tab.shadowRoot,
        contentParent: tab.querySelector('p')?.parentElement === tab,
      })),
    };
  }, selector);
}

const THREE_TABS = `
  <slds-tabset>
    <slds-tab label="One" value="one"><p>First</p></slds-tab>
    <slds-tab label="Two" value="two"><p>Second</p></slds-tab>
    <slds-tab label="Three" value="three"><p>Third</p></slds-tab>
  </slds-tabset>
`;

test.describe('slds-tabset structure', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test('renders one tab item per slds-tab, in DOM order', async ({ page }) => {
    await mountTabset(page, THREE_TABS);
    const result = await readTabset(page);

    expect(result.hasShadowRoot).toBe(true);
    expect(result.tablistCount).toBe(1);
    expect(result.items.map((item) => item.text)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
    expect(result.items.map((item) => item.title)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
  });

  test('shows the first tab when no active-tab-value is set', async ({
    page,
  }) => {
    await mountTabset(page, THREE_TABS);
    const result = await readTabset(page);

    expect(result.items.map((item) => item.active)).toEqual([
      true,
      false,
      false,
    ]);
    expect(result.tabs.map((tab) => tab.display)).toEqual([
      'block',
      'none',
      'none',
    ]);
    expect(result.tabs[0].classes).toContain('slds-show');
    expect(result.tabs[1].classes).toContain('slds-hide');
  });

  test('turns every slds-tab into a labelled tab panel', async ({ page }) => {
    await mountTabset(page, THREE_TABS);
    const result = await readTabset(page);

    result.tabs.forEach((tab, index) => {
      expect(tab.role).toBe('tabpanel');
      expect(tab.ariaLabel).toBe(['One', 'Two', 'Three'][index]);
      expect(tab.classes).toContain('slds-tabs_default__content');
    });
  });

  test('keeps the tab content in the light DOM', async ({ page }) => {
    await mountTabset(page, THREE_TABS);
    const result = await readTabset(page);

    result.tabs.forEach((tab) => {
      expect(tab.hasShadowRoot).toBe(false);
      expect(tab.contentParent).toBe(true);
    });
  });

  test('generates a unique value for a tab without one', async ({ page }) => {
    await mountTabset(
      page,
      `
        <slds-tabset id="first">
          <slds-tab label="A"></slds-tab>
          <slds-tab label="B" value="b"></slds-tab>
        </slds-tabset>
        <slds-tabset id="second">
          <slds-tab label="C"></slds-tab>
        </slds-tabset>
      `
    );
    const first = await readTabset(page, '#first');
    const second = await readTabset(page, '#second');

    expect(first.tabs[0].value).toMatch(/^tab-\d+$/);
    expect(first.tabs[1].value).toBe('b');
    expect(second.tabs[0].value).toMatch(/^tab-\d+$/);
    expect(second.tabs[0].value).not.toBe(first.tabs[0].value);
  });

  test('renders no tab bar without tabs', async ({ page }) => {
    await mountTabset(page, '<slds-tabset></slds-tabset>');
    const result = await readTabset(page);

    expect(result.tablistCount).toBe(0);
    expect(result.items).toEqual([]);
  });

  test('ignores children that are not slds-tab', async ({ page }) => {
    await mountTabset(
      page,
      `
        <slds-tabset>
          <p>Not a tab</p>
          <slds-tab label="Only" value="only"></slds-tab>
        </slds-tabset>
      `
    );
    const result = await readTabset(page);

    expect(result.items.map((item) => item.text)).toEqual(['Only']);
  });
});
