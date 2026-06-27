const ContentVisibilityFilter = require('../ContentVisibilityFilter');

describe('ContentVisibilityFilter', () => {
  const PAST = '2020-01-01 00:00:00';
  const FUTURE = '2999-01-01 00:00:00';
  const CUTOFF = new Date('2025-01-01 00:00:00');

  it('keeps a node published on or before the cutoff', () => {
    const tree = [{ id: 'a', publishdate: PAST, childnodes: [] }];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setDate(CUTOFF)
      .getResult();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('removes a node published after the cutoff', () => {
    const tree = [{ id: 'a', publishdate: FUTURE, childnodes: [] }];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setDate(CUTOFF)
      .getResult();
    expect(result).toEqual([]);
  });

  it('removes a node without a publish date (null / missing / empty)', () => {
    const tree = [
      { id: 'null', publishdate: null, childnodes: [] },
      { id: 'missing', childnodes: [] },
      { id: 'empty', publishdate: '', childnodes: [] },
    ];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setDate(CUTOFF)
      .getResult();
    expect(result).toEqual([]);
  });

  it('treats the cutoff boundary as visible (<=)', () => {
    const tree = [{ id: 'a', publishdate: '2025-01-01 00:00:00', childnodes: [] }];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setDate(CUTOFF)
      .getResult();
    expect(result).toHaveLength(1);
  });

  it('removes an unpublished child but keeps published siblings', () => {
    const tree = [
      {
        id: 'story',
        publishdate: PAST,
        childnodes: [
          { id: 'visible', publishdate: PAST, childnodes: [] },
          { id: 'hidden', publishdate: FUTURE, childnodes: [] },
        ],
      },
    ];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setDate(CUTOFF)
      .getResult();
    expect(result[0].childnodes).toHaveLength(1);
    expect(result[0].childnodes[0].id).toBe('visible');
  });

  it('drops the whole subtree when the parent is unpublished', () => {
    const tree = [
      {
        id: 'story',
        publishdate: FUTURE,
        childnodes: [{ id: 'child', publishdate: PAST, childnodes: [] }],
      },
    ];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setDate(CUTOFF)
      .getResult();
    expect(result).toEqual([]);
  });

  it('does not mutate the input tree', () => {
    const tree = [
      {
        id: 'story',
        publishdate: PAST,
        childnodes: [
          { id: 'visible', publishdate: PAST, childnodes: [] },
          { id: 'hidden', publishdate: FUTURE, childnodes: [] },
        ],
      },
    ];
    const snapshot = JSON.parse(JSON.stringify(tree));
    new ContentVisibilityFilter().setTree(tree).setDate(CUTOFF).getResult();
    expect(tree).toEqual(snapshot);
  });

  it('supports a configurable children key (e.g. "chapters")', () => {
    const tree = [
      {
        id: 'story',
        publishdate: PAST,
        chapters: [
          { id: 'visible', publishdate: PAST },
          { id: 'hidden', publishdate: FUTURE },
        ],
      },
    ];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setChildrenKey('chapters')
      .setDate(CUTOFF)
      .getResult();
    expect(result[0].chapters).toHaveLength(1);
    expect(result[0].chapters[0].id).toBe('visible');
  });

  it('accepts a date string as cutoff', () => {
    const tree = [{ id: 'a', publishdate: PAST, childnodes: [] }];
    const result = new ContentVisibilityFilter()
      .setTree(tree)
      .setDate('2025-01-01 00:00:00')
      .getResult();
    expect(result).toHaveLength(1);
  });

  it('filters a single node (non-array tree)', () => {
    const visible = new ContentVisibilityFilter()
      .setTree({ id: 'a', publishdate: PAST, childnodes: [] })
      .setDate(CUTOFF)
      .getResult();
    expect(visible.id).toBe('a');

    const hidden = new ContentVisibilityFilter()
      .setTree({ id: 'a', publishdate: FUTURE, childnodes: [] })
      .setDate(CUTOFF)
      .getResult();
    expect(hidden).toBeNull();
  });

  it('returns null/undefined tree unchanged', () => {
    expect(
      new ContentVisibilityFilter().setTree(null).setDate(CUTOFF).getResult()
    ).toBeNull();
    expect(
      new ContentVisibilityFilter().setTree(undefined).setDate(CUTOFF).getResult()
    ).toBeUndefined();
  });
});
