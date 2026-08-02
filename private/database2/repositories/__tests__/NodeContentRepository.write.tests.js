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

const APPLICATION_KEY = 'schreibApp';

/** Ausgeführte Statements: `{ sql, parameters }` in Reihenfolge. */
let executed;
/** Antworten je Statement-Muster; erste Übereinstimmung gewinnt. */
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
        return match ? match.rows : [];
      });
    }),
    executeParameterizedSql: jest.fn(async () => []),
  }));
});

describe('NodeContentRepository — Schreibpfad', () => {
  describe('createRecord: Story', () => {
    beforeEach(() => {
      respondWith('AS legacy_id', [{ legacy_id: '000s00000000000099' }]);
      respondWith('INSERT INTO node', [
        { id: 'n-neu', legacy_id: '000s00000000000099', name: 'Neue Story' },
      ]);
    });

    it('läuft in einer Transaktion', async () => {
      await createRepository().createRecord('story', { name: 'Neue Story' });

      expect(transactionUsed).toBe(true);
    });

    it('vergibt eine Kompat-Id im alten Präfix-Schema', async () => {
      await createRepository().createRecord('story', { name: 'Neue Story' });

      const [mint] = statementsMatching('AS legacy_id');
      expect(mint.parameters).toEqual(['000s']);

      const [insert] = statementsMatching('INSERT INTO node');
      expect(insert.sql).toContain('legacy_id');
      expect(insert.parameters).toContain('000s00000000000099');
    });

    it('legt den Knoten mit Vererbung an — Vererbung ist der Normalfall', async () => {
      await createRepository().createRecord('story', { name: 'Neue Story' });

      const [insert] = statementsMatching('INSERT INTO node');
      const position = insert.sql
        .slice(insert.sql.indexOf('(') + 1, insert.sql.indexOf(')'))
        .split(', ')
        .indexOf('is_parent_controls_visibility');
      expect(insert.parameters[position]).toBe(true);
    });

    it('bindet die Werte, statt sie in den Text zu schreiben', async () => {
      await createRepository().createRecord('story', {
        name: "Robert'); DROP TABLE node;--",
      });

      const [insert] = statementsMatching('INSERT INTO node');
      expect(insert.sql).not.toContain('DROP TABLE');
      expect(insert.parameters).toContain("Robert'); DROP TABLE node;--");
    });

    it('hängt eine app_node-Zeile für die eigene App an', async () => {
      await createRepository().createRecord('story', { name: 'Neue Story' });

      const [appNode] = statementsMatching('INSERT INTO app_node');
      expect(appNode.sql).toContain("'include'");
      expect(appNode.parameters).toEqual(['n-neu', APPLICATION_KEY]);
    });

    it('gibt die alte Id nach außen zurück', async () => {
      const record = await createRepository().createRecord('story', {
        name: 'Neue Story',
      });

      expect(record.id).toBe('000s00000000000099');
    });
  });

  describe('createRecord: Kapitel', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE legacy_id', [{ id: 'n-story' }]);
      respondWith('AS legacy_id', [{ legacy_id: '000c00000000000099' }]);
      respondWith('INSERT INTO node', [
        { id: 'n-kapitel', legacy_id: '000c00000000000099' },
      ]);
    });

    it('löst die alte Story-Id auf die neue Parent-Id auf', async () => {
      await createRepository().createRecord('chapter', {
        storyId: '000s00000000000011',
        name: 'Kapitel',
      });

      const [resolve] = statementsMatching('SELECT id FROM node WHERE');
      expect(resolve.parameters).toEqual(['000s00000000000011']);

      const [insert] = statementsMatching('INSERT INTO node');
      expect(insert.parameters).toContain('n-story');
      expect(insert.parameters).not.toContain('000s00000000000011');
    });

    it('legt KEINE app_node-Zeile an — das Kapitel erbt vom Parent', async () => {
      await createRepository().createRecord('chapter', {
        storyId: '000s00000000000011',
        name: 'Kapitel',
      });

      expect(statementsMatching('INSERT INTO app_node')).toHaveLength(0);
    });

    it('bricht ab, wenn die Referenz ins Leere zeigt', async () => {
      responses = [];
      respondWith('SELECT id FROM node WHERE', []);

      await expect(
        createRepository().createRecord('chapter', {
          storyId: '000s99999999999999',
          name: 'Kapitel',
        })
      ).rejects.toThrow('Referenced node not found');
    });
  });

  describe('createRecord: Absatz', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-kapitel' }]);
      respondWith('AS legacy_id', [{ legacy_id: '000p00000000000099' }]);
      respondWith('INSERT INTO content_node', [
        { id: 'cn-neu', legacy_id: '000p00000000000099' },
      ]);
    });

    it('legt content_node und je Repräsentation eine content_item-Zeile an', async () => {
      await createRepository().createRecord('paragraph', {
        chapterId: '000c00000000000022',
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
      await createRepository().createRecord('paragraph', {
        chapterId: '000c00000000000022',
        content: 'Reiner Text',
        htmlcontent: '<p>Reiner Text</p>',
      });

      const [pointer] = statementsMatching('SET active_content_item = (');
      expect(pointer.parameters).toEqual(['cn-neu', 'html']);
    });

    it('macht Text zur aktiven Fassung, wenn HTML leer ist', async () => {
      await createRepository().createRecord('paragraph', {
        chapterId: '000c00000000000022',
        content: 'Reiner Text',
        htmlcontent: '',
      });

      const [pointer] = statementsMatching('SET active_content_item = (');
      expect(pointer.parameters).toEqual(['cn-neu', 'text']);
    });

    it('verlangt eine Kapitel-Referenz', async () => {
      await expect(
        createRepository().createRecord('paragraph', { name: 'Absatz' })
      ).rejects.toThrow('requires a chapter reference');
    });
  });

  describe('updateRecord', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM node WHERE', [{ id: 'n-kapitel' }]);
      respondWith('UPDATE node SET', [
        { id: 'n-kapitel', legacy_id: '000c00000000000022', name: 'Neu' },
      ]);
    });

    it('schreibt nur die übergebenen Felder, gebunden', async () => {
      await createRepository().updateRecord('chapter', {
        id: '000c00000000000022',
        name: 'Neu',
        sortNumber: 5,
      });

      const [update] = statementsMatching('UPDATE node SET');
      expect(update.sql).toContain('name = $1');
      expect(update.sql).toContain('sortnumber = $2');
      expect(update.parameters).toEqual(['Neu', 5, 'n-kapitel']);
    });

    it('veröffentlicht über dasselbe publishDate-Feld', async () => {
      await createRepository().updateRecord('chapter', {
        id: '000c00000000000022',
        publishDate: '2026-08-02T10:00:00.000Z',
      });

      const [update] = statementsMatching('UPDATE node SET');
      expect(update.sql).toContain('published_date = $1');
      expect(update.parameters[0]).toBe('2026-08-02T10:00:00.000Z');
    });

    it('zieht mit publishDate null zurück', async () => {
      await createRepository().updateRecord('chapter', {
        id: '000c00000000000022',
        publishDate: null,
      });

      const [update] = statementsMatching('UPDATE node SET');
      expect(update.parameters[0]).toBeNull();
    });

    it('bricht ab, wenn der Datensatz nicht existiert', async () => {
      responses = [];
      respondWith('SELECT id FROM node WHERE', []);

      await expect(
        createRepository().updateRecord('chapter', { id: '000c99999999999999' })
      ).rejects.toThrow('Record not found');
    });

    it('verlangt eine Id', async () => {
      await expect(
        createRepository().updateRecord('chapter', { name: 'Neu' })
      ).rejects.toThrow('Update requires an id');
    });

    it('aktualisiert beim Absatz auch die Inhalte', async () => {
      responses = [];
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
      respondWith('UPDATE content_node SET name', [{ id: 'cn-1' }]);

      await createRepository().updateRecord('paragraph', {
        id: '000p00000000000033',
        name: 'Absatz',
        content: 'neuer Text',
        htmlcontent: null,
      });

      const items = statementsMatching('INSERT INTO content_item');
      expect(items).toHaveLength(2);
      expect(statementsMatching('SET active_content_item = (')).toHaveLength(1);
    });

    it('kommt mit einem Payload ohne setzbare Felder zurecht', async () => {
      // Der Absatz schickt seinen ganzen Datensatz — auch wenn sich nur der
      // Inhalt geändert hat.
      responses = [];
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
      respondWith('SELECT * FROM content_node', [
        { id: 'cn-1', legacy_id: '000p00000000000033' },
      ]);

      const record = await createRepository().updateRecord('paragraph', {
        id: '000p00000000000033',
        content: 'nur der Text',
      });

      expect(statementsMatching('UPDATE content_node SET name')).toHaveLength(
        0
      );
      expect(record.id).toBe('000p00000000000033');
    });
  });

  describe('deleteRecord: Absatz', () => {
    beforeEach(() => {
      respondWith('SELECT id FROM content_node WHERE', [{ id: 'cn-1' }]);
    });

    it('löst erst den Zeiger, dann die Items, dann den Halter', async () => {
      await createRepository().deleteRecord('paragraph', '000p00000000000033');

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
      respondWith('SELECT id FROM content_node WHERE node_id', [
        { id: 'cn-1' },
      ]);
    });

    it('räumt den ganzen Teilbaum ab, in RESTRICT-Reihenfolge', async () => {
      await createRepository().deleteRecord('story', '000s00000000000011');

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
      await createRepository().deleteRecord('story', '000s00000000000011');

      const deletes = statementsMatching('DELETE FROM node WHERE id');
      expect(deletes.map((entry) => entry.parameters[0])).toEqual([
        'n-kapitel',
        'n-story',
      ]);
    });

    it('nullt cover_node_id auch außerhalb des Teilbaums', async () => {
      await createRepository().deleteRecord('story', '000s00000000000011');

      const [cover] = statementsMatching('SET cover_node_id = NULL');
      expect(cover.sql).toContain('WHERE cover_node_id = ANY($1)');
      expect(cover.parameters[0]).toEqual(['n-kapitel', 'n-story']);
    });

    it('bricht ab, wenn der Knoten nicht existiert', async () => {
      responses = [];
      respondWith('SELECT id FROM node WHERE', []);

      await expect(
        createRepository().deleteRecord('story', '000s99999999999999')
      ).rejects.toThrow('Record not found');
    });
  });
});
