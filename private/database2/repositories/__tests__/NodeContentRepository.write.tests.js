/**
 * Schreibpfad des `NodeContentRepository` — je Operation.
 *
 * Gemockt ist nur der `pgConnector`. Die Transaktion wird nachgebildet: der
 * Test sammelt jedes Statement mit seinen gebundenen Werten, sodass die
 * **Reihenfolge** prüfbar ist. Genau darauf kommt es beim Löschen an —
 * `ON DELETE RESTRICT` verzeiht keine falsche Reihenfolge.
 */

jest.mock('../../DataStorage/pgConnector.js');
jest.mock('../../../modules/logging');

const { PostgresActions } = require('../../DataStorage/pgConnector.js');
const { NodeContentRepository } = require('../NodeContentRepository.js');
const { NodeMoveRejected } = require('../../../modules/NodeMoveRule.js');

const APPLICATION_KEY = 'schreibApp';

/** Ausgeführte Statements: `{ sql, parameters }` in Reihenfolge. */
let executed;
/**
 * Antworten je Statement-Muster; erste Übereinstimmung gewinnt. Eine Antwort
 * darf eine Funktion der gebundenen Werte sein.
 */
let responses;
/** Wurde die Transaktion angefordert? */
let transactionUsed;

function respondWith(pattern, rows) {
  responses.push({ pattern, rows });
}

function createRepository() {
  return new NodeContentRepository({
    APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
  }).setApplicationKey(APPLICATION_KEY);
}

/** Alle Statements, die auf das Muster passen. */
function statementsMatching(pattern) {
  return executed.filter((entry) => entry.sql.includes(pattern));
}

/** Position des ersten Statements zu einem Muster (-1, wenn keins). */
function positionOf(pattern) {
  return executed.findIndex((entry) => entry.sql.includes(pattern));
}

beforeEach(() => {
  executed = [];
  responses = [];
  transactionUsed = false;

  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    transaction: jest.fn(async (callback) => {
      transactionUsed = true;
      return callback(async (sql, parameters = []) => {
        executed.push({ sql, parameters });
        const match = responses.find((entry) => sql.includes(entry.pattern));
        if (!match) {
          return [];
        }
        return typeof match.rows === 'function'
          ? match.rows(parameters)
          : match.rows;
      });
    }),
    executeParameterizedSql: jest.fn(async () => []),
  }));
});

describe('NodeContentRepository — Schreibpfad', () => {
  describe('createRecord: Wurzelknoten', () => {
    beforeEach(() => {
      respondWith('INSERT INTO node', [{ id: 'n-neu', name: 'Neuer Knoten' }]);
    });

    it('läuft in einer Transaktion', async () => {
      await createRepository().createRecord('node', { name: 'Neuer Knoten' });

      expect(transactionUsed).toBe(true);
    });

    it('legt den Knoten mit Vererbung an — Vererbung ist der Normalfall', async () => {
      await createRepository().createRecord('node', { name: 'Neuer Knoten' });

      const [insert] = statementsMatching('INSERT INTO node');
      const position = insert.sql
        .slice(insert.sql.indexOf('(') + 1, insert.sql.indexOf(')'))
        .split(', ')
        .indexOf('is_parent_controls_visibility');
      expect(insert.parameters[position]).toBe(true);
    });

    it('bindet die Werte, statt sie in den Text zu schreiben', async () => {
      await createRepository().createRecord('node', {
        name: "Robert'); DROP TABLE node;--",
      });

      const [insert] = statementsMatching('INSERT INTO node');
      expect(insert.sql).not.toContain('DROP TABLE');
      expect(insert.parameters).toContain("Robert'); DROP TABLE node;--");
    });

    it('hängt eine app_node-Zeile für die eigene App an', async () => {
      await createRepository().createRecord('node', { name: 'Neuer Knoten' });

      const [appNode] = statementsMatching('INSERT INTO app_node');
      expect(appNode.sql).toContain("'include'");
      expect(appNode.parameters).toEqual(['n-neu', APPLICATION_KEY]);
    });

    it('gibt die Id des angelegten Datensatzes zurück', async () => {
      const record = await createRepository().createRecord('node', {
        name: 'Neuer Knoten',
      });

      expect(record.id).toBe('n-neu');
    });
  });

  describe('createRecord: Kind-Knoten', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE legacy_id', [{ id: 'n-story' }]);
      respondWith('INSERT INTO node', [{ id: 'n-kapitel' }]);
    });

    it('löst eine alte Referenz auf die neue Id auf', async () => {
      await createRepository().createRecord('node', {
        parent_node_id: '000s00000000000011',
        name: 'Kapitel',
      });

      const [resolve] = statementsMatching('SELECT id FROM node WHERE');
      expect(resolve.parameters).toEqual(['000s00000000000011']);

      const [insert] = statementsMatching('INSERT INTO node');
      expect(insert.parameters).toContain('n-story');
      expect(insert.parameters).not.toContain('000s00000000000011');
    });

    it('legt KEINE app_node-Zeile an — das Kind erbt vom Parent', async () => {
      await createRepository().createRecord('node', {
        parent_node_id: '000s00000000000011',
        name: 'Kapitel',
      });

      expect(statementsMatching('INSERT INTO app_node')).toHaveLength(0);
    });

    it('bricht ab, wenn die Referenz ins Leere zeigt', async () => {
      responses = [];
      respondWith('SELECT id FROM node WHERE', []);

      await expect(
        createRepository().createRecord('node', {
          parent_node_id: '000s99999999999999',
          name: 'Kapitel',
        })
      ).rejects.toThrow('Referenced node not found');
    });
  });

  describe('createRecord: Inhalt', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-kapitel' }]);
      respondWith('INSERT INTO content_node', [{ id: 'cn-neu' }]);
    });

    it('legt content_node und je Repräsentation eine content_item-Zeile an', async () => {
      await createRepository().createRecord('content', {
        node_id: '000c00000000000022',
        name: 'Absatz',
        content: 'Reiner Text',
        htmlcontent: '<p>Reiner Text</p>',
      });

      const items = statementsMatching('INSERT INTO content_item');
      expect(items).toHaveLength(2);
      expect(items.map((entry) => entry.parameters[1]).sort()).toEqual([
        'html',
        'text',
      ]);
    });

    it('setzt den Zeiger auf die aktive Fassung', async () => {
      await createRepository().createRecord('content', {
        node_id: '000c00000000000022',
        content: 'Reiner Text',
        htmlcontent: '<p>Reiner Text</p>',
      });

      const [pointer] = statementsMatching('SET active_content_item = (');
      expect(pointer.parameters).toEqual(['cn-neu', 'html']);
    });

    it('macht Text zur aktiven Fassung, wenn HTML leer ist', async () => {
      await createRepository().createRecord('content', {
        node_id: '000c00000000000022',
        content: 'Reiner Text',
        htmlcontent: '',
      });

      const [pointer] = statementsMatching('SET active_content_item = (');
      expect(pointer.parameters).toEqual(['cn-neu', 'text']);
    });

    it('verlangt eine Knoten-Referenz', async () => {
      await expect(
        createRepository().createRecord('content', { name: 'Absatz' })
      ).rejects.toThrow('requires a chapter reference');
    });
  });

  describe('updateRecord', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-kapitel' }]);
      respondWith('UPDATE node SET', [{ id: 'n-kapitel', name: 'Neu' }]);
    });

    it('schreibt nur die übergebenen Felder, gebunden', async () => {
      await createRepository().updateRecord('node', {
        id: '000c00000000000022',
        name: 'Neu',
        sortnumber: 5,
      });

      const [update] = statementsMatching('UPDATE node SET');
      expect(update.sql).toContain('name = $1');
      expect(update.sql).toContain('sortnumber = $2');
      expect(update.parameters).toEqual(['Neu', 5, 'n-kapitel']);
    });

    it('veröffentlicht über dasselbe published_date-Feld', async () => {
      await createRepository().updateRecord('node', {
        id: '000c00000000000022',
        published_date: '2026-08-02T10:00:00.000Z',
      });

      const [update] = statementsMatching('UPDATE node SET');
      expect(update.sql).toContain('published_date = $1');
      expect(update.parameters[0]).toBe('2026-08-02T10:00:00.000Z');
    });

    it('zieht mit published_date null zurück', async () => {
      await createRepository().updateRecord('node', {
        id: '000c00000000000022',
        published_date: null,
      });

      const [update] = statementsMatching('UPDATE node SET');
      expect(update.parameters[0]).toBeNull();
    });

    it('bricht ab, wenn der Datensatz nicht existiert', async () => {
      responses = [];
      respondWith('SELECT id FROM node WHERE', []);

      await expect(
        createRepository().updateRecord('node', { id: '000c99999999999999' })
      ).rejects.toThrow('Record not found');
    });

    it('verlangt eine Id', async () => {
      await expect(
        createRepository().updateRecord('node', { name: 'Neu' })
      ).rejects.toThrow('Update requires an id');
    });

    it('aktualisiert beim Inhalt auch die Repräsentationen', async () => {
      responses = [];
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
      respondWith('UPDATE content_node SET name', [{ id: 'cn-1' }]);

      await createRepository().updateRecord('content', {
        id: '000p00000000000033',
        name: 'Absatz',
        content: 'neuer Text',
        htmlcontent: null,
      });

      const items = statementsMatching('INSERT INTO content_item');
      expect(items).toHaveLength(2);
      expect(statementsMatching('SET active_content_item = (')).toHaveLength(1);
    });

    it('macht eine vorhandene, aber leere Fassung zur aktiven', async () => {
      // Der Editor schickt eine vorhandene Fassung auch dann mit, wenn sie
      // leer ist (`null`) — nur so kann der Zeiger auf ihr `content_item`
      // zeigen. Eine Fassung, die es nicht gibt, fehlt dagegen im Payload.
      responses = [];
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
      respondWith('UPDATE content_node SET name', [{ id: 'cn-1' }]);

      await createRepository().updateRecord('content', {
        id: '00cn00000000000001',
        name: 'Absatz',
        content: 'Vorhandener Text',
        htmlcontent: null,
        active_type: 'html',
      });

      const [zeiger] = statementsMatching('SET active_content_item = (');
      expect(zeiger.parameters).toEqual(['cn-1', 'html']);
    });

    it('lässt den Zeiger stehen, wenn die gewünschte Fassung fehlt', async () => {
      // Ein Typ ohne mitgeschickte Fassung darf den Zeiger nicht bewegen: Es
      // gibt kein `content_item`, auf das er zeigen könnte.
      responses = [];
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
      respondWith('UPDATE content_node SET name', [{ id: 'cn-1' }]);

      await createRepository().updateRecord('content', {
        id: '00cn00000000000001',
        name: 'Absatz',
        content: 'Vorhandener Text',
        active_type: 'html',
      });

      const [zeiger] = statementsMatching('SET active_content_item = (');
      expect(zeiger.parameters).toEqual(['cn-1', 'text']);
    });

    it('kommt mit einem Payload ohne setzbare Felder zurecht', async () => {
      // Der Editor schickt seinen ganzen Datensatz — auch wenn sich nur der
      // Inhalt geändert hat.
      responses = [];
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
      respondWith('SELECT * FROM content_node', [{ id: 'cn-1' }]);

      const record = await createRepository().updateRecord('content', {
        id: '000p00000000000033',
        content: 'nur der Text',
      });

      expect(statementsMatching('UPDATE content_node SET name')).toHaveLength(
        0
      );
      expect(record.id).toBe('cn-1');
    });
  });

  describe('deleteRecord: Inhalt', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
    });

    it('löst erst den Zeiger, dann die Items, dann den Halter', async () => {
      await createRepository().deleteRecord('content', '000p00000000000033');

      expect(positionOf('SET active_content_item = NULL')).toBeLessThan(
        positionOf('DELETE FROM content_item')
      );
      expect(positionOf('DELETE FROM content_item')).toBeLessThan(
        positionOf('DELETE FROM content_node')
      );
    });
  });

  describe('deleteRecord: Knoten', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-story' }]);
      // Teilbaum, tiefste Ebene zuerst
      respondWith('WITH RECURSIVE descendants', [
        { id: 'n-kapitel' },
        { id: 'n-story' },
      ]);
      respondWith('SELECT id, legacy_id FROM content_node WHERE node_id', [
        { id: 'cn-1' },
      ]);
    });

    it('räumt den ganzen Teilbaum ab, in RESTRICT-Reihenfolge', async () => {
      await createRepository().deleteRecord('node', '000s00000000000011');

      const reihenfolge = [
        'SET active_content_item = NULL',
        'DELETE FROM content_item',
        'DELETE FROM content_node',
        'SET cover_node_id = NULL',
        'DELETE FROM app_node',
        'DELETE FROM node',
      ].map(positionOf);

      expect(reihenfolge).toEqual([...reihenfolge].sort((a, b) => a - b));
      expect(reihenfolge.every((position) => position >= 0)).toBe(true);
    });

    it('löscht die Knoten einzeln, Kinder vor Eltern', async () => {
      await createRepository().deleteRecord('node', '000s00000000000011');

      const deletes = statementsMatching('DELETE FROM node WHERE id');
      expect(deletes.map((entry) => entry.parameters[0])).toEqual([
        'n-kapitel',
        'n-story',
      ]);
    });

    it('nullt cover_node_id auch außerhalb des Teilbaums', async () => {
      await createRepository().deleteRecord('node', '000s00000000000011');

      const [cover] = statementsMatching('SET cover_node_id = NULL');
      expect(cover.sql).toContain('WHERE cover_node_id = ANY($1)');
      expect(cover.parameters[0]).toEqual(['n-kapitel', 'n-story']);
    });

    it('bricht ab, wenn der Knoten nicht existiert', async () => {
      responses = [];
      respondWith('SELECT id FROM node WHERE', []);

      await expect(
        createRepository().deleteRecord('node', '000s99999999999999')
      ).rejects.toThrow('Record not found');
    });
  });
});

// ─── Typfreie Objektnamen ──────────────────────────────────────────────────

describe('Schreibpfad unter den Namen node und content', () => {
  describe('createRecord: node', () => {
    beforeEach(() => {
      respondWith('INSERT INTO node', [{ id: 'n-neu', legacy_id: null }]);
    });

    it('vergibt keine Kompat-Id mehr', async () => {
      // Die Vergabe endet mit dem Frontend-Umbau (`datamodel.md`, Abschnitt 8):
      // wer über `node` schreibt, liest den Typ nicht mehr am Präfix.
      await createRepository().createRecord('node', { name: 'Neuer Knoten' });

      expect(statementsMatching('AS legacy_id')).toEqual([]);
      const [insert] = statementsMatching('INSERT INTO node');
      expect(insert.sql).not.toContain('legacy_id');
    });

    it('gibt die neue Id nach außen zurück', async () => {
      const record = await createRepository().createRecord('node', {
        name: 'Neuer Knoten',
      });

      expect(record.id).toBe('n-neu');
    });

    it('nimmt die Spaltennamen des neuen Modells entgegen', async () => {
      respondWith('SELECT id FROM node WHERE legacy_id', [{ id: 'n-eltern' }]);

      await createRepository().createRecord('node', {
        name: 'Kind',
        sortnumber: 3,
        parent_node_id: 'n-eltern',
        published_date: '2026-01-01',
      });

      const [insert] = statementsMatching('INSERT INTO node');
      expect(insert.sql).toContain('parent_node_id');
      expect(insert.sql).toContain('published_date');
      expect(insert.parameters).toContain('n-eltern');
    });

    it('hängt nur bei einem Wurzelknoten eine app_node-Zeile an', async () => {
      respondWith('SELECT id FROM node WHERE legacy_id', [{ id: 'n-eltern' }]);

      await createRepository().createRecord('node', {
        name: 'Kind',
        parent_node_id: 'n-eltern',
      });

      expect(statementsMatching('INSERT INTO app_node')).toEqual([]);
    });
  });

  describe('createRecord: content', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE legacy_id', [{ id: 'n-knoten' }]);
      respondWith('INSERT INTO content_node', [
        { id: 'cn-neu', legacy_id: null },
      ]);
      respondWith('SELECT id FROM content_node WHERE legacy_id', [
        { id: 'cn-neu' },
      ]);
    });

    it('legt den Halter ohne Kompat-Id an', async () => {
      await createRepository().createRecord('content', {
        node_id: 'n-knoten',
        name: 'Neuer Inhalt',
      });

      expect(statementsMatching('AS legacy_id')).toEqual([]);
      const [insert] = statementsMatching('INSERT INTO content_node');
      expect(insert.sql).not.toContain('legacy_id');
    });

    it('schreibt die Repräsentationen wie beim Absatz', async () => {
      await createRepository().createRecord('content', {
        node_id: 'n-knoten',
        content: 'Text',
        htmlcontent: '<p>Text</p>',
      });

      const items = statementsMatching('INSERT INTO content_item');
      expect(items.map((entry) => entry.parameters[1])).toEqual([
        'text',
        'html',
      ]);
      const [pointer] = statementsMatching('SET active_content_item = (');
      expect(pointer.parameters).toEqual(['cn-neu', 'html']);
    });

    it('verlangt einen Knoten', async () => {
      await expect(
        createRepository().createRecord('content', { name: 'Ohne Knoten' })
      ).rejects.toThrow('requires a chapter reference');
    });
  });

  describe('updateRecord und deleteRecord', () => {
    it('ändert einen Knoten über seine neue Id', async () => {
      respondWith('SELECT id FROM node WHERE legacy_id', [{ id: 'n-1' }]);
      respondWith('UPDATE node SET', [{ id: 'n-1', legacy_id: '000s1' }]);

      const record = await createRepository().updateRecord('node', {
        id: 'n-1',
        name: 'Neuer Name',
      });

      // Auch wenn der Bestandsknoten noch eine alte Id trägt: unter dem Namen
      // `node` geht die neue nach außen.
      expect(record.id).toBe('n-1');
    });

    it('löscht einen Knoten samt Teilbaum wie unter dem alten Namen', async () => {
      respondWith('SELECT id FROM node WHERE legacy_id', [{ id: 'n-1' }]);
      respondWith('WITH RECURSIVE', [{ id: 'n-kind' }, { id: 'n-1' }]);

      await createRepository().deleteRecord('node', 'n-1');

      expect(positionOf('DELETE FROM app_node')).toBeLessThan(
        positionOf('DELETE FROM node')
      );
    });

    it('löscht einen Inhalt über content', async () => {
      respondWith('SELECT id FROM content_node WHERE legacy_id', [
        { id: 'cn-1' },
      ]);

      await createRepository().deleteRecord('content', 'cn-1');

      expect(positionOf('DELETE FROM content_item')).toBeLessThan(
        positionOf('DELETE FROM content_node')
      );
    });
  });
});

/**
 * Moving: an update whose `parent_node_id` differs from the stored one.
 *
 * The tree behind the answers:
 *
 *   n-a            n-b            n-feed
 *   └─ n-a1                       └─ n-f1
 *      └─ n-a1x
 */
describe('updateRecord: moving a node', () => {
  const PARENTS = {
    'n-a': null,
    'n-a1': 'n-a',
    'n-a1x': 'n-a1',
    'n-b': null,
    'n-feed': null,
    'n-f1': 'n-feed',
  };
  const LEGACY_IDS = { 'n-a1': '000c1', 'n-a': '000s1' };

  const chainOf = (id) => {
    const chain = [];
    for (let current = id; current; current = PARENTS[current]) {
      chain.push({ id: current });
    }
    return chain;
  };

  beforeEach(() => {
    respondWith('RECURSIVE ancestors', ([id]) => chainOf(id));
    respondWith('SELECT parent_node_id FROM node WHERE id = $1', ([id]) => [
      { parent_node_id: PARENTS[id] },
    ]);
    respondWith('SELECT id, legacy_id FROM node WHERE id = ANY($1)', ([ids]) =>
      ids.map((id) => ({ id, legacy_id: LEGACY_IDS[id] ?? null }))
    );
    respondWith('SELECT id FROM node WHERE', ([id]) =>
      id in PARENTS ? [{ id }] : []
    );
    respondWith('UPDATE node SET', [{ id: 'n-a1' }]);
  });

  const move = (id, parentId, repository = createRepository()) =>
    repository.updateRecord('node', {
      id,
      parent_node_id: parentId,
      sortnumber: null,
    });

  it('reads no chain when no parent is sent', async () => {
    await createRepository().updateRecord('node', { id: 'n-a1', name: 'Neu' });

    expect(statementsMatching('SELECT parent_node_id')).toHaveLength(0);
    expect(statementsMatching('RECURSIVE ancestors')).toHaveLength(0);
  });

  it('reads no chain when the parent stays the same', async () => {
    await move('n-a1', 'n-a');

    expect(statementsMatching('RECURSIVE ancestors')).toHaveLength(0);
  });

  it('reads the chains of the node and of the new parent', async () => {
    await move('n-a1', 'n-b');

    expect(
      statementsMatching('RECURSIVE ancestors').map((entry) => entry.parameters)
    ).toEqual([['n-a1'], ['n-b']]);
  });

  it('writes the new parent and the empty sortnumber', async () => {
    await move('n-a1', 'n-b');

    const [update] = statementsMatching('UPDATE node SET');
    expect(update.sql).toContain('parent_node_id = $1');
    expect(update.sql).toContain('sortnumber = $2');
    expect(update.parameters).toEqual(['n-b', null, 'n-a1']);
  });

  it('rejects a move below the node itself and writes nothing', async () => {
    await expect(move('n-a', 'n-a1x')).rejects.toThrow(NodeMoveRejected);

    expect(statementsMatching('UPDATE node SET')).toHaveLength(0);
  });

  it('rejects a move into the feeds once the feed root is known', async () => {
    const repository = createRepository().setFeedRootId('n-feed');

    await expect(move('n-a1', 'n-f1', repository)).rejects.toThrow(
      NodeMoveRejected
    );
    expect(statementsMatching('UPDATE node SET')).toHaveLength(0);
  });

  it('rejects moving a feed once the feed root is known', async () => {
    const repository = createRepository().setFeedRootId('n-feed');

    await expect(move('n-f1', 'n-a', repository)).rejects.toThrow(
      NodeMoveRejected
    );
  });

  it('adds an include row for the own app when the node becomes a root', async () => {
    await move('n-a1', null);

    const [include] = statementsMatching('INSERT INTO app_node');
    expect(include.parameters).toEqual(['n-a1', APPLICATION_KEY]);
    expect(positionOf('UPDATE node SET')).toBeLessThan(
      positionOf('INSERT INTO app_node')
    );
  });

  it('adds no include row when the node moves below another node', async () => {
    await move('n-a1', 'n-b');

    expect(statementsMatching('INSERT INTO app_node')).toHaveLength(0);
  });

  it('names the node and both parents as touched, with both ids', async () => {
    const repository = createRepository();
    await move('n-a1', 'n-b', repository);

    // A set, not a sequence: Postgres returns `ANY` matches in its own order.
    expect(repository.getTouchedNodes()).toHaveLength(3);
    expect(repository.getTouchedNodes()).toEqual(
      expect.arrayContaining([
        { id: 'n-a1', legacy_id: '000c1' },
        { id: 'n-a', legacy_id: '000s1' },
        { id: 'n-b', legacy_id: null },
      ])
    );
  });

  it('names only the node and its old parent when it becomes a root', async () => {
    const repository = createRepository();
    await move('n-a1', null, repository);

    expect(
      repository
        .getTouchedNodes()
        .map((node) => node.id)
        .sort()
    ).toEqual(['n-a', 'n-a1']);
  });

  it('names no touched nodes when nothing moved', async () => {
    const repository = createRepository();
    await move('n-a1', 'n-a', repository);

    expect(repository.getTouchedNodes()).toEqual([]);
  });
});

/**
 * A cached node carries its children and its contents. Creating or deleting
 * one changes the entry of the node it hangs on, so the repository names that
 * node for the facade to clear — as after a move.
 */
describe('touched nodes after creating and deleting', () => {
  const LEGACY_IDS = { 'n-parent': '000s1', 'n-holder': '000c1' };

  beforeEach(() => {
    respondWith('SELECT id, legacy_id FROM node WHERE id = ANY($1)', ([ids]) =>
      ids.map((id) => ({ id, legacy_id: LEGACY_IDS[id] ?? null }))
    );
  });

  it('names the parent of a created child', async () => {
    respondWith('SELECT id FROM node WHERE', [{ id: 'n-parent' }]);
    respondWith('INSERT INTO node', [{ id: 'n-new' }]);
    const repository = createRepository();

    await repository.createRecord('node', {
      name: 'Neu',
      parent_node_id: 'n-parent',
    });

    expect(repository.getTouchedNodes()).toEqual([
      { id: 'n-parent', legacy_id: '000s1' },
    ]);
  });

  it('names nothing for a created root', async () => {
    respondWith('INSERT INTO node', [{ id: 'n-new' }]);
    const repository = createRepository();

    await repository.createRecord('node', { name: 'Neu' });

    expect(repository.getTouchedNodes()).toEqual([]);
  });

  it('names the node a created content hangs on', async () => {
    respondWith('SELECT id FROM node WHERE', [{ id: 'n-holder' }]);
    respondWith('INSERT INTO content_node', [{ id: 'cn-new' }]);
    const repository = createRepository();

    await repository.createRecord('content', {
      name: 'Absatz',
      node_id: 'n-holder',
      content: 'Text',
    });

    expect(repository.getTouchedNodes()).toEqual([
      { id: 'n-holder', legacy_id: '000c1' },
    ]);
  });

  it('names the parent of a deleted node, read before the delete', async () => {
    respondWith('SELECT id FROM node WHERE', [{ id: 'n-gone' }]);
    respondWith('SELECT parent_node_id FROM node WHERE id = $1', [
      { parent_node_id: 'n-parent' },
    ]);
    respondWith('WITH RECURSIVE', [{ id: 'n-gone' }]);
    const repository = createRepository();

    await repository.deleteRecord('node', 'n-gone');

    expect(repository.getTouchedNodes()).toEqual([
      { id: 'n-parent', legacy_id: '000s1' },
    ]);
    expect(positionOf('SELECT parent_node_id')).toBeLessThan(
      positionOf('DELETE FROM node')
    );
  });

  it('names the node of a deleted content', async () => {
    respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-gone' }]);
    respondWith('SELECT id, legacy_id, node_id FROM content_node', [
      { id: 'cn-gone', legacy_id: null, node_id: 'n-holder' },
    ]);
    const repository = createRepository();

    await repository.deleteRecord('content', 'cn-gone');

    expect(repository.getTouchedNodes()).toEqual([
      { id: 'n-holder', legacy_id: '000c1' },
    ]);
  });
});
