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

  getData(parameterObject) {
    return new Promise((resolve) => {
      let syncResult = new DataFacadeSync(this.environment).getData(parameterObject);
      resolve(syncResult);
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

  async getData(parameterObject) {
    if(parameterObject.request.table =='configuration') {
      return this.getConfigurations();
    }
    if(parameterObject.request.table =='paragraph') {
      let recordId = parameterObject?.request?.id;
      return this.getParagraphs(recordId);
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
      return this.getChapter(recordId);
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

  getData(parameterObject) {
    if (parameterObject.returnPromise) {
      return new DataFacadePromise(this.environment).getData(parameterObject);
    } else {
      return new DataFacadeSync(this.environment).getData(parameterObject);
    }
  }

  static isDataMockEnabled() {
    const environment = new Environment().getEnvironment();
    return environment.MOCK_DATA_ENABLE === 'true';
  }
}

module.exports = { DataFacade };