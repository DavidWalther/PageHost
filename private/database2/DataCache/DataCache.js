/**
 * This class serves as a layer of abstraction between the actual cache service and the parts of the application that use the cache functionality.
 * This allows to easily switch the cache service without changing the code that uses the cache.
 *
 * Other responsibilities:
 * - generation of cache keys to identify the data in the cache
 * - setting cache expiration times
 * - handling and replacing deprecated cache keys
 */
const { RedisConnector } = require('./RedisConnector');
const { Logging } = require('../../modules/logging.js');

class GlobalCacheKeyGenerator {
  constructor(environmentVars) {
    this.environmentVars = environmentVars;
  }

  generateGlobalKeyPrefix() {
    const keyElements = [];
    // key prefix to create 'Cache spaces' for 'Production', 'Staging', 'Dev', ... environments
    keyElements.push(this.environmentVars.CACHE_KEY_PREFIX);

    // application key to create 'Cache spaces' for 'Application A', 'Application B', ... applications
    keyElements.push(this.environmentVars.APPLICATION_APPLICATION_KEY);

    // data increment force an application to clear cache outside of the cache expiration time
    keyElements.push(this.environmentVars.CACHE_DATA_INCREMENT);

    return keyElements.join('-');
  }

  getKeyLifetimeInSeconds() {
    // cache expiration time in seconds
    return this.environmentVars.CACHE_CONTAINER_EXPIRATION_SECONDS;
  }
}

class MetaDataCacheKeyGenerator extends GlobalCacheKeyGenerator {
  constructor(environmentVars) {
    super(environmentVars);
  }

  generateCacheKey() {
    return this.generateGlobalKeyPrefix() + '-metadata';
  }

  generateCacheKeyDeprecated() {
    return this.generateGlobalKeyPrefix() + '-metadata';
  }
}

class ParagraphCacheKeyGenerator extends GlobalCacheKeyGenerator {
  constructor(environmentVars) {
    super(environmentVars);
  }

  generateCacheKey(id) {
    return this.generateGlobalKeyPrefix() + '-paragraphs-' + id;
  }

  generateCacheKeyDeprecated(id) {
    return this.generateGlobalKeyPrefix() + '-paragraphs-' + id;
  }
}

class ChapterCacheKeyGenerator extends GlobalCacheKeyGenerator {
  constructor(environmentVars) {
    super(environmentVars);
  }

  generateCacheKey(id) {
    return this.generateGlobalKeyPrefix() + '-chapters-' + id;
  }

  generateCacheKeyDeprecated(id) {
    return this.generateGlobalKeyPrefix() + '-chapters-' + id;
  }
}

class StoryCacheKeyGenerator extends GlobalCacheKeyGenerator {
  constructor(environmentVars) {
    super(environmentVars);
  }

  generateCacheKey(id) {
    return this.generateGlobalKeyPrefix() + '-stories-' + id;
  }

  generateCacheKeyDeprecated(id) {
    return this.generateGlobalKeyPrefix() + '-stories-' + id;
  }
}

class StoriesAllCacheKeyGenerator extends GlobalCacheKeyGenerator {
  constructor(environmentVars) {
    super(environmentVars);
  }

  generateCacheKey() {
    return this.generateGlobalKeyPrefix() + '-stories-all';
  }

  generateCacheKeyDeprecated() {
    return this.generateGlobalKeyPrefix() + '-stories-all';
  }
}

class UsedAuthCodesCacheKeyGenerator extends GlobalCacheKeyGenerator {
  constructor(environmentVars) {
    super(environmentVars);
  }
  generateCacheKey(code) {
    return this.generateGlobalKeyPrefix() + '-used-auth-codes' + code;
  }

  generateCacheKeyDeprecated() {
    return null;
  }

  getExpireTime() {
    // cache expiration time in seconds
    return 60 * 20; // 10 minutes
  }
}

class CacheKeyGeneratorFactory {
  constructor(environmentVars) {
    this.environmentVars = environmentVars;
  }

  getProduct(key) {
    const LOCATION = 'CacheKeyGeneratorFactory.getProduct';

    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Key: ${key}` });

    // first check for special keys
    if (key.startsWith('used-auth-codes')) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: 'Creating UsedAuthCodesCacheKeyGenerator' });
      return new UsedAuthCodesCacheKeyGenerator(this.environmentVars);
    }
    if(key === 'metadata') {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: 'Creating MetaDataCacheKeyGenerator' });
      return new MetaDataCacheKeyGenerator(this.environmentVars);
    }
    if(key === 'storiesAll') {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: 'Creating StoriesAllCacheKeyGenerator' });
      return new StoriesAllCacheKeyGenerator(this.environmentVars);
    }

    // then check for keys that start with a specific prefix
    let idPrefix = key.substring(0, 4);

    switch (idPrefix) {
      case '000p':
        // paragraph
        Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: 'Creating ParagraphCacheKeyGenerator' });
        return new ParagraphCacheKeyGenerator(this.environmentVars);
      case '000c':
        // chapter
        Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: 'Creating ChapterCacheKeyGenerator' });
        return new ChapterCacheKeyGenerator(this.environmentVars);
      case '000s':
        // story
        Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: 'Creating StoryCacheKeyGenerator' });
        return new StoryCacheKeyGenerator(this.environmentVars);
      default:
        Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: 'Unknown cache key' });
        throw new Error('Unknown cache key');
    }
  }
}

class DataCache2 {
  constructor(environmentObject) {22
    if (!environmentObject) {
      throw new Error('Environment object is required');
    }
    this.environment = environmentObject;
    this.redis = new RedisConnector(environmentObject);
  }

  async get(key) {
    const LOCATION = 'DataCache2.get';

    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Key: ${key}` });
    const cacheKeyGenerator = new CacheKeyGeneratorFactory(this.environment).getProduct(key);
    let cacheKeyCurrent = cacheKeyGenerator.generateCacheKey(key);
    let cacheKeyDeprecated = cacheKeyGenerator.generateCacheKeyDeprecated(key);

    await this.redis.connect();
    let getPromises = [];
    getPromises.push(this.redis.get(cacheKeyCurrent));
    if(cacheKeyDeprecated) { this.redis.get(cacheKeyDeprecated)};

    let promiseResults = await Promise.all(getPromises);
    await this.redis.disconnect();

    // if either of the promises returned a value, return that value
    let value = promiseResults[0] || promiseResults[1];

    if (value) {
      Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Key ${key}, Cache-Result: Hit` });
      return JSON.parse(value);
    }
    Logging.debugMessage({ severity: 'FINEST', location: LOCATION, message: `Key ${key}, Cache-Result: Miss` });
    return null;
  }

  async set(key, value) {
    const LOCATION = 'DataCache2.set';
    const cacheKeyGenerator = new CacheKeyGeneratorFactory(this.environment).getProduct(key);
    let cacheKey = cacheKeyGenerator.generateCacheKey(key);
    const cacheExpirationSeconds = cacheKeyGenerator.getExpireTime();

    Logging.debugMessage({ severity: 'FINEST', message: `Key: ${cacheKey}`, location: LOCATION });
    await this.redis.connect();
    await this.redis.setEx(cacheKey, cacheExpirationSeconds, JSON.stringify(value));
    return await this.redis.disconnect();
  }

  /**
   * Future implementation
   */
  async flush(key) {
    const LOCATION = 'DataCache.flush';
    Logging.debugMessage({ severity: 'FINEST', message: `Key: ${key}`, location: LOCATION });

    return await this.redis.del(cacheKeyPrefix + '-' + key);
  }
}

module.exports = { DataCache2 };




function flushCache(cacheKey) {
  const cache = new DataCache();
  cache.flush(cacheKey);
}
//flushCache('chapters-000c00000000000023');
//flushCache('chapters-000s00000000000009');
//flushCache('paragraphs-000c00000000000024');

/*
cacheChapter.get(cacheKey).then(cachedChapter => {
  console.log('cachedChapter:', cachedChapter);
});
*/


/*

async function test() {


  const testdata = {
    "name": "John Doe",
    "age": 30,
    "city": "New York",
    "state": "NY"
};

  const cache = new DataCache();
  await cache.connect();
  //await cache.set('test', testdata);
  const testValue = await cache.get('test');
  console.log('testValue:', testValue);
  await cache.disconnect();
}

test()
*/
