const { NodeMoveRule, NodeMoveRejected } = require('../NodeMoveRule');

/**
 * The tree the chains below are taken from:
 *
 *   a            b            feed
 *   └─ a1                     └─ f1
 *      └─ a1x                    └─ f1x
 *
 * A chain lists a node and its ancestors, the node first.
 */
const CHAINS = {
  a: ['a'],
  a1: ['a1', 'a'],
  a1x: ['a1x', 'a1', 'a'],
  b: ['b'],
  feed: ['feed'],
  f1: ['f1', 'feed'],
  f1x: ['f1x', 'f1', 'feed'],
};

/** Checks moving `nodeId` below `targetId` (`null`: to the top level). */
const check = (nodeId, targetId, feedRootId = 'feed') =>
  NodeMoveRule.check({
    nodeId,
    targetId,
    sourceChain: CHAINS[nodeId],
    targetChain: targetId ? CHAINS[targetId] : [],
    feedRootId,
  });

describe('NodeMoveRule', () => {
  describe('allowed moves', () => {
    it('allows a node below another node', () => {
      expect(() => check('a1', 'b')).not.toThrow();
    });

    it('allows a node below a node of another branch further down', () => {
      expect(() => check('b', 'a1x')).not.toThrow();
    });

    it('allows a node to the top level', () => {
      expect(() => check('a1', null)).not.toThrow();
    });

    it('allows any move when no feed root is configured', () => {
      expect(() => check('f1', 'a', null)).not.toThrow();
      expect(() => check('a1', 'f1', undefined)).not.toThrow();
    });
  });

  describe('below itself', () => {
    it('rejects the node itself as the new parent', () => {
      expect(() => check('a1', 'a1')).toThrow(NodeMoveRejected);
    });

    it('rejects a child as the new parent', () => {
      expect(() => check('a', 'a1')).toThrow(NodeMoveRejected);
    });

    it('rejects a deeper descendant as the new parent', () => {
      expect(() => check('a', 'a1x')).toThrow(NodeMoveRejected);
    });
  });

  describe('feeds', () => {
    it('rejects moving the feed root', () => {
      expect(() => check('feed', 'a')).toThrow(NodeMoveRejected);
    });

    it('rejects moving the feed root to the top level', () => {
      expect(() => check('feed', null)).toThrow(NodeMoveRejected);
    });

    it('rejects moving a feed', () => {
      expect(() => check('f1', 'a')).toThrow(NodeMoveRejected);
    });

    it('rejects moving a node below a feed', () => {
      expect(() => check('f1x', 'b')).toThrow(NodeMoveRejected);
    });

    it('rejects the feed root as the new parent', () => {
      expect(() => check('a1', 'feed')).toThrow(NodeMoveRejected);
    });

    it('rejects a feed as the new parent', () => {
      expect(() => check('a1', 'f1')).toThrow(NodeMoveRejected);
    });
  });

  describe('the rejection', () => {
    const reasonOf = (move) => {
      try {
        move();
      } catch (error) {
        return error;
      }
      return null;
    };

    it('is an Error with its own name', () => {
      const error = reasonOf(() => check('a1', 'a1'));

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('NodeMoveRejected');
    });

    it('names the reason for a move below itself', () => {
      expect(reasonOf(() => check('a', 'a1x')).message).toBe(
        'A node cannot be moved below itself'
      );
    });

    it('names the reason for moving a feed', () => {
      expect(reasonOf(() => check('f1', 'b')).message).toBe(
        'The feeds cannot be moved'
      );
    });

    it('names the reason for moving into the feeds', () => {
      expect(reasonOf(() => check('a1', 'f1')).message).toBe(
        'A node cannot be moved into the feeds'
      );
    });
  });
});
