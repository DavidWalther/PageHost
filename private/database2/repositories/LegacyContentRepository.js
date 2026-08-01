const { ContentRepository } = require('./ContentRepository.js');
const { DataStorage } = require('../DataStorage/DataStorage.js');
const { DataCleaner } = require('../../modules/DataCleaner.js');
const { Logging } = require('../../modules/logging.js');

/**
 * Inhaltsquelle auf dem ALTEN Datenmodell (`story` / `chapter` / `paragraph`).
 *
 * Kapselt die heutigen `DataStorage`-Aufrufe 1:1 — bewusst ohne jede
 * Verbesserung. Diese Klasse ist der Bezugspunkt, gegen den die neue Quelle
 * antritt; jede Abweichung hier würde diesen Vergleich entwerten. Sie fällt
 * weg, sobald die Umstellung abgeschlossen ist.
 */
class LegacyContentRepository extends ContentRepository {
  /**
   * Frische `DataStorage`-Instanz je Abfrage.
   *
   * Nicht optional: `ActionGet` führt jede Abfrage mit `closeConnection` aus
   * und beendet damit die Verbindung ihrer `DataStorage`. Eine zweite Abfrage
   * auf derselben Instanz liefe in `CONNECTION_ENDED` — genau der Fehler, den
   * `buildContentsTree.connection.tests.js` festhält.
   */
  createDataStorage() {
    const dataStorage = new DataStorage(this.environment);
    dataStorage.setConditionApplicationKey(this.applicationKey);
    // Nur setzen, wenn gesetzt: `undefined` bedeutet "Standardfilter der
    // Quelle", und den bestimmt `DataStorage` selbst je Ebene.
    if (this.publishDate !== undefined) {
      dataStorage.setConditionPublishDate(this.publishDate);
    }
    return dataStorage;
  }

  async getStory(storyId) {
    return this.createDataStorage().queryStory(storyId);
  }

  async getChapter(chapterId) {
    return this.createDataStorage().queryChapter(chapterId);
  }

  async getParagraph(paragraphId) {
    return this.createDataStorage().queryParagraphs(paragraphId);
  }

  /**
   * Baut den Baum aus flachen Abfragen je Ebene zusammen. Bewusst ungefiltert:
   * der Publish-Filter läuft erst bei der Auslieferung.
   */
  async getContentsTree() {
    const LOCATION = 'LegacyContentRepository.getContentsTree';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Building contents tree for application key: ${this.applicationKey}`,
    });

    const stories = await this.createDataStorage().queryAllStories();
    const chapters = await this.createDataStorage().queryAllChapters();

    const chaptersByStory = {};
    chapters.forEach((chapter) => {
      const storyId = chapter.storyid;
      if (!chaptersByStory[storyId]) {
        chaptersByStory[storyId] = [];
      }
      chaptersByStory[storyId].push(chapter);
    });

    stories.forEach((story) => {
      const storyChapters = chaptersByStory[story.id] || [];
      storyChapters.sort(
        (first, second) => first.sortnumber - second.sortnumber
      );
      story.chapters = storyChapters;
    });
    stories.sort((first, second) => first.sortnumber - second.sortnumber);

    new DataCleaner().removeApplicationKeys(stories);
    return stories;
  }
}

module.exports = { LegacyContentRepository };
