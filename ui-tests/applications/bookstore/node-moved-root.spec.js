const { test, expect } = require('@playwright/test');
const {
  mockBookstoreCallouts,
  MOCK_ROOT_PATH,
  MOCK_CONTENTS,
  MOCK_NODES,
} = require('../../support/mock-callouts');
const { cacheLitBundle } = require('../../support/component-page');
const { withSession } = require('../../support/session');

/**
 * Moving a root.
 *
 * A root always stands in the upper node, so that is where it is marked
 * (`can-move-root`). In the modal it is left out; the top level, its own
 * level, has no paste tile. Pasted below another node it is shown as any
 * moved node: below the node itself, above its new parent.
 */

const [STORY_1, STORY_2] = MOCK_CONTENTS.result;
const ROOT = MOCK_NODES.wurzel;
const CHAPTER_3 = STORY_2.childnodes[0];

let movedTo;
let sent;

function nodeNow(id) {
  const moved = movedTo !== undefined;
  const root = { ...ROOT, parent_node_id: moved ? movedTo : null };
  const head = ({ nodes, contents, ...rest }) => rest;
  const records = {
    [ROOT.id]: root,
    [STORY_2.id]: {
      id: STORY_2.id,
      legacy_id: null,
      name: STORY_2.name,
      sortnumber: 2,
      parent_node_id: null,
      published_date: '2022-01-01 00:00:00',
      nodes: [
        {
          id: CHAPTER_3.id,
          name: CHAPTER_3.name,
          sortnumber: 1,
          parent_node_id: STORY_2.id,
        },
        ...(moved ? [head(root)] : []),
      ],
      contents: [],
    },
    [MOCK_NODES.kind1.id]: MOCK_NODES.kind1,
    [MOCK_NODES.kind2.id]: MOCK_NODES.kind2,
  };
  return records[id] ?? {};
}

function treeNow() {
  if (movedTo === undefined) return MOCK_CONTENTS;
  return {
    result: [{ ...STORY_2, childnodes: [...STORY_2.childnodes, STORY_1] }],
  };
}

async function open(page) {
  movedTo = undefined;
  sent = [];
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await withSession(page, ['read', 'edit']);
  await page.route('**/api/1.0/contents/**', (route) =>
    route.fulfill({ json: treeNow() })
  );
  await page.route('**/data/query/node**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    return route.fulfill({ json: nodeNow(id) });
  });
  await page.route('**/api/1.0/data/change/**', (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    movedTo = body.payload.parent_node_id;
    return route.fulfill({ json: { success: true, result: body.payload } });
  });
  await page.goto(MOCK_ROOT_PATH);
  await expect(upperMoveButton(page)).toBeVisible();
}

const upperMoveButton = (page) =>
  page.locator('custom-node[data-role="navigation"] #button-move');
const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile').filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const pasteTile = (page) =>
  page.locator('custom-navigation-modal button.tile_paste');

function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const upper = root.querySelector('custom-node[data-role="navigation"]');
    const lower = root.querySelector('custom-node[data-role="content"]');
    return {
      upperId: upper.getAttribute('id'),
      upperMarked: upper.shadowRoot.querySelector('#node-move')?.marked ?? null,
      selectedChild: upper.getAttribute('selected-child'),
      lowerId: lower.getAttribute('id'),
      lowerParent:
        lower.shadowRoot
          .querySelector('#node-edit')
          ?.getAttribute('story-id') ?? null,
    };
  });
}

test.describe('Page: moving a root', () => {
  test.use({ actionTimeout: 5000 });

  test('the root above offers the mark', async ({ page }) => {
    await open(page);

    await upperMoveButton(page).click();

    await expect
      .poll(async () => (await readPage(page)).upperMarked)
      .toBe(true);
  });

  test('the marked root is left out, its level offers no paste tile', async ({
    page,
  }) => {
    await open(page);
    await upperMoveButton(page).click();

    await page.locator('#button-navigation_open').click();

    await expect(tile(page, STORY_2.name)).toBeVisible();
    await expect(tile(page, STORY_1.name)).toHaveCount(0);
    await expect(pasteTile(page)).toHaveCount(0);
  });

  test('pasted below another node, the page shows it there', async ({
    page,
  }) => {
    await open(page);
    await upperMoveButton(page).click();
    await page.locator('#button-navigation_open').click();
    await tile(page, STORY_2.name).click();

    await pasteTile(page).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].payload).toEqual({
      id: ROOT.id,
      parent_node_id: STORY_2.id,
      sortnumber: null,
    });
    await expect
      .poll(async () => (await readPage(page)).lowerParent)
      .toBe(STORY_2.id);
    const state = await readPage(page);
    expect(state.lowerId).toBe(ROOT.id);
    expect(state.upperId).toBe(STORY_2.id);
    expect(state.selectedChild).toBe(ROOT.id);
  });
});
