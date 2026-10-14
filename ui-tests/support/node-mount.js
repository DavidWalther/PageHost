const { expect } = require('@playwright/test');
const { gotoComponentPage } = require('./component-page');
const { withSession } = require('./session');

/**
 * Mounts one `custom-node` on its own, for the specs of the component.
 *
 * The application shows a node through `custom-node-view` and
 * `custom-node-contents`; `custom-node` lives on in the feeds. Its own
 * behaviour — children as buttons or a combobox, its action bar, what its
 * attributes switch — is therefore checked without the application: the page
 * answers the node's queries itself, as `public/index.js` would.
 *
 * The SLDS stylesheet is loaded so that layout can be measured; the
 * components take it over into their shadow roots when they connect.
 */

const STYLESHEET = '/assets/styles/salesforce-lightning-design-system.min.css';

const MODULES = [
  '/slds-components/slds-card/slds-card.js',
  '/slds-components/slds-layout/slds-layout.js',
  '/slds-components/slds-layout/slds-layout-item.js',
  '/slds-components/slds-button-icon/slds-button-icon.js',
  '/slds-components/slds-combobox/slds-combobox.js',
  '/slds-components/slds-modal/slds-modal.js',
  '/slds-components/slds-toggle/slds-toggle.js',
  '/slds-components/slds-input/slds-input.js',
  '/slds-components/slds-spinner/slds-spinner.js',
  '/components/custom-paragraph/custom-paragraph.js',
  '/components/custom-node/custom-node.js',
];

/**
 * Mounts `custom-node` for `node` and waits until its name shows.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {object} options.node the record the node query answers with
 * @param {object} [options.attrs] attributes, `true` for a boolean one
 * @param {string[]|null} [options.scopes] scopes of a session; none without
 * @param {object} [options.contentRecords] content records by id, as
 *   `/data/query/content` delivers them; a content without one gets a text
 * @returns {Promise<import('@playwright/test').Locator>} the mounted node
 */
async function mountNode(
  page,
  { node, attrs = {}, scopes = null, contentRecords = {} }
) {
  if (scopes) {
    await withSession(page, scopes);
  }
  await gotoComponentPage(page);
  await page.evaluate(
    async ({ node, attrs, contentRecords, modules, stylesheet }) => {
      if (!document.querySelector(`link[href="${stylesheet}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheet;
        await new Promise((resolve) => {
          link.onload = resolve;
          document.head.appendChild(link);
        });
      }
      window.__navigation = [];
      document.body.addEventListener('navigation', (event) =>
        window.__navigation.push(event.detail.value)
      );
      document.body.addEventListener('query', (event) => {
        const { object, id } = event.detail.payload;
        if (object === 'node') {
          event.detail.callback(null, node);
          return;
        }
        if (contentRecords[id]) {
          event.detail.callback(null, contentRecords[id]);
          return;
        }
        const entry = (node.contents || []).find(
          (content) => content.id === id
        );
        event.detail.callback(null, {
          ...entry,
          node_id: node.id,
          active_type: 'text',
          items: [{ id: `${id}-t`, type: 'text', content: `Text of ${id}` }],
        });
      });
      for (const module of modules) {
        await import(module);
      }
      document.querySelectorAll('custom-node').forEach((el) => el.remove());
      const el = document.createElement('custom-node');
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value === true ? '' : String(value));
      }
      el.setAttribute('id', node.id);
      document.body.appendChild(el);
      await el.updateComplete;
    },
    { node, attrs, contentRecords, modules: MODULES, stylesheet: STYLESHEET }
  );
  const host = page.locator('custom-node');
  await expect(host.locator('#node-name')).toHaveText(node.name);
  return host;
}

/** The child ids the mounted node reported with `navigation`, in order. */
const navigatedTo = (page) => page.evaluate(() => window.__navigation);

module.exports = { mountNode, navigatedTo };
