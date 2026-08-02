/**
 * Die eine Stelle, an der die Lesequelle gewählt wird.
 *
 * Zugesichert wird hier nur die Auswahl — was die Quellen liefern, steht im
 * gemeinsamen Vertrag (`contentRepositoryContract.tests.js`).
 */

const { DataFacadeSync } = require('../DataFacade.js');
const {
  NodeContentRepository,
} = require('../repositories/NodeContentRepository.js');
const {
  LegacyContentRepository,
} = require('../repositories/LegacyContentRepository.js');

jest.mock('../../modules/logging');

const APPLICATION_KEY = 'test-key';

function createFacade(environment = {}) {
  return new DataFacadeSync({
    APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
    ...environment,
  });
}

describe('DataFacadeSync.createContentRepository', () => {
  it('liest ohne gesetzte CONTENT_SOURCE aus dem neuen Modell', () => {
    expect(createFacade().createContentRepository()).toBeInstanceOf(
      NodeContentRepository
    );
  });

  it('liest mit CONTENT_SOURCE="legacy" aus dem alten Modell', () => {
    const repository = createFacade({
      CONTENT_SOURCE: 'legacy',
    }).createContentRepository();

    expect(repository).toBeInstanceOf(LegacyContentRepository);
  });

  it('fällt bei jedem anderen Wert auf das neue Modell zurück', () => {
    // Ein Tippfehler in der Konfiguration darf nicht unbemerkt in der alten
    // Quelle landen — nur der exakte Wert schaltet zurück.
    ['Legacy', 'node', 'story', ''].forEach((value) => {
      expect(
        createFacade({ CONTENT_SOURCE: value }).createContentRepository()
      ).toBeInstanceOf(NodeContentRepository);
    });
  });

  it('reicht den App-Schlüssel an die gewählte Quelle durch', () => {
    ['legacy', undefined].forEach((source) => {
      const repository = createFacade({
        CONTENT_SOURCE: source,
      }).createContentRepository();

      expect(repository.applicationKey).toBe(APPLICATION_KEY);
    });
  });
});
