const { test, expect } = require('@playwright/test');
const { gotoComponentPage } = require('../../support/component-page');

/**
 * `content-tree.mjs` — lookups on the content tree as `/api/1.0/contents`
 * delivers it: nodes `{ id, name, label, childnodes }` in any depth.
 *
 * Pure functions without DOM. The spec imports the module on a blank page of
 * the same origin and calls it there.
 */

const TREE = [
  {
    id: 'root-1',
    name: 'Root 1',
    childnodes: [
      {
        id: 'level-2',
        name: 'Level 2',
        childnodes: [
          {
            id: 'level-3',
            name: 'Level 3',
            childnodes: [{ id: 'level-4', name: 'Level 4', childnodes: [] }],
          },
        ],
      },
      { id: 'level-2-b', name: 'Level 2 B', childnodes: [] },
    ],
  },
  { id: 'root-2', name: 'Root 2', childnodes: [] },
];

/** Runs `fn(module, tree)` in the page and returns its result. */
function inPage(page, fn) {
  return page.evaluate(
    async ({ source, tree }) => {
      const module = await import('/modules/content-tree.mjs');
      // eslint-disable-next-line no-new-func
      return new Function(
        'module',
        'tree',
        `return (${source})(module, tree);`
      )(module, tree);
    },
    { source: fn.toString(), tree: TREE }
  );
}

const ids = (nodes) => nodes.map((node) => node.id);

test.describe('content-tree module', () => {
  test.beforeEach(async ({ page }) => {
    await gotoComponentPage(page);
  });

  test.describe('findPath', () => {
    test('returns the root alone for a root', async ({ page }) => {
      const path = await inPage(page, (m, tree) => m.findPath(tree, 'root-2'));

      expect(ids(path)).toEqual(['root-2']);
    });

    test('returns every ancestor down to a node on level 4', async ({
      page,
    }) => {
      const path = await inPage(page, (m, tree) => m.findPath(tree, 'level-4'));

      expect(ids(path)).toEqual(['root-1', 'level-2', 'level-3', 'level-4']);
    });

    test('returns an empty path for an unknown id', async ({ page }) => {
      const path = await inPage(page, (m, tree) => m.findPath(tree, 'nope'));

      expect(path).toEqual([]);
    });

    test('returns an empty path for an empty or missing tree', async ({
      page,
    }) => {
      const paths = await inPage(page, (m) => [
        m.findPath([], 'root-1'),
        m.findPath(undefined, 'root-1'),
      ]);

      expect(paths).toEqual([[], []]);
    });
  });

  test.describe('findNode', () => {
    test('finds a node on any level', async ({ page }) => {
      const names = await inPage(page, (m, tree) => [
        m.findNode(tree, 'root-1')?.name,
        m.findNode(tree, 'level-4')?.name,
        m.findNode(tree, 'level-2-b')?.name,
      ]);

      expect(names).toEqual(['Root 1', 'Level 4', 'Level 2 B']);
    });

    test('returns null for an unknown id', async ({ page }) => {
      const node = await inPage(page, (m, tree) => m.findNode(tree, 'nope'));

      expect(node).toBeNull();
    });
  });

  test.describe('findSiblings', () => {
    const pair = (siblings) => [
      siblings.previous?.id ?? null,
      siblings.next?.id ?? null,
    ];

    test('returns the neighbours in tree order', async ({ page }) => {
      test.fail(true, 'findSiblings does not exist yet');
      const result = await inPage(page, (m, tree) =>
        m.findSiblings(tree, 'level-2')
      );

      expect(pair(result)).toEqual([null, 'level-2-b']);
    });

    test('has no next on the last sibling', async ({ page }) => {
      test.fail(true, 'findSiblings does not exist yet');
      const result = await inPage(page, (m, tree) =>
        m.findSiblings(tree, 'level-2-b')
      );

      expect(pair(result)).toEqual(['level-2', null]);
    });

    test('has neither for an only child', async ({ page }) => {
      test.fail(true, 'findSiblings does not exist yet');
      const result = await inPage(page, (m, tree) =>
        m.findSiblings(tree, 'level-4')
      );

      expect(pair(result)).toEqual([null, null]);
    });

    test('treats the roots as siblings of each other', async ({ page }) => {
      test.fail(true, 'findSiblings does not exist yet');
      const result = await inPage(page, (m, tree) =>
        m.findSiblings(tree, 'root-2')
      );

      expect(pair(result)).toEqual(['root-1', null]);
    });

    test('has neither for an unknown id or a missing tree', async ({
      page,
    }) => {
      test.fail(true, 'findSiblings does not exist yet');
      const results = await inPage(page, (m, tree) => [
        m.findSiblings(tree, 'nope'),
        m.findSiblings(undefined, 'root-1'),
      ]);

      expect(results.map(pair)).toEqual([
        [null, null],
        [null, null],
      ]);
    });
  });
});
