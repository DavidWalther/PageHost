const { ContentRepository } = require('../ContentRepository.js');

jest.mock('../../../modules/logging');

const ENVIRONMENT = { APPLICATION_APPLICATION_KEY: 'testApp' };

describe('ContentRepository', () => {
  it('verlangt ein Environment-Objekt', () => {
    expect(() => new ContentRepository()).toThrow(
      'Environment object is required'
    );
  });

  it('nimmt App-Schlüssel und PublishDate fluent entgegen', () => {
    const repository = new ContentRepository(ENVIRONMENT)
      .setApplicationKey('testApp')
      .setPublishDate(null);

    expect(repository.applicationKey).toBe('testApp');
    expect(repository.publishDate).toBeNull();
  });

  it('unterscheidet "nicht gesetzt" von "null"', () => {
    const repository = new ContentRepository(ENVIRONMENT);

    // Der Unterschied trägt das Verhalten: undefined heißt "Standardfilter der
    // Quelle", null heißt "gar kein Filter" (edit-Scope).
    expect(repository.publishDate).toBeUndefined();
    repository.setPublishDate(null);
    expect(repository.publishDate).toBeNull();
  });

  describe('Die Abfragemethoden sind abstrakt', () => {
    const methods = ['getContentsTree', 'getNode', 'getContent'];

    methods.forEach((method) => {
      it(`${method} wirft, solange es nicht implementiert ist`, async () => {
        const repository = new ContentRepository(ENVIRONMENT);

        await expect(repository[method]('someId')).rejects.toThrow(
          `ContentRepository.${method} is not implemented`
        );
      });
    });
  });
});
