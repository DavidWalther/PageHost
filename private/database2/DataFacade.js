const { Logging } = require('../modules/logging.js');
const { Environment } = require('../modules/environment.js');
const { DataCache2 } = require('./DataCache/DataCache.js');
const { DataMock } = require('./DataMocks/DataMock.js');
const { DataStorage } = require('./DataStorage/DataStorage.js');

class DataFacadePromise {
  constructor(environmentObject) {
    if (!environmentObject) {
      throw new Error('Environment object is required');
    }
    this.environment = environmentObject;

  }

  setScopes(scopes) {
    this.scopes = scopes;
    return this;
  }

  getData(parameterObject) {
    return new Promise((resolve) => {
      let syncResult = new DataFacadeSync(this.environment).setScopes(this.scopes).getData(parameterObject);
      resolve(syncResult);
    });
  }

  updateData(data) {
    return new Promise((resolve, reject) => {
      const syncFacade = new DataFacadeSync(this.environment);
      syncFacade.updateData(data).then(resolve).catch(reject);
    });
  }
}

class DataFacadeSync {
  constructor(environmentObject) {
    if (!environmentObject) {
      throw new Error('Environment object is required');
    }
    this.environment = environmentObject;
  }

  setScopes(scopes) {
    this.scopes = scopes;
    return this;
  }

  async getData(parameterObject) {
    let hasEditScope = this.scopes?.has('edit'); 
    
    if(parameterObject.request.table =='configuration') {
      return this.getConfigurations();
    }
    if(parameterObject.request.table =='paragraph') {
      let recordId = parameterObject?.request?.id;

      if(!hasEditScope) {
        return this.getParagraphs(recordId);
      } 
      if(hasEditScope) {
        return this.getParagraphWithoutCache(parameterObject);
      }
    }
    if(parameterObject.request.table =='story' && !parameterObject.request.id) {
      return this.getAllStories();
    }
    if(parameterObject.request.table =='story' && parameterObject.request.id) {
      let recordId = parameterObject?.request?.id;
      return this.getStory(recordId);
    }
    if(parameterObject.request.table == 'chapter') {
      let recordId = parameterObject?.request?.id;
      if(!hasEditScope) {
        return this.getChapter(recordId);
      }
      if(hasEditScope) {
        return this.getChapter(recordId);
      }
    }
  }

  async updateData(data) {
    const LOCATION = 'DataFacadeSync.updateData';
    const { object, payload } = data;

    if (!object || !payload || !payload.id) {
      throw new Error('Invalid data object: Missing object type or payload ID');
    }

    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Updating data for object: ${object}` });

    const dataStorage = new DataStorage(this.environment);
    dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);

    try {
      // the id vanishes on saving to postgres, so we need to save it again
      let copyOfPayload = JSON.parse(JSON.stringify(payload));
      await dataStorage.updateData(object, payload);

      const cache = new DataCache2(this.environment);
      await cache.set(copyOfPayload.id, copyOfPayload);

      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Data updated successfully for object: ${object}` });
    } catch (error) {
      Logging.debugMessage({ severity: 'ERROR', location: LOCATION, message: `Failed to update data for object: ${object}`, error });
      throw error;
    }
  }

  async getConfigurations() {
    const LOCATION = 'DataFacadeSync.getConfigurations';
    if(DataFacade.isDataMockEnabled()) {
      return new DataMock().createConfiguration();
    }
    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying configuration for application key: ${this.environment.APPLICATION_APPLICATION_KEY}` });
    let cache = new DataCache2(this.environment);
    let product = await cache.get('metadata');
    if (!product) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No metadata in cache, querying database` });
      let dataStorage = new DataStorage(this.environment);
      dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);
      product = await dataStorage.queryConfiguration();
      cache.set('metadata', product);
    } else {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Metadata found in cache` });
    }
    return product;
  }

  async getParagraphWithoutCache(parameterObject) {
    let recordId = parameterObject?.request?.id;
    let publishDate = parameterObject?.request?.publishDate;
    const LOCATION = 'DataFacadeSync.getParagraphWithoutCache';
    if(DataFacade.isDataMockEnabled()) {
      return new DataMock().getParagraphById(recordId);
    }
    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying paragraphs for application key: ${this.environment.APPLICATION_APPLICATION_KEY}` });
    let dataStorage = new DataStorage(this.environment);
    dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);
    if (publishDate !== undefined) {
      dataStorage.setConditionPublishDate(publishDate);
    }
    let product = await dataStorage.queryParagraphs(recordId);
    if (!product) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No paragraphs in database` });
    } else {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Paragraphs found in database` });
    }
    return product;
  }

  async getParagraphs(recordId) {
    const LOCATION = 'DataFacadeSync.getParagraphs';
    if(DataFacade.isDataMockEnabled()) {
      return new DataMock().getParagraphById(recordId);
    }
    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying paragraphs for application key: ${this.environment.APPLICATION_APPLICATION_KEY}` });
    let cache = new DataCache2(this.environment);
    let product = await cache.get(recordId);
    if (!product) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No paragraphs in cache, querying database` });
      let dataStorage = new DataStorage(this.environment);
      dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);
      product = await dataStorage.queryParagraphs(recordId);
      cache.set(recordId, product);
    } else {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Paragraphs found in cache` });
    }
    return product;
  }

  async getAllStories() {
    const LOCATION = 'DataFacadeSync.getAllStories';
    if(DataFacade.isDataMockEnabled()) {
      return new DataMock().getAllStories();
    }
    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying all stories for application key: ${this.environment.APPLICATION_APPLICATION_KEY}` });
    let cache = new DataCache2(this.environment);
    let product = await cache.get('storiesAll');
    if (!product) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No stories in cache, querying database` });
      let dataStorage = new DataStorage(this.environment);
      dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);
      product = await dataStorage.queryAllStories();


      cache.set('storiesAll', product);
    } else {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Stories found in cache` });
    }
    return product;
  }

  async getStory(storyId) {
    const LOCATION = 'DataFacadeSync.getStory';
    if(DataFacade.isDataMockEnabled()) {
      return new DataMock().getStoryById(storyId);
    }
    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying story for application key: ${this.environment.APPLICATION_APPLICATION_KEY}` });
    let cache = new DataCache2(this.environment);
    let product = await cache.get(storyId);
    if (!product) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No story in cache, querying database` });
      let dataStorage = new DataStorage(this.environment);
      dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);
      product = await dataStorage.queryStory(storyId);
      cache.set(storyId, product);
    } else {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Story found in cache` });
    }
    return product;
  }

  async getChapter(recordId) {
    if(DataFacade.isDataMockEnabled()) {
      return new DataMock().getChapterById(recordId);
    }
    const LOCATION = 'DataFacadeSync.getChapter';
    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Querying chapter for application key: ${this.environment.APPLICATION_APPLICATION_KEY}` });
    let cache = new DataCache2(this.environment);
    let product = await cache.get(recordId);
    if (!product) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `No chapter in cache, querying database` });
      let dataStorage = new DataStorage(this.environment);
      dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);
      product = await dataStorage.queryChapter(recordId);
      cache.set(recordId, product);
    } else {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Chapter found in cache` });
    }
    return product;
  }
}

class DataFacade {
  constructor(environmentObject) {
    if (!environmentObject) {
      throw new Error('Environment object is required');
    }
    this.environment = environmentObject;
  }
  setScopes(scopes) {
    this.scopes = scopes;
    return this;
  }

  getData(parameterObject) {
    if (parameterObject.returnPromise) {
      return new DataFacadePromise(this.environment).setScopes(this.scopes).getData(parameterObject);
    } else {
      return new DataFacadeSync(this.environment).setScopes(this.scopes).getData(parameterObject);
    }
  }

  updateData(data) {
    if (data.returnPromise) {
      return new DataFacadePromise(this.environment).updateData(data);
    } else {
      return new DataFacadeSync(this.environment).updateData(data);
    }
  }

  static isDataMockEnabled() {
    const environment = new Environment().getEnvironment();
    return environment.MOCK_DATA_ENABLE === 'true';
  }
}

module.exports = { DataFacade };