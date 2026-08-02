/**
 * Charakterisierungstests: GET /api/1.0/contents/*
 *
 * Siehe `SingleStoryEndpoint.characterization.tests.js` für Zweck und
 * Schnittebene des Harness.
 *
 * Besonderheit dieses Pfads: `DataFacade.buildContentsTree()` liefert den
 * **vollständigen** Baum (veröffentlicht und unveröffentlicht) und setzt ihn aus
 * zwei getrennten Queries zusammen. Der Publish-Filter läuft erst bei der
 * Auslieferung im `ContentVisibilityFilter`. Diese Trennung ist beabsichtigt
 * (dieselbe Baum-Quelle soll z. B. für sitemap.xml nutzbar sein) und wird hier
 * festgeschrieben.
 */

const harness = require('../../../../../testSupport/readPathHarness');

jest.mock('../../../../../database2/DataStorage/pgConnector.js', () => ({
  PostgresActions: require('../../../../../testSupport/readPathHarness')
    .PostgresActionsMock,
}));
jest.mock('../../../../../database2/DataCache/DataCache.js', () => ({
  DataCache2: require('../../../../../testSupport/readPathHarness')
    .DataCache2Mock,
}));
jest.mock('../../../../../modules/logging');

const ContentsEndpoint = require('../ContentsEndpoint');

const APPLICATION_KEY = 'charApp';
const GESTERN = '2020-01-01T00:00:00.000Z';
const MORGEN = '2999-01-01T00:00:00.000Z';

function runEndpoint({ depth, scopes } = {}) {
  const responseObject = { json: jest.fn() };
  const endpoint = new ContentsEndpoint()
    .setEnvironment(harness.legacyEnvironment(APPLICATION_KEY))
    .setRequestObject({ query: depth === undefined ? {} : { depth } })
    .setResponseObject(responseObject);
  if (scopes) {
    endpoint.setScopes(scopes);
  }
  return endpoint.execute().then(() => responseObject.json.mock.calls[0][0]);
}

/** Der Baum entsteht aus zwei Queries: erst alle Stories, dann alle Kapitel. */
function queueTree({ stories, chapters }) {
  harness.queueResults(stories, chapters);
}

const STORY = {
  id: '000s00000000000011',
  name: 'Story A',
  sortnumber: 1,
  publishdate: GESTERN,
  applicationincluded: APPLICATION_KEY,
};
const KAPITEL = {
  id: '000c00000000000022',
  storyid: '000s00000000000011',
  name: 'Kapitel A',
  sortnumber: 1,
  publishdate: GESTERN,
  applicationincluded: APPLICATION_KEY,
};

describe('Charakterisierung: GET /api/1.0/contents', () => {
  beforeEach(() => {
    harness.resetHarness();
  });

  describe('Knotenform', () => {
    it('liefert { result: Node[] } mit id, name, label und childnodes', async () => {
      queueTree({ stories: [STORY], chapters: [KAPITEL] });

      const response = await runEndpoint();

      expect(response).toEqual({
        result: [
          {
            id: '000s00000000000011',
            name: 'Story A',
            label: 'Story A',
            childnodes: [
              {
                id: '000c00000000000022',
                name: 'Kapitel A',
                label: 'Kapitel A',
                childnodes: [],
              },
            ],
          },
        ],
      });
    });

    it('label ist eine Kopie von name', async () => {
      queueTree({ stories: [STORY], chapters: [] });

      const response = await runEndpoint();

      expect(response.result[0].label).toBe(response.result[0].name);
    });

    it('lässt publishdate und die App-Spalten nie in die Antwort', async () => {
      queueTree({ stories: [STORY], chapters: [KAPITEL] });

      const response = await runEndpoint();
      const knoten = response.result[0];

      expect(Object.keys(knoten).sort()).toEqual([
        'childnodes',
        'id',
        'label',
        'name',
      ]);
      expect(knoten).not.toHaveProperty('publishdate');
      expect(knoten).not.toHaveProperty('sortnumber');
      expect(knoten.childnodes[0]).not.toHaveProperty('publishdate');
    });
  });

  describe('Zuordnung und Sortierung', () => {
    it('hängt Kapitel über storyid an ihre Story und sortiert beide Ebenen nach sortnumber', async () => {
      queueTree({
        stories: [
          { ...STORY, id: 'sB', name: 'Story B', sortnumber: 2 },
          { ...STORY, id: 'sA', name: 'Story A', sortnumber: 1 },
        ],
        chapters: [
          { ...KAPITEL, id: 'c2', storyid: 'sA', name: 'A2', sortnumber: 2 },
          { ...KAPITEL, id: 'c1', storyid: 'sA', name: 'A1', sortnumber: 1 },
          { ...KAPITEL, id: 'c3', storyid: 'sB', name: 'B1', sortnumber: 1 },
        ],
      });

      const response = await runEndpoint();

      expect(response.result.map((node) => node.id)).toEqual(['sA', 'sB']);
      expect(response.result[0].childnodes.map((node) => node.id)).toEqual([
        'c1',
        'c2',
      ]);
      expect(response.result[1].childnodes.map((node) => node.id)).toEqual([
        'c3',
      ]);
    });

    it('liefert Stories ohne Kapitel mit leerem childnodes', async () => {
      queueTree({ stories: [STORY], chapters: [] });

      const response = await runEndpoint();

      expect(response.result[0].childnodes).toEqual([]);
    });
  });

  describe('Publish-Filter bei der Auslieferung', () => {
    it('entfernt ohne edit-Scope unveröffentlichte Knoten', async () => {
      queueTree({
        stories: [STORY, { ...STORY, id: 'sZukunft', publishdate: MORGEN }],
        chapters: [
          KAPITEL,
          { ...KAPITEL, id: 'cZukunft', publishdate: MORGEN },
        ],
      });

      const response = await runEndpoint();

      expect(response.result.map((node) => node.id)).toEqual([
        '000s00000000000011',
      ]);
      expect(response.result[0].childnodes.map((node) => node.id)).toEqual([
        '000c00000000000022',
      ]);
    });

    it('liefert mit edit-Scope auch unveröffentlichte Knoten', async () => {
      queueTree({
        stories: [STORY, { ...STORY, id: 'sZukunft', publishdate: MORGEN }],
        chapters: [KAPITEL],
      });

      const response = await runEndpoint({ scopes: new Set(['edit']) });

      expect(response.result.map((node) => node.id)).toEqual([
        '000s00000000000011',
        'sZukunft',
      ]);
    });

    it('holt den Baum ungefiltert aus der Datenschicht — das SQL kennt keinen Publish-Filter', async () => {
      queueTree({ stories: [], chapters: [] });

      await runEndpoint();

      // Beide Queries liefern den vollen Baum; gefiltert wird erst im
      // ContentVisibilityFilter. Damit bleibt dieselbe Quelle für andere
      // Verwendungen (z. B. sitemap.xml) nutzbar.
      harness.statements().forEach((sql) => {
        expect(sql).not.toContain('PublishDate <=');
      });
      expect(harness.statements()).toHaveLength(2);
    });
  });

  describe('depth-Parameter', () => {
    it('schneidet bei depth=1 die Kapitel ab', async () => {
      queueTree({ stories: [STORY], chapters: [KAPITEL] });

      const response = await runEndpoint({ depth: '1' });

      expect(response.result[0].childnodes).toEqual([]);
    });

    it('liefert ohne depth die volle Tiefe', async () => {
      queueTree({ stories: [STORY], chapters: [KAPITEL] });

      const response = await runEndpoint();

      expect(response.result[0].childnodes).toHaveLength(1);
    });

    it.each([['0'], ['-3'], ['abc'], ['']])(
      'fällt bei ungültigem depth=%p auf die volle Tiefe zurück',
      async (depth) => {
        queueTree({ stories: [STORY], chapters: [KAPITEL] });

        const response = await runEndpoint({ depth });

        expect(response.result[0].childnodes).toHaveLength(1);
      }
    );

    it('deckelt depth auf die verfügbaren Ebenen', async () => {
      queueTree({ stories: [STORY], chapters: [KAPITEL] });

      const response = await runEndpoint({ depth: '99' });

      expect(response.result[0].childnodes[0].childnodes).toEqual([]);
    });
  });
});
