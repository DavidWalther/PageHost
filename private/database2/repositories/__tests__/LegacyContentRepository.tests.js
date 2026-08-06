const { DataStorage } = require('../../DataStorage/DataStorage.js');
const { LegacyContentRepository } = require('../LegacyContentRepository.js');

// Unit-Test: `DataStorage` ist vollständig gemockt. Geprüft wird nur, dass das
// Repository die heutigen Aufrufe 1:1 weiterreicht — die Abfragen selbst sind
// durch die Charakterisierungstests des Lesepfads abgedeckt.
jest.mock('../../DataStorage/DataStorage.js');
jest.mock('../../../modules/logging');

const ENVIRONMENT = { APPLICATION_APPLICATION_KEY: 'testApp' };

let instances;

function newRepository() {
  return new LegacyContentRepository(ENVIRONMENT).setApplicationKey('testApp');
}

beforeEach(() => {
  instances = [];
  DataStorage.mockReset();
  DataStorage.mockImplementation(() => {
    const instance = {
      setConditionApplicationKey: jest.fn(),
      setConditionPublishDate: jest.fn(),
      queryStory: jest.fn().mockResolvedValue({ id: '000s1' }),
      queryChapter: jest.fn().mockResolvedValue({ id: '000c1' }),
      queryParagraphs: jest.fn().mockResolvedValue({ id: '000p1' }),
      queryAllStories: jest.fn().mockResolvedValue([]),
      queryAllChapters: jest.fn().mockResolvedValue([]),
      createRecord: jest.fn().mockResolvedValue({ id: '000c1' }),
      updateData: jest.fn().mockResolvedValue({ id: '000c1' }),
      deleteData: jest.fn().mockResolvedValue(undefined),
    };
    instances.push(instance);
    return instance;
  });
});

describe('LegacyContentRepository', () => {
  describe('Weiterreichen an DataStorage', () => {
    it('holt die Story über queryStory und gibt sie unverändert zurück', async () => {
      const story = await newRepository().getStory('000s00000000000011');

      expect(instances[0].queryStory).toHaveBeenCalledWith(
        '000s00000000000011'
      );
      expect(story).toEqual({ id: '000s1' });
    });

    it('holt das Kapitel über queryChapter', async () => {
      await newRepository().getChapter('000c00000000000022');

      expect(instances[0].queryChapter).toHaveBeenCalledWith(
        '000c00000000000022'
      );
    });

    it('holt den Absatz über queryParagraphs — trotz Plural liefert es einen Datensatz', async () => {
      const paragraph =
        await newRepository().getParagraph('000p00000000000033');

      expect(instances[0].queryParagraphs).toHaveBeenCalledWith(
        '000p00000000000033'
      );
      expect(paragraph).toEqual({ id: '000p1' });
    });

    it('setzt den App-Schlüssel auf jeder Instanz', async () => {
      await newRepository().getStory('000s00000000000011');

      expect(instances[0].setConditionApplicationKey).toHaveBeenCalledWith(
        'testApp'
      );
    });
  });

  describe('Publish-Filter: drei Zustände', () => {
    it('lässt setConditionPublishDate ungerufen, wenn nichts gesetzt ist', async () => {
      // undefined heißt "Standardfilter der Quelle". Den bestimmt DataStorage
      // je Ebene selbst — ein Aufruf mit undefined wäre etwas anderes.
      await newRepository().getStory('000s00000000000011');

      expect(instances[0].setConditionPublishDate).not.toHaveBeenCalled();
    });

    it('reicht null durch (edit-Scope: gar kein Filter)', async () => {
      await newRepository().setPublishDate(null).getStory('000s1');

      expect(instances[0].setConditionPublishDate).toHaveBeenCalledWith(null);
    });

    it('reicht ein Datum durch', async () => {
      await newRepository().setPublishDate('2026-01-01').getChapter('000c1');

      expect(instances[0].setConditionPublishDate).toHaveBeenCalledWith(
        '2026-01-01'
      );
    });
  });

  describe('getContentsTree', () => {
    beforeEach(() => {
      DataStorage.mockImplementation(() => {
        const instance = {
          setConditionApplicationKey: jest.fn(),
          setConditionPublishDate: jest.fn(),
          queryAllStories: jest.fn().mockResolvedValue([
            { id: 's2', name: 'Zweite', sortnumber: 2 },
            {
              id: 's1',
              name: 'Erste',
              sortnumber: 1,
              applicationincluded: 'testApp',
            },
          ]),
          queryAllChapters: jest.fn().mockResolvedValue([
            { id: 'c2', storyid: 's1', name: 'B', sortnumber: 2 },
            { id: 'c1', storyid: 's1', name: 'A', sortnumber: 1 },
            { id: 'c3', storyid: 'unbekannt', name: 'Waise', sortnumber: 1 },
          ]),
        };
        instances.push(instance);
        return instance;
      });
    });

    it('hängt die Kapitel unter ihre Story und sortiert beide Ebenen', async () => {
      const tree = await newRepository().getContentsTree();

      expect(tree.map((story) => story.id)).toEqual(['s1', 's2']);
      expect(tree[0].chapters.map((chapter) => chapter.id)).toEqual([
        'c1',
        'c2',
      ]);
      expect(tree[1].chapters).toEqual([]);
    });

    it('lässt Kapitel ohne passende Story fallen', async () => {
      const tree = await newRepository().getContentsTree();

      const allChapterIds = tree.flatMap((story) =>
        story.chapters.map((chapter) => chapter.id)
      );
      expect(allChapterIds).not.toContain('c3');
    });

    it('entfernt die App-Spalten aus dem Baum', async () => {
      const tree = await newRepository().getContentsTree();

      expect(tree[0]).not.toHaveProperty('applicationincluded');
    });

    it('benutzt je Abfrage eine eigene DataStorage-Instanz', async () => {
      // ActionGet schließt die Verbindung nach jeder Abfrage. Eine zweite
      // Abfrage auf derselben Instanz liefe in CONNECTION_ENDED.
      await newRepository().getContentsTree();

      expect(instances).toHaveLength(2);
    });
  });

  describe('Schreibpfad', () => {
    it('hängt beim Anlegen die eigene App an den Datensatz', async () => {
      // Im alten Modell ist die App-Zugehörigkeit eine Spalte. Bis zur
      // Umstellung setzte der `UpsertEndpoint` sie — eine Aussage über die
      // Speicherung, die dort nicht hingehört.
      await newRepository().createRecord('chapter', { name: 'Kapitel' });

      const [, payload] = instances[0].createRecord.mock.calls[0];
      expect(payload).toEqual({
        name: 'Kapitel',
        applicationIncluded: 'testApp',
      });
    });

    it('reicht die Tabellen-Definition zum Objektnamen durch', async () => {
      await newRepository().createRecord('story', { name: 'Story' });

      const [table] = instances[0].createRecord.mock.calls[0];
      expect(table.getTableName()()).toBe('Story');
    });

    it('reicht Änderungen unverändert an updateData weiter', async () => {
      await newRepository().updateRecord('chapter', {
        id: '000c1',
        name: 'Neu',
      });

      expect(instances[0].updateData).toHaveBeenCalledWith('chapter', {
        id: '000c1',
        name: 'Neu',
      });
    });

    it('löscht einstufig — wie bisher', async () => {
      await newRepository().deleteRecord('chapter', '000c1');

      expect(instances[0].deleteData).toHaveBeenCalledWith('chapter', '000c1');
    });

    it('wirft bei einem unbekannten Objekt', async () => {
      await expect(
        newRepository().createRecord('node', { name: 'x' })
      ).rejects.toThrow('Invalid table name');
    });
  });

  describe('Typfreie Antwortform', () => {
    // Die Verweigerung ist Absicht und muss sichtbar sein: eine stille
    // Leerantwort würde als "Datensatz existiert nicht" gelesen werden.
    ['getNode', 'getContent'].forEach((method) => {
      it(`${method} wirft mit einer Begründung statt leer zu antworten`, async () => {
        await expect(newRepository()[method]('000s1')).rejects.toThrow(
          `LegacyContentRepository.${method} is not available`
        );
      });
    });
  });
});
