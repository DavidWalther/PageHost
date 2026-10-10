const { SubtreeExclusion } = require('../SubtreeExclusion');

describe('SubtreeExclusion', () => {
  const buildTree = () => [
    {
      id: 'a',
      nodes: [
        { id: 'a1', nodes: [{ id: 'a1x', nodes: [] }] },
        { id: 'a2', nodes: [] },
      ],
    },
    { id: 'b', nodes: [{ id: 'b1', nodes: [] }] },
  ];

  const exclude = (tree, id) =>
    new SubtreeExclusion().setTree(tree).setExcludedId(id).getResult();

  const allIds = (nodes) =>
    nodes.flatMap((node) => [node.id, ...allIds(node.nodes ?? [])]);

  it('removes a root node together with its subtree', () => {
    expect(allIds(exclude(buildTree(), 'a'))).toEqual(['b', 'b1']);
  });

  it('removes a nested node together with its subtree', () => {
    expect(allIds(exclude(buildTree(), 'a1'))).toEqual(['a', 'a2', 'b', 'b1']);
  });

  it('keeps the tree when the id matches no node', () => {
    expect(allIds(exclude(buildTree(), 'nope'))).toEqual(allIds(buildTree()));
  });

  it('keeps the tree when no id is given', () => {
    [undefined, null, ''].forEach((id) => {
      expect(allIds(exclude(buildTree(), id))).toEqual(allIds(buildTree()));
    });
  });

  it('does not mutate the input tree', () => {
    const tree = buildTree();
    exclude(tree, 'a1');

    expect(tree).toEqual(buildTree());
  });

  it('keeps the other fields of the remaining nodes', () => {
    const tree = [{ id: 'a', name: 'A', nodes: [{ id: 'a1', name: 'A1' }] }];

    expect(exclude(tree, 'a1')).toEqual([{ id: 'a', name: 'A', nodes: [] }]);
  });

  it('leaves a node without children as it is', () => {
    const tree = [{ id: 'a' }, { id: 'b', nodes: null }];

    expect(exclude(tree, 'x')).toEqual([{ id: 'a' }, { id: 'b', nodes: null }]);
  });

  it('reads the children from the configured key', () => {
    const tree = [{ id: 'a', childnodes: [{ id: 'a1', childnodes: [] }] }];
    const result = new SubtreeExclusion()
      .setTree(tree)
      .setChildrenKey('childnodes')
      .setExcludedId('a1')
      .getResult();

    expect(result).toEqual([{ id: 'a', childnodes: [] }]);
  });

  it('returns a missing tree unchanged', () => {
    expect(exclude(null, 'a')).toBeNull();
    expect(exclude(undefined, 'a')).toBeUndefined();
  });
});
