/**
 * Lesepfad der typfreien Antwortform durch die `DataFacade`.
 *
 * Geprüft wird die Arbeitsteilung: welche Repository-Methode angefragt wird,
 * unter welchem Schlüssel das Ergebnis in den Cache geht und wann der Cache
 * übersprungen wird. Was die Quelle liefert, steht in
 * `repositories/__tests__/NodeContentRepository.tests.js`.
 */

const { DataFacade, DataFacadeSync } = require('../DataFacade.js');
const { DataCache2 } = require('../DataCache/DataCache.js');
const {
  NodeContentRepository,
} = require('../repositories/NodeContentRepository.js');

jest.mock('../../modules/logging');
jest.mock('../DataCache/DataCache.js');
jest.mock('../repositories/NodeContentRepository.js');

const ENVIRONMENT = { APPLICATION_APPLICATION_KEY: 'test-key' };

const NODE = { id: '000n1', name: 'Ein Knoten', nodes: [], contents: [] };
const CONTENT = { id: '00cn1', name: 'Ein Absatz', items: [] };

let cacheGet;
let cacheSet;
let repository;

beforeEach(() => {
  cacheGet = jest.fn().mockResolvedValue(null);
  cacheSet = jest.fn();
  DataCache2.mockReset();
  DataCache2.mockImplementation(() => ({ get: cacheGet, set: cacheSet }));

  repository = {
    setApplicationKey: jest.fn(() => repository),
    setPublishDate: jest.fn(() => repository),
    getNode: jest.fn().mockResolvedValue(NODE),
    getContent: jest.fn().mockResolvedValue(CONTENT),
  };
  NodeContentRepository.mockReset();
  NodeContentRepository.mockImplementation(() => repository);
});

function facade() {
  return new DataFacadeSync(ENVIRONMENT);
}

describe('getData für table "node"', () => {
  it('fragt getNode an, nicht getStory oder getChapter', async () => {
    await facade().getData({ request: { table: 'node', id: '000n1' } });

    expect(repository.getNode).toHaveBeenCalledWith('000n1');
  });

  it('legt das Ergebnis im Knoten-Schlüsselraum ab', async () => {
    await facade().getData({ request: { table: 'node', id: '000n1' } });

    expect(cacheGet).toHaveBeenCalledWith('node:000n1');
    expect(cacheSet).toHaveBeenCalledWith('node:000n1', NODE);
  });

  it('liefert den Cache-Treffer, ohne die Quelle zu fragen', async () => {
    cacheGet.mockResolvedValue(NODE);

    const result = await facade().getData({
      request: { table: 'node', id: '000n1' },
    });

    expect(result).toBe(NODE);
    expect(repository.getNode).not.toHaveBeenCalled();
  });
});

describe('getData für table "content"', () => {
  it('fragt getContent an', async () => {
    await facade().getData({ request: { table: 'content', id: '00cn1' } });

    expect(repository.getContent).toHaveBeenCalledWith('00cn1');
    expect(repository.getNode).not.toHaveBeenCalled();
  });

  it('legt das Ergebnis in einem eigenen Schlüsselraum ab', async () => {
    // Getrennt vom Knoten-Raum: dieselbe alte Id kann über beide Wege
    // hereinkommen und muss zwei verschiedene Antworten behalten.
    await facade().getData({ request: { table: 'content', id: '00cn1' } });

    expect(cacheSet).toHaveBeenCalledWith('content:00cn1', CONTENT);
  });
});

describe('Cache übergehen', () => {
  it('fragt die Quelle direkt, wenn skipCache gesetzt ist', async () => {
    await facade()
      .setSkipCache(true)
      .getData({ request: { table: 'node', id: '000n1' } });

    expect(cacheGet).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
    expect(repository.getNode).toHaveBeenCalledWith('000n1');
  });

  it('reicht ein gesetztes publishDate an die Quelle durch', async () => {
    // `null` heißt "gar kein Filter" (edit-Scope) und ist deshalb nicht
    // dasselbe wie "nicht gesetzt".
    await facade()
      .setSkipCache(true)
      .getData({
        request: { table: 'node', id: '000n1', publishDate: null },
      });

    expect(repository.setPublishDate).toHaveBeenCalledWith(null);
  });

  it('lässt publishDate unangetastet, wenn es nicht gesetzt ist', async () => {
    await facade()
      .setSkipCache(true)
      .getData({ request: { table: 'content', id: '00cn1' } });

    expect(repository.setPublishDate).not.toHaveBeenCalled();
  });
});

describe('Weg über die Promise-Fassade', () => {
  it('reicht skipCache und Tabelle durch', async () => {
    const result = await new DataFacade(ENVIRONMENT)
      .setSkipCache(true)
      .getData({
        request: { table: 'node', id: '000n1' },
        returnPromise: true,
      });

    expect(result).toBe(NODE);
    expect(cacheGet).not.toHaveBeenCalled();
  });
});
