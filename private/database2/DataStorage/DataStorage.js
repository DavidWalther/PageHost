const { ActionGet} = require('./actions/get.js');
const { TableConfiguration } = require('../tables/configuration.js');
const { TableParagraph } = require('../tables/paragraph.js');
const { TableStory } = require('../tables/story.js');
const { TableChapter } = require('../tables/chapter.js');
const { TableIdentity } = require('../tables/identity.js');
const { PostgresActions } = require('./pgConnector.js');
const { Logging } = require('../../modules/logging.js');
const { DataCleaner } = require('../../modules/DataCleaner.js');
const { ActionCreate } = require('./actions/create.js');
const ActionUpdate  = require('./actions/update.js'); // Import ActionUpdate
const { ActionDelete } = require('./actions/delete.js');

class DataStorage {
  constructor(environment) {
    if (!environment) {
      throw new Error('Environment object is required');
    }
    this.pgConnector = new PostgresActions(environment);
  }

  setConditionApplicationKey(applicationKey) {
    if(!applicationKey) { return this; }
    this.applicationKey = applicationKey;
    return this;
  }

  setConditionPublishDate(publishDate) {
    if(publishDate === undefined) { return this; }
    this.publishDate = publishDate;
    return this;
  }

  queryParagraphs(paragraphId) {
    const LOCATION = 'DataStorage.queryParagraphs';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    return new Promise((resolve) => {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying paragraphs for application key: ${this.applicationKey}` });
      let tableParagraph = new TableParagraph();
      let actionGet = new ActionGet()
      .setPgConnector(this.pgConnector)
      .setTableName(tableParagraph.tableName)
      .setTableFields(tableParagraph.tableFields)
      .setConditionId(paragraphId)
      .setConditionApplicationKey(this.applicationKey);
      if(this.publishDate) {
        actionGet.setConditionPublishDate(this.publishDate);
      };
      actionGet.execute().then((result) => {
        if(result.length === 0) {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No paragraphs found for application key: ${this.applicationKey}` });
          resolve({});
        } else {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Paragraphs found for application key: ${this.applicationKey}` });
          let paragraphRecord = result[0];
          let dataCleaner = new DataCleaner();
          dataCleaner.removeApplicationKeys(paragraphRecord);
          resolve(paragraphRecord);
        }
      });
    });
  }

  queryConfiguration() {
    const LOCATION = 'DataStorage.queryConfiguration';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    return new Promise((resolve) => {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying configuration for application key: ${this.applicationKey}` });
      let tableConfiguration = new TableConfiguration();
      new ActionGet()
      .setPgConnector(this.pgConnector)
      .setTableName(tableConfiguration.tableName)
      .setTableFields(tableConfiguration.tableFields)
      .setConditionApplicationKey(this.applicationKey)
      .execute().then((result) => {
        if(result.length === 0) {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No configuration found for application key: ${this.applicationKey}` });
          resolve({});
        } else {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Configuration found for application key: ${this.applicationKey}` });
          let configuration = {};
          result.forEach((row) => {
            if(!row) {return;}
            if(!row.key) {return;}
            if(!row.value) {return;}
            /**
             * Keys can be nested. Nested keys are separated by a dot.
             *
             * Nested keys must be returned as nested objects.
             */

            if(! row.key.includes('.')) {
              configuration[row.key] = row.value;
              return;
            }


            let keys = row.key.split('.');
            let nameOfObject = keys[0];
            let nameOfNestedKey = keys[1];
            if(!configuration[nameOfObject]) {
              configuration[nameOfObject] = {};
            }
            configuration[nameOfObject][nameOfNestedKey] = row.value;
          });

          resolve(configuration);
        }
      });
    });
  }

  queryAllStories() {
    const LOCATION = 'DataStorage.queryAllStories';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    return new Promise((resolve) => {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying all stories for application key: ${this.applicationKey}` });
      let tableStory = new TableStory();
      new ActionGet()
      .setPgConnector(this.pgConnector)
      .setTableName(tableStory.tableName)
      .setTableFields(tableStory.tableFields)
      .setConditionApplicationKey(this.applicationKey)
      .execute().then((result) => {
        if(result.length === 0) {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No stories found for application key: ${this.applicationKey}` });
          resolve([]);
        } else {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Stories found for application key: ${this.applicationKey}` });
          resolve(result); // Return raw data
        }
      });
    });
  }

  queryStory(storyId) {
    const LOCATION = 'DataStorage.queryStory';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    return new Promise((resolve) => {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying story for application key: ${this.applicationKey}` });
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      let actionGet = new ActionGet().setPgConnector(this.pgConnector);
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter).setRightOrderField('SortNumber').setRightOrderDirection('ASC')
        .setLeftJoin(new TableChapter(), 'story.Id = chapter.storyId');
      actionGet
        .setConditionId(storyId)
        .setConditionApplicationKey(this.applicationKey)
        .setConditionPublishDate(new Date().toISOString().split('T')[0]);

      actionGet.execute().then((result) => {
        if(result.length === 0) {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No story found for application key: ${this.applicationKey}` });
          resolve({});
        } else {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Story found for application key: ${this.applicationKey}` });
          let storyRecord = {};

          tableStory.tableFields.map(field => field.toLowerCase()).forEach(field => {
            storyRecord[field] = result[0][`story_${field}`];
          });

          let chapters = [];
          result.forEach(row => {
            let chapter = {};
            tableChapter.tableFields.forEach(field => {
              let lowercasedField = field.toLowerCase();
              let fieldName = `chapter_${lowercasedField}`;
              fieldName = fieldName.toLowerCase();
              if(!row[fieldName]) {return;}

              chapter[lowercasedField] = row[fieldName];
            });
            chapters.push(chapter);
          });
          storyRecord.chapters = chapters;

          let dataCleaner = new DataCleaner();
          dataCleaner.removeApplicationKeys(storyRecord);
          resolve(storyRecord);
        }
      });
    });
  }

  queryChapter(chapterId) {
    const LOCATION = 'DataStorage.queryChapter';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    return new Promise((resolve) => {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying chapter for application key: ${this.applicationKey}` });
      let tableChapter = new TableChapter();
      let tableParagraph = new TableParagraph();
      let actionGet = new ActionGet().setPgConnector(this.pgConnector);
      actionGet.setTable(tableChapter);
      actionGet.setRightTable(tableParagraph).setRightOrderField('SortNumber').setRightOrderDirection('ASC')
        .setLeftJoin(new TableParagraph(), 'chapter.Id = paragraph.chapterId');
      actionGet
        .setConditionId(chapterId)
        .setConditionApplicationKey(this.applicationKey)
      if(this.publishDate === undefined) {
        actionGet.setConditionPublishDate();
      } else {
        actionGet.setConditionPublishDate(this.publishDate);
      }

      actionGet.execute().then((result) => {
        if(result.length === 0) {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No chapter found for application key: ${this.applicationKey}` });
          resolve({});
        } else {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Chapter found for application key: ${this.applicationKey}` });
          let chapterRecord = {};

          tableChapter.tableFields.map(field => field.toLowerCase()).forEach(field => {
            chapterRecord[field] = result[0][`chapter_${field}`];
          });

          let paragraphs = [];
          result.forEach(row => {
            let paragraph = {};
            tableParagraph.tableFields.forEach(field => {
              let lowercasedField = field.toLowerCase();
              let fieldName = `paragraph_${lowercasedField}`;
              if(!row[fieldName]) {return;}

              paragraph[lowercasedField] = row[fieldName];
            });
            paragraphs.push(paragraph);
          });
          chapterRecord.paragraphs = paragraphs;

          let dataCleaner = new DataCleaner();
          dataCleaner.removeApplicationKeys(chapterRecord);
          resolve(chapterRecord);
        }
      });
    });
  }

  queryIdentityByKey(userKey) {
    const LOCATION = 'DataStorage.queryIdentityByKey';
    if (!this.applicationKey) {
      throw new Error('Application key is required');
    }
    return new Promise((resolve) => {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying identity by key for application key: ${this.applicationKey}` });
      let tableIdentity = new TableIdentity();
      let actionGet = new ActionGet()
      .setPgConnector(this.pgConnector)
      .setTableName(tableIdentity.tableName)
      .setTableFields(tableIdentity.tableFields)
      .setCustomConditions(`key = '${userKey}'`)
      .setCustomConditions(`active = true`)
      .setConditionApplicationKey(this.applicationKey);
      
      actionGet.execute().then((result) => {
        if(result.length === 0) {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No identity found for key: ${userKey}` });
          resolve({});
        } else {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Identity found for key: ${userKey}` });
          let identityRecord = result[0];
          let dataCleaner = new DataCleaner();
          dataCleaner.removeApplicationKeys(identityRecord);
          resolve(identityRecord);
        }
      });
    });
  }

  createRecord(table, values) {
    const LOCATION = 'DataStorage.createRecord';
    Logging.debugMessage({ severity: 'FINE', location: LOCATION, message: `Creating record in table: ${table.getTableName()()}` });
    return new Promise((resolve, reject) => {
      // Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Creating record in table: ${table.getTableName()()}` });
      const actionCreate = new ActionCreate().setPgConnector(this.pgConnector).setTable(table);
      Object.entries(values).forEach(([key, value]) => {
        actionCreate.setValue(key, value);
      });
      actionCreate.execute()
        .then((result) => {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Record created in table: ${table.getTableName()()}` });
          resolve(result[0]);
        })
        .catch((error) => {
          Logging.debugMessage({ severity: 'ERROR', location: LOCATION, message: `Error creating record in table: ${table.getTableName()()}`, error });
          reject(error);
        });
    });
  }

  updateData(tableName, values) {
    const LOCATION = 'DataStorage.updateData';
    Logging.debugMessage({ severity: 'FINE', location: LOCATION, message: `Updating record in table: ${tableName}` });

    if(!tableName) {
      throw new Error('Table name is required');
    }
    if (!values || typeof values !== 'object') {
      throw new Error('Values object is required');
    }

    let table;
    switch (tableName) {
      case 'configuration':
        table = new TableConfiguration();
        break;
      case 'paragraph':
        table = new TableParagraph();
        break;
      case 'story':
        table = new TableStory();
        break;
      case 'chapter':
        table = new TableChapter();
        break;
      case 'identity':
        table = new TableIdentity();
        break;
      default:
        throw new Error(`Invalid table name: ${tableName}`);
    }

    return new Promise((resolve, reject) => {
      const actionUpdate = new ActionUpdate().setPgConnector(this.pgConnector).setTable(table);
      actionUpdate.setValues(values);

      actionUpdate.execute()
        .then((result) => {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Record updated in table: ${table.getTableName()}` });
          resolve(result[0]);
        })
        .catch((error) => {
          Logging.debugMessage({ severity: 'ERROR', location: LOCATION, message: `Error updating record in table: ${table.getTableName()}`, error });
          reject(error);
        });
    });
  }

  deleteData(tableName, id) {
    const LOCATION = 'DataStorage.deleteData';
    Logging.debugMessage({ severity: 'FINE', location: LOCATION, message: `Deleting record in table: ${tableName}` });

    if (!tableName) {
      throw new Error('Table name is required');
    }
    if (!id) {
      throw new Error('ID is required');
    }

    let table;
    switch (tableName) {
      case 'configuration':
        table = new TableConfiguration();
        break;
      case 'paragraph':
        table = new TableParagraph();
        break;
      case 'story':
        table = new TableStory();
        break;
      case 'chapter':
        table = new TableChapter();
        break;
      case 'identity':
        table = new TableIdentity();
        break;
      default:
        throw new Error(`Invalid table name: ${tableName}`);
    }

    return new Promise((resolve, reject) => {
      const actionDelete = new ActionDelete().setPgConnector(this.pgConnector).setTable(table).setId(id);
      actionDelete.execute()
        .then(() => {
          Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Record deleted in table: ${table.getTableName()}` });
          resolve(); // Only resolve, do not return data
        })
        .catch((error) => {
          Logging.debugMessage({ severity: 'ERROR', location: LOCATION, message: `Error deleting record in table: ${table.getTableName()}`, error });
          reject(error);
        });
    });
  }
}

module.exports = { DataStorage };
