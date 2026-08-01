const { NodeVisibility } = require('../NodeVisibility.js');

/**
 * Die Testdaten entsprechen dem Aufbau aus
 * `doc/datamodel-overhaul/testModel_createAndTearDown.txt` und decken jede Zeile
 * der Wahrheitstabelle aus `datamodel.md` Abschnitt 4 ab:
 *
 *   root ................ include-Wildcard          -> in JEDER App
 *   +- cover ............ erbt                      -> folgt root
 *   +- branch ........... erbt                      -> folgt root
 *   |  +- leaf .......... erbt (dritte Ebene)       -> folgt branch
 *   +- appAOnly ......... bricht die Kette + include A -> nur in A
 *   +- hiddenInB ........ erbt + exclude B          -> ueberall ausser B
 */
function node(id, parentNodeId, inherits) {
  return {
    id,
    parent_node_id: parentNodeId,
    is_parent_controls_visibility: inherits,
    legacy_id: null,
  };
}

const NODES = [
  node('root', null, null),
  node('cover', 'root', true),
  node('branch', 'root', true),
  node('leaf', 'branch', true),
  node('appAOnly', 'root', false),
  node('hiddenInB', 'root', true),
];

const APP_NODES = [
  { node_id: 'root', relation: 'include', app_name: null },
  { node_id: 'appAOnly', relation: 'include', app_name: 'appA' },
  { node_id: 'hiddenInB', relation: 'exclude', app_name: 'appB' },
];

function visibility(overrides = {}) {
  return new NodeVisibility({
    nodes: overrides.nodes || NODES,
    appNodes: overrides.appNodes || APP_NODES,
  });
}

function visible(applicationKey, overrides) {
  return [...visibility(overrides).visibleNodeIds(applicationKey)].sort();
}

describe('NodeVisibility — Wahrheitstabelle', () => {
  it('App A sieht den Wildcard-Ast, den geerbten Teilbaum und ihren eigenen Knoten', () => {
    expect(visible('appA')).toEqual([
      'appAOnly',
      'branch',
      'cover',
      'hiddenInB',
      'leaf',
      'root',
    ]);
  });

  it('App B sieht weder den fremden noch den für sie ausgeschlossenen Knoten', () => {
    expect(visible('appB')).toEqual(['branch', 'cover', 'leaf', 'root']);
  });

  it('ein unbekannter Schlüssel sieht genau die Wildcard-Äste', () => {
    // Kein Sonderfall nötig: '*' wirkte im Altmodell ebenfalls unabhängig
    // davon, ob der Schlüssel existiert.
    expect(visible('gibtsNicht')).toEqual([
      'branch',
      'cover',
      'hiddenInB',
      'leaf',
      'root',
    ]);
  });

  it('vererbt beliebig tief, nicht nur eine Ebene', () => {
    expect(visible('appB')).toContain('leaf');
  });

  it('exclude schlägt geerbte Zugehörigkeit', () => {
    expect(visible('appB')).not.toContain('hiddenInB');
    expect(visible('appA')).toContain('hiddenInB');
  });

  it('exclude schlägt auch ein eigenes include', () => {
    const appNodes = [
      ...APP_NODES,
      { node_id: 'appAOnly', relation: 'exclude', app_name: 'appA' },
    ];

    expect(visible('appA', { appNodes })).not.toContain('appAOnly');
  });

  it('eine exclude-Wildcard nimmt den Knoten überall heraus', () => {
    const appNodes = [
      ...APP_NODES,
      { node_id: 'branch', relation: 'exclude', app_name: null },
    ];

    expect(visible('appA', { appNodes })).not.toContain('branch');
    expect(visible('appB', { appNodes })).not.toContain('branch');
  });

  it('nimmt den erbenden Teilbaum eines ausgeschlossenen Knotens mit heraus', () => {
    const appNodes = [
      ...APP_NODES,
      { node_id: 'branch', relation: 'exclude', app_name: 'appA' },
    ];

    // leaf erbt von branch, und branch ist für A draußen
    expect(visible('appA', { appNodes })).not.toContain('leaf');
    expect(visible('appB', { appNodes })).toContain('leaf');
  });

  it('lässt ein Kind mit eigenem include sichtbar, obwohl der Parent es nicht ist', () => {
    // Das ist der Fall appAOnly für App B — der Parent root ist zwar sichtbar,
    // aber hier zählt: die Kette ist gebrochen und das Kind hängt selbst dran.
    const nodes = [...NODES, node('unterHiddenInB', 'hiddenInB', false)];
    const appNodes = [
      ...APP_NODES,
      { node_id: 'unterHiddenInB', relation: 'include', app_name: 'appB' },
    ];

    expect(visible('appB', { nodes, appNodes })).toContain('unterHiddenInB');
    expect(visible('appB', { nodes, appNodes })).not.toContain('hiddenInB');
  });

  it('behandelt eine gebrochene Kette ohne eigenes include als unsichtbar', () => {
    expect(visible('appB')).not.toContain('appAOnly');
  });

  it('behandelt fehlendes is_parent_controls_visibility als false', () => {
    // null/undefined heißt: erbt NICHT. Ein Knoten ohne eigene Zugehörigkeit
    // fällt damit heraus, auch wenn sein Parent sichtbar ist.
    const nodes = [...NODES, node('ohneFlag', 'root', null)];

    expect(visible('appA', { nodes })).not.toContain('ohneFlag');
  });

  it('macht eine Wurzel ohne eigene Zugehörigkeit unsichtbar', () => {
    const nodes = [...NODES, node('zweiteWurzel', null, true)];

    // Eine Wurzel hat nichts zu erben; ohne include ist sie draußen.
    expect(visible('appA', { nodes })).not.toContain('zweiteWurzel');
  });
});

describe('NodeVisibility — kaputte Bäume', () => {
  it('erreicht einen Knoten nicht, dessen Parent es nicht gibt', () => {
    const nodes = [...NODES, node('waise', 'gibtsNicht', true)];
    const appNodes = [
      ...APP_NODES,
      { node_id: 'waise', relation: 'include', app_name: 'appA' },
    ];

    // Auch mit eigenem include: die Auflösung läuft von den Wurzeln nach unten,
    // und dorthin führt kein Weg. Im Altmodell fiel eine Waise beim Zusammenbau
    // des Baums genauso heraus.
    expect(visible('appA', { nodes, appNodes })).not.toContain('waise');
  });

  it('bleibt bei einem Zyklus stehen, statt endlos zu laufen', () => {
    const nodes = [
      ...NODES,
      node('a', 'b', true),
      node('b', 'a', true), // a <-> b
    ];

    const result = visible('appA', { nodes });

    expect(result).not.toContain('a');
    expect(result).not.toContain('b');
    expect(result).toContain('root');
  });

  it('verliert den Teilbaum, wenn ein Knoten in einen Zyklus gerät', () => {
    // branch zeigt jetzt auf sein eigenes Kind -> beide sind von keiner Wurzel
    // mehr erreichbar. Das ist der stille Schaden, den ein Zyklus anrichtet.
    const nodes = NODES.map((entry) =>
      entry.id === 'branch' ? node('branch', 'leaf', true) : entry
    );

    const result = visible('appA', { nodes });

    expect(result).not.toContain('branch');
    expect(result).not.toContain('leaf');
    expect(result).toContain('root');
  });
});

describe('NodeVisibility — Zugriffshilfen', () => {
  it('findet einen Knoten über die neue Id', () => {
    expect(visibility().findByAnyId('branch').id).toBe('branch');
  });

  it('findet einen Knoten über die alte Id', () => {
    const nodes = [
      { ...node('mitLegacy', 'root', true), legacy_id: '000c00000000000045' },
    ];

    expect(visibility({ nodes }).findByAnyId('000c00000000000045').id).toBe(
      'mitLegacy'
    );
  });

  it('liefert undefined für eine unbekannte Id', () => {
    expect(visibility().findByAnyId('000c99999999999999')).toBeUndefined();
    expect(visibility().findByAnyId(undefined)).toBeUndefined();
  });

  it('liefert die Kind-Knoten eines Knotens', () => {
    expect(
      visibility()
        .childrenOf('root')
        .map((child) => child.id)
    ).toEqual(['cover', 'branch', 'appAOnly', 'hiddenInB']);
  });

  it('beantwortet die Sichtbarkeit einzelner Knoten', () => {
    expect(visibility().isVisible('appAOnly', 'appA')).toBe(true);
    expect(visibility().isVisible('appAOnly', 'appB')).toBe(false);
  });

  it('kommt ohne Knoten und ohne Relationen aus', () => {
    expect([...new NodeVisibility().visibleNodeIds('appA')]).toEqual([]);
  });
});
