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
 * Moving a node, from the mark to the page after it.
 *
 * The page hands its mark to the navigation modal (`marked`, and the node
 * left out with `hidden-ids`); the modal's ✕ drops it. After `node-moved` the
 * mark is gone, the tree reloads, the modal closes, and the page shows the
 * moved node as if it had been chosen in the modal: below the node itself —
 * fetched again, it names its new parent — above its new parent. A node moved
 * to the top level has no parent to show; the old one above lets go of it.
 */

const [STORY_1, STORY_2] = MOCK_CONTENTS.result;
const CHILD_1 = MOCK_NODES.kind1;
const CHAPTER_3 = STORY_2.childnodes[0];

/** The backend's state: where CHILD_1 hangs (undefined = not moved yet). */
let movedTo;
let sent;
let treeCalls;

/** Tree and records as the backend would deliver them after the move. */
function treeNow() {
  if (movedTo === undefined) return MOCK_CONTENTS;
  const moved = { ...STORY_1.childnodes[0], childnodes: [] };
  const story1 = {
    ...STORY_1,
    childnodes: STORY_1.childnodes.filter((node) => node.id !== CHILD_1.id),
  };
  const story2 =
    movedTo === STORY_2.id
      ? { ...STORY_2, childnodes: [...STORY_2.childnodes, moved] }
      : STORY_2;
  return {
    result: movedTo === null ? [story1, story2, moved] : [story1, story2],
  };
}

function nodeNow(id) {
  const moved = movedTo !== undefined;
  const child1 = {
    ...CHILD_1,
    parent_node_id: moved ? movedTo : CHILD_1.parent_node_id,
    sortnumber: moved ? null : CHILD_1.sortnumber,
  };
  const head = ({ nodes, contents, ...rest }) => rest;
  const records = {
    [MOCK_NODES.wurzel.id]: {
      ...MOCK_NODES.wurzel,
      nodes: MOCK_NODES.wurzel.nodes.filter(
        (node) => !moved || node.id !== CHILD_1.id
      ),
    },
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
        ...(movedTo === STORY_2.id ? [head(child1)] : []),
      ],
      contents: [],
    },
    [CHILD_1.id]: child1,
    [MOCK_NODES.kind2.id]: MOCK_NODES.kind2,
  };
  return records[id] ?? {};
}

async function open(page) {
  movedTo = undefined;
  sent = [];
  treeCalls = 0;
  await mockBookstoreCallouts(page);
  await cacheLitBundle(page);
  await withSession(page, ['read', 'edit']);
  await page.route('**/api/1.0/contents/**', (route) => {
    treeCalls += 1;
    return route.fulfill({ json: treeNow() });
  });
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
  await expect
    .poll(async () => (await readPage(page)).lowerId)
    .toBe(CHILD_1.id);
  await expect(moveButton(page)).toBeVisible();
}

function readPage(page) {
  return page.evaluate(() => {
    const root = document.querySelector('app-bookstore').shadowRoot;
    const upper = root.querySelector('custom-node[data-role="navigation"]');
    const lower = root.querySelector('custom-node[data-role="content"]');
    const modal = root.querySelector('custom-navigation-modal');
    return {
      upperId: upper.getAttribute('id'),
      upperChildren: (upper.childNodeList ?? []).map((child) => child.id),
      selectedChild: upper.getAttribute('selected-child'),
      lowerId: lower.getAttribute('id'),
      lowerParent:
        lower.shadowRoot
          .querySelector('#node-edit')
          ?.getAttribute('story-id') ?? null,
      lowerMarked: lower.shadowRoot.querySelector('#node-move')?.marked ?? null,
      modalMarked: modal.marked?.id ?? null,
      modalHidden: modal.hiddenIds ?? [],
      modalOpen: modal.shadowRoot
        .querySelector('slds-modal')
        .hasAttribute('open'),
    };
  });
}

const moveButton = (page) =>
  page.locator('custom-node[data-role="content"] #button-move');
const tile = (page, text) =>
  page.locator('custom-navigation-modal button.tile').filter({
    has: page.locator('.tile__name', {
      hasText: new RegExp(`^\\s*${text}\\s*$`),
    }),
  });
const pasteTile = (page) =>
  page.locator('custom-navigation-modal button.tile_paste');

/**
 * Marks the lower node and opens the modal. The page entered at the root, so
 * the modal opens on the top level.
 */
async function markAndOpenModal(page) {
  await moveButton(page).click();
  await expect.poll(async () => (await readPage(page)).lowerMarked).toBe(true);
  await page.locator('#button-navigation_open').click();
  await expect(tile(page, STORY_2.name)).toBeVisible();
}

test.describe('Page: moving a node', () => {
  test.use({ actionTimeout: 5000 });

  test('hands the mark to the navigation modal', async ({ page }) => {
    await open(page);

    await moveButton(page).click();

    await expect
      .poll(async () => (await readPage(page)).modalMarked)
      .toBe(CHILD_1.id);
    expect((await readPage(page)).modalHidden).toEqual([CHILD_1.id]);
  });

  test('the ✕ in the modal drops the mark', async ({ page }) => {
    await open(page);
    await markAndOpenModal(page);

    await page
      .locator('custom-navigation-modal #marked-hint')
      .getByRole('button', { name: 'Markierung aufheben' })
      .click();

    await expect
      .poll(async () => (await readPage(page)).lowerMarked)
      .toBe(false);
    const state = await readPage(page);
    expect(state.modalMarked).toBeNull();
    expect(state.modalHidden).toEqual([]);
  });

  test('after moving below another node the page shows it there', async ({
    page,
  }) => {
    await open(page);
    await markAndOpenModal(page);
    await tile(page, STORY_2.name).click();

    await pasteTile(page).click();

    await expect.poll(() => sent.length).toBe(1);
    await expect
      .poll(async () => (await readPage(page)).lowerParent)
      .toBe(STORY_2.id);
    const state = await readPage(page);
    expect(state.modalOpen).toBe(false);
    expect(state.lowerId).toBe(CHILD_1.id);
    expect(state.lowerMarked).toBe(false);
    expect(state.modalMarked).toBeNull();
    expect(state.upperId).toBe(STORY_2.id);
    expect(state.selectedChild).toBe(CHILD_1.id);
    await expect
      .poll(async () => (await readPage(page)).upperChildren)
      .toEqual([CHAPTER_3.id, CHILD_1.id]);
    expect(treeCalls).toBeGreaterThan(1);
  });

  test('after moving to the top level the old parent lets go of it', async ({
    page,
  }) => {
    await open(page);
    await markAndOpenModal(page);

    await pasteTile(page).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].payload.parent_node_id).toBeNull();
    await expect.poll(async () => (await readPage(page)).modalOpen).toBe(false);
    // The lower node fetches itself again; its actions are back once it has.
    await expect
      .poll(async () => (await readPage(page)).lowerMarked)
      .toBe(false);
    const state = await readPage(page);
    expect(state.lowerId).toBe(CHILD_1.id);
    expect(state.upperChildren).not.toContain(CHILD_1.id);
    expect(state.selectedChild).toBeNull();
    expect(treeCalls).toBeGreaterThan(1);
  });
});
