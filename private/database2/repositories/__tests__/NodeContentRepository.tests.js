const { PostgresActions } = require('../../DataStorage/pgConnector.js');
const {
  NodeContentRepository,
  VISIBLE_NODES_SQL,
} = require('../NodeContentRepository.js');

// Unit-Test mit gemocktem Connector. Was er prüfen kann, ist die Form des
// Aufrufs — nicht, ob die Auflösungsregel stimmt: die lebt in SQL und wurde
// gegen eine echte Postgres-Instanz mit den Testdaten aus
// `doc/datamodel-overhaul/testModel_createAndTearDown.txt` verifiziert. Die
// Erwartungswerte daraus stehen unten als Dokumentation.
jest.mock('../../DataStorage/pgConnector.js');
jest.mock('../../../modules/logging');

const ENVIRONMENT = { APPLICATION_APPLICATION_KEY: 'testApp' };

let executeParameterizedSql;

beforeEach(() => {
  executeParameterizedSql = jest.fn().mockResolvedValue([]);
  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql,
    executeSql: jest.fn(),
  }));
});

function newRepository() {
  return new NodeContentRepository(ENVIRONMENT).setApplicationKey('testApp');
}

describe('NodeContentRepository.queryVisibleNodes', () => {
  it('verlangt einen App-Schlüssel', async () => {
    await expect(
      new NodeContentRepository(ENVIRONMENT).queryVisibleNodes()
    ).rejects.toThrow('Application key is required');
  });

  it('bindet den App-Schlüssel als Parameter, statt ihn einzusetzen', async () => {
    await newRepository().queryVisibleNodes();

    const [statement, parameters] = executeParameterizedSql.mock.calls[0];
    expect(parameters).toEqual(['testApp']);
    expect(statement).toContain('$1');
    expect(statement).not.toContain('testApp');
  });

  it('schließt die Verbindung nach der Abfrage', async () => {
    await newRepository().queryVisibleNodes();

    expect(executeParameterizedSql.mock.calls[0][2]).toEqual({
      closeConnection: true,
    });
  });

  it('reicht die Zeilen unverändert durch', async () => {
    const rows = [{ id: '000n1', name: 'Wurzel', depth: 1 }];
    executeParameterizedSql.mockResolvedValue(rows);

    expect(await newRepository().queryVisibleNodes()).toBe(rows);
  });
});

describe('VISIBLE_NODES_SQL', () => {
  it('läuft rekursiv über parent_node_id', () => {
    expect(VISIBLE_NODES_SQL).toContain('WITH RECURSIVE');
    expect(VISIBLE_NODES_SQL).toContain('c.parent_node_id = t.id');
  });

  it('führt den Zyklus-Schutz mit — inklusive des nötigen Casts', () => {
    // Ohne den Cast hat der nicht-rekursive Term varchar(18)[], der rekursive
    // varchar[]; Postgres lehnt die Abfrage dann rundheraus ab.
    expect(VISIBLE_NODES_SQL).toContain('ARRAY[f.id]::varchar[]');
    expect(VISIBLE_NODES_SQL).toContain('NOT c.id = ANY(t.path)');
  });

  it('behandelt Wildcard-Zeilen (app_id IS NULL) als für jede App gültig', () => {
    expect(VISIBLE_NODES_SQL).toContain(
      'an.app_id IS NULL OR an.app_id = (SELECT id FROM target_app)'
    );
  });

  it('setzt exclude über include und Vererbung', () => {
    expect(VISIBLE_NODES_SQL).toContain(
      '((c.included OR (c.inherits AND t.member)) AND NOT c.excluded)'
    );
  });

  it('filtert NICHT nach published_date', () => {
    // Der Publish-Filter läuft erst bei der Auslieferung
    // (ContentVisibilityFilter) — sonst wäre derselbe Baum nicht mehr für
    // sitemap.xml verwendbar. Genauso hält es das Altmodell.
    expect(VISIBLE_NODES_SQL).not.toContain('published_date <');
    expect(VISIBLE_NODES_SQL).not.toContain('published_date IS NOT NULL');
  });

  it('behandelt fehlendes is_parent_controls_visibility als false', () => {
    expect(VISIBLE_NODES_SQL).toContain(
      'COALESCE(n.is_parent_controls_visibility, false)'
    );
  });
});

/**
 * Gegen Postgres verifiziert (2026-08-01), Testdaten aus
 * `doc/datamodel-overhaul/testModel_createAndTearDown.txt`. Deckt jede Zeile der
 * Wahrheitstabelle aus `datamodel.md` Abschnitt 4 ab:
 *
 *   testAppA      -> root, cover, branch, leaf, appAOnly, hiddenInB   (6)
 *   testAppB      -> root, cover, branch, leaf                        (4)
 *   unbekannt     -> root, cover, branch, leaf, hiddenInB             (5)
 *
 * Die Ableitungen im Einzelnen:
 * - `root` haengt per include-Wildcard drin  -> in jeder App, auch unbekannter
 * - `cover` erbt und ist unveroeffentlicht   -> hier trotzdem sichtbar; das
 *   Publish-Tor der Wahrheitstabelle wirkt erst bei der Auslieferung
 * - `leaf` liegt auf Ebene 3                 -> Vererbung reicht beliebig tief
 * - `appAOnly` bricht die Kette (false) und haengt per include an A
 *                                            -> nur in A, nicht in B, nicht bei
 *                                               unbekanntem Schluessel
 * - `hiddenInB` erbt, hat aber exclude fuer B -> ueberall ausser in B
 *
 * Ebenfalls gemessen: ein Zyklus (branch <-> leaf) bringt die Abfrage NICHT zum
 * Haengen — beide Knoten samt Teilbaum fehlen still im Ergebnis.
 */
