const { Logging } = require('../modules/logging.js');
const { DataCache2 } = require('./DataCache/DataCache.js');
const { DataStorage } = require('./DataStorage/DataStorage.js');
const {
  NodeContentRepository,
} = require('./repositories/NodeContentRepository.js');
const { ContentRepository } = require('./repositories/ContentRepository.js');

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

  setSkipCache(skipCache) {
    this.skipCache = skipCache;
    return this;
  }

  getData(parameterObject) {
    return new Promise((resolve) => {
      let syncResult = new DataFacadeSync(this.environment)
        .setSkipCache(this.skipCache)
        .setScopes(this.scopes)
        .getData(parameterObject);
      resolve(syncResult);
    });
  }

  updateData(data) {
    return new Promise((resolve, reject) => {
      const syncFacade = new DataFacadeSync(this.environment);
      syncFacade.updateData(data).then(resolve).catch(reject);
    });
  }

  createData(data) {
    return new Promise((resolve, reject) => {
      const syncFacade = new DataFacadeSync(this.environment);
      syncFacade.createData(data).then(resolve).catch(reject);
    });
  }

  deleteData(data) {
    return new Promise((resolve, reject) => {
      const syncFacade = new DataFacadeSync(this.environment);
      syncFacade.deleteData(data).then(resolve).catch(reject);
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

  setSkipCache(skipCache) {
    this._skipCache = skipCache;
    return this;
  }
  getSkipCache() {
    return this._skipCache === true ? true : false; // this enforces a boolean value
  }

  /**
   * Quelle der Inhalte — Knoten, Inhalte und der Baum.
   *
   * `configuration` und `identity` laufen bewusst nicht darüber: beide waren
   * von der Umstellung nicht betroffen und sprechen direkt mit `DataStorage`
   * (`createDirectStorage`). Wer zuständig ist, entscheidet
   * `ContentRepository.owns()` — beim Lesen wie beim Schreiben.
   */
  createContentRepository() {
    return new NodeContentRepository(this.environment).setApplicationKey(
      this.environment.APPLICATION_APPLICATION_KEY
    );
  }

  /**
   * `DataStorage` für alles, was **nicht** Inhalt ist: `configuration` und
   * `identity`.
   *
   * Beide Tabellen sind von der Umstellung nicht betroffen und bleiben
   * unverändert beschreibbar — `identity` trägt den Refresh-Token und ist damit
   * Teil der Anmeldung, nicht des Inhaltsmodells.
   */
  createDirectStorage() {
    const dataStorage = new DataStorage(this.environment);
    dataStorage.setConditionApplicationKey(
      this.environment.APPLICATION_APPLICATION_KEY
    );
    return dataStorage;
  }

  /**
   * Tabellen-Definition für die Objekte, die nicht zum Inhalt gehören.
   * `identity` wird nirgends angelegt — nur gelesen und geändert.
   */
  createDirectTable(object) {
    switch (String(object).toLowerCase()) {
      case 'configuration':
        return new (require('./tables/configuration').TableConfiguration)();
      default:
        throw new Error(`Invalid table name: ${object}`);
    }
  }

  async getData(parameterObject) {
    if (parameterObject.request.table == 'configuration') {
      return this.getConfigurations();
    }
    if (
      parameterObject.request.table == 'node' ||
      parameterObject.request.table == 'content'
    ) {
      if (!this.getSkipCache()) {
        return this.getTypeFree(
          parameterObject.request.table,
          parameterObject?.request?.id
        );
      }
      return this.getTypeFreeWithoutCache(
        parameterObject.request.table,
        parameterObject
      );
    }
    if (parameterObject.request.table == 'identity') {
      // Identity queries always bypass cache for data freshness
      if (parameterObject?.request?.refreshTokenId) {
        return this.getIdentityByRefreshTokenIdWithoutCache(parameterObject);
      }
      return this.getIdentityByKeyWithoutCache(parameterObject);
    }
    if (parameterObject.request.table == 'contents') {
      if (!this.getSkipCache()) {
        return this.getContentsTree();
      }
      return this.getContentsTreeWithoutCache();
    }
  }

  async updateData(data) {
    const LOCATION = 'DataFacadeSync.updateData';
    const { object, payload } = data;

    if (!object || !payload || !payload.id) {
      throw new Error('Invalid data object: Missing object type or payload ID');
    }

    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Updating data for object: ${object}`,
    });

    try {
      // the id vanishes on saving to postgres, so we need to save it again
      let copyOfPayload = JSON.parse(JSON.stringify(payload));
      let updatedData = ContentRepository.owns(object)
        ? await this.createContentRepository().updateRecord(object, payload)
        : await this.createDirectStorage().updateData(object, payload);

      if (!this.getSkipCache()) {
        const cache = new DataCache2(this.environment);
        await cache.set(copyOfPayload.id, copyOfPayload);
        Logging.debugMessage({
          severity: 'FINEST',
          location: LOCATION,
          message: `Data updated successfully for object: ${object}`,
        });
      } else {
        Logging.debugMessage({
          severity: 'FINEST',
          location: LOCATION,
          message: `Skipping cache update for object: ${object}`,
        });
      }
      return updatedData;
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        location: LOCATION,
        message: `Failed to update data for object: ${object}`,
        error,
      });
      throw error;
    }
  }

  async createData(data) {
    const LOCATION = 'DataFacadeSync.createData';
    const { object, payload } = data;
    if (!object || !payload) {
      throw new Error('Invalid data object: Missing object type or payload');
    }
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Creating data for object: ${object}`,
    });
    try {
      // Always skip cache for creation
      const createdRecord = ContentRepository.owns(object)
        ? await this.createContentRepository().createRecord(object, payload)
        : await this.createDirectStorage().createRecord(
            this.createDirectTable(object),
            payload
          );
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `Data created successfully for object: ${object}`,
      });
      return createdRecord;
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        location: LOCATION,
        message: `Failed to create data for object: ${object}`,
        error,
      });
      throw error;
    }
  }

  async deleteData(data) {
    const LOCATION = 'DataFacadeSync.deleteData';
    const { object, id } = data;
    if (!object || !id) {
      throw new Error('Invalid data object: Missing object type or id');
    }
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Deleting data for object: ${object}, id: ${id}`,
    });
    try {
      if (!ContentRepository.owns(object)) {
        await this.createDirectStorage().deleteData(object, id);
        return;
      }

      const removed = await this.createContentRepository().deleteRecord(
        object,
        id
      );
      await this.clearCacheFor(removed, id);
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        location: LOCATION,
        message: `Failed to delete data for object: ${object}`,
        error,
      });
      throw error;
    }
  }

  /**
   * Räumt die Cache-Einträge eines Löschvorgangs ab.
   *
   * **Unabhängig von `skipCache`.** Das war einmal anders: der
   * `DeleteEndpoint` setzt `skipCache(true)`, und daran hing auch das
   * Aufräumen — der gelöschte Datensatz blieb bis zum Ablauf der Frist im
   * Cache und wurde weiter ausgeliefert. `skipCache` heißt „lies nicht aus dem
   * Cache", nicht „lass Gelöschtes darin stehen".
   *
   * Abgeräumt wird, was die Quelle **tatsächlich** entfernt hat: beim Löschen
   * eines Knotens ist das der ganze Teilbaum samt seiner Inhalte. Jeder
   * Datensatz wird unter beiden Ids gelöscht — ein Eintrag kann unter der alten
   * angelegt worden sein, wenn ein Deep-Link von früher ihn geholt hat.
   */
  async clearCacheFor(removed, requestedId) {
    const LOCATION = 'DataFacadeSync.clearCacheFor';
    const cache = new DataCache2(this.environment);
    const keys = new Set();

    const collect = (table, records) => {
      (records || []).forEach((record) => {
        [record.id, record.legacy_id].forEach((value) => {
          if (value) {
            keys.add(this.cacheKeyFor(table, value));
          }
        });
      });
    };
    collect('node', removed?.nodes);
    collect('content', removed?.contents);

    // Die angefragte Id kann eine dritte Schreibweise sein — etwa die alte,
    // während der Datensatz unter der neuen abgelegt wurde.
    keys.add(this.cacheKeyFor('node', requestedId));
    keys.add(this.cacheKeyFor('content', requestedId));

    // Ein gelöschter Knoten ändert den Inhaltsbaum.
    keys.add('contentsTree');

    await Promise.all([...keys].map((key) => cache.del(key)));
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Cleared ${keys.size} cache keys after delete`,
    });
  }

  /**
   * Schreibt in den Cache und verzeiht, wenn das nicht geht.
   *
   * Die Daten sind an dieser Stelle bereits gelesen; ein nicht erreichbarer
   * Redis ist ein Grund, langsamer zu werden, kein Grund, die Antwort
   * fallenzulassen. Vorher stand hier ein nicht abgewartetes `cache.set` —
   * dessen Ablehnung fand niemanden, der sie fing, und beendete den Prozess.
   */
  async writeCache(cache, key, value) {
    const LOCATION = 'DataFacadeSync.writeCache';
    try {
      await cache.set(key, value);
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        location: LOCATION,
        message: `Failed to write cache key ${key}: ${error?.message || error}`,
        error,
      });
    }
  }

  async getConfigurations() {
    const LOCATION = 'DataFacadeSync.getConfigurations';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Querying configuration for application key: ${this.environment.APPLICATION_APPLICATION_KEY}`,
    });
    let cache = new DataCache2(this.environment);
    let product = await cache.get('metadata');
    if (!product) {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `No metadata in cache, querying database`,
      });
      let dataStorage = new DataStorage(this.environment);
      dataStorage.setConditionApplicationKey(
        this.environment.APPLICATION_APPLICATION_KEY
      );
      product = await dataStorage.queryConfiguration();
      await this.writeCache(cache, 'metadata', product);
    } else {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `Metadata found in cache`,
      });
    }
    return product;
  }

  async getContentsTree() {
    const LOCATION = 'DataFacadeSync.getContentsTree';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Querying contents tree for application key: ${this.environment.APPLICATION_APPLICATION_KEY}`,
    });
    let cache = new DataCache2(this.environment);
    let product = await cache.get('contentsTree');
    if (!product) {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `No contents tree in cache, building from database`,
      });
      product = await this.buildContentsTree();
      await this.writeCache(cache, 'contentsTree', product);
    } else {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `Contents tree found in cache`,
      });
    }
    return product;
  }

  async getContentsTreeWithoutCache() {
    const LOCATION = 'DataFacadeSync.getContentsTreeWithoutCache';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Building contents tree from database (no cache)`,
    });
    return this.buildContentsTree();
  }

  /**
   * Vollständiger Inhaltsbaum, bewusst ungefiltert (veröffentlicht und
   * unveröffentlicht) — der Publish-Filter läuft erst bei der Auslieferung.
   *
   * Der Zusammenbau selbst liegt im Repository: er hängt am Datenmodell und
   * sieht in der neuen Quelle grundlegend anders aus (rekursive CTE statt
   * flacher Abfragen je Ebene).
   */
  async buildContentsTree() {
    return this.createContentRepository().getContentsTree();
  }

  /**
   * Lesepfad der typfreien Antwortform (`node` / `content`).
   *
   * Eine Methode für beide, weil sich die alte Dreiteilung genau hier auflöst:
   * ein Knoten ist ein Knoten, gleich ob er früher Story oder Kapitel hieß.
   * Was bleibt, ist die Unterscheidung Knoten/Inhalt — und die ist eine Zeile.
   *
   * Der Cache-Schlüssel trägt die Form im Namen (`node:<id>`). Ohne das würde
   * ein alter Deep-Link, der über beide Wege hereinkommt, sich seinen Eintrag
   * mit der alten Form teilen.
   */
  cacheKeyFor(table, recordId) {
    return `${table}:${recordId}`;
  }

  async readTypeFree(table, recordId, publishDate) {
    const repository = this.createContentRepository();
    if (publishDate !== undefined) {
      repository.setPublishDate(publishDate);
    }
    return table === 'node'
      ? repository.getNode(recordId)
      : repository.getContent(recordId);
  }

  async getTypeFree(table, recordId) {
    const LOCATION = 'DataFacadeSync.getTypeFree';
    const cacheKey = this.cacheKeyFor(table, recordId);
    const cache = new DataCache2(this.environment);
    let product = await cache.get(cacheKey);
    if (!product) {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `No ${table} in cache, querying database: ${recordId}`,
      });
      product = await this.readTypeFree(table, recordId);
      await this.writeCache(cache, cacheKey, product);
    } else {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `${table} found in cache: ${recordId}`,
      });
    }
    return product;
  }

  async getTypeFreeWithoutCache(table, parameterObject) {
    const LOCATION = 'DataFacadeSync.getTypeFreeWithoutCache';
    const recordId = parameterObject?.request?.id;
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Querying ${table} ${recordId} for application key: ${this.environment.APPLICATION_APPLICATION_KEY}`,
    });
    return this.readTypeFree(
      table,
      recordId,
      parameterObject?.request?.publishDate
    );
  }

  async getIdentityByKeyWithoutCache(parameterObject) {
    let userKey = parameterObject?.request?.key;
    const LOCATION = 'DataFacadeSync.getIdentityByKeyWithoutCache';
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Querying identity by key for application key: ${this.environment.APPLICATION_APPLICATION_KEY}`,
    });
    let dataStorage = new DataStorage(this.environment);
    dataStorage.setConditionApplicationKey(
      this.environment.APPLICATION_APPLICATION_KEY
    );
    const product = await dataStorage.queryIdentityByKey(userKey);
    if (!product) {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `No identity found in database for key: ${userKey}`,
      });
    } else {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `Identity found in database for key: ${userKey}`,
      });
    }
    return product;
  }

  /**
   * Die Identität zu einer Refresh-Token-Id — der zweite Weg zu `identity`.
   *
   * Auch er umgeht den Cache: Beim Refresh entscheidet der **aktuelle** Stand
   * der Spalte, ob der vorgelegte Token noch gilt.
   */
  async getIdentityByRefreshTokenIdWithoutCache(parameterObject) {
    const LOCATION = 'DataFacadeSync.getIdentityByRefreshTokenIdWithoutCache';
    const refreshTokenId = parameterObject?.request?.refreshTokenId;
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Querying identity by refresh token id for application key: ${this.environment.APPLICATION_APPLICATION_KEY}`,
    });
    const dataStorage = this.createDirectStorage();
    return dataStorage.queryIdentityByRefreshTokenId(refreshTokenId);
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

  setSkipCache(skipCache) {
    this._skipCache = skipCache;
    return this;
  }
  getData(parameterObject) {
    if (parameterObject.returnPromise) {
      return new DataFacadePromise(this.environment)
        .setSkipCache(this._skipCache)
        .setScopes(this.scopes)
        .getData(parameterObject);
    } else {
      return new DataFacadeSync(this.environment)
        .setSkipCache(this._skipCache)
        .setScopes(this.scopes)
        .getData(parameterObject);
    }
  }

  updateData(data) {
    if (data.returnPromise) {
      return new DataFacadePromise(this.environment)
        .setSkipCache(this._skipCache)
        .setScopes(this.scopes)
        .updateData(data);
    } else {
      return new DataFacadeSync(this.environment)
        .setSkipCache(this._skipCache)
        .setScopes(this.scopes)
        .updateData(data);
    }
  }

  createData(data) {
    // Always skip cache for creation
    if (data.returnPromise) {
      return new DataFacadePromise(this.environment)
        .setSkipCache(true)
        .setScopes(this.scopes)
        .createData(data);
    } else {
      return new DataFacadeSync(this.environment)
        .setSkipCache(true)
        .setScopes(this.scopes)
        .createData(data);
    }
  }

  deleteData(data) {
    if (data.returnPromise) {
      return new DataFacadePromise(this.environment)
        .setSkipCache(this._skipCache)
        .setScopes(this.scopes)
        .deleteData(data);
    } else {
      return new DataFacadeSync(this.environment)
        .setSkipCache(this._skipCache)
        .setScopes(this.scopes)
        .deleteData(data);
    }
  }
}

// `DataFacadeSync` wird mit exportiert, damit die Wahl der Lesequelle direkt
// prüfbar ist, ohne den Umweg über eine Abfrage zu nehmen.
module.exports = { DataFacade, DataFacadeSync };
