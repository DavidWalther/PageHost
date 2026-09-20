const { Logging } = require('../../modules/logging.js');
const { Environment } = require('../../modules/environment.js');
const environment = new Environment().getEnvironment();
const redis = require('redis');

class RedisConnector {
  constructor(environmentObject) {
    if (!environmentObject) {
      throw new Error('Environment object is required');
    }

    /** Der laufende Verbindungsversuch, geteilt von allen Aufrufern. */
    this.connectPromise = null;
    this.redisClient = this.createClient(
      environmentObject.REDIS_PASSWORD,
      environmentObject.REDIS_HOST,
      environmentObject.REDIS_PORT
    ).on('error', (err) => console.log('Redis Client Error', err));
  }

  createClient(redis_password, redis_host, redis_port) {
    return redis.createClient({
      password: redis_password,
      socket: {
        host: redis_host,
        port: redis_port,
      },
    });
  }

  /**
   * Stellt die Verbindung her — **höchstens eine** auf einmal.
   *
   * Zwei Fallen stecken hier, und beide haben schon eine HTTP-Anfrage zum
   * Stillstand gebracht:
   *
   * 1. `connect()` ein zweites Mal aufzurufen, während der erste noch läuft,
   *    lehnt der Client ab ("Socket already opened"). Genau das passiert, wenn
   *    mehrere Schlüssel gleichzeitig abgeräumt werden — sie teilen sich diesen
   *    Connector. Deshalb wird der laufende Versuch geteilt.
   * 2. Eine Ablehnung wurde früher verschluckt: Die Methode hängte nur ein
   *    `.then()` an ihre eigene Promise. Lehnte der Client ab, wurde die nie
   *    aufgelöst, und der Aufrufer wartete für immer. Jetzt lehnt sie ab; wer
   *    damit umgehen kann, fängt es.
   */
  async connect() {
    Logging.debugMessage({
      severity: 'FINEST',
      message: 'RedisConnector.connecting',
      location: 'RedisConnector.connect',
    });

    if (this.redisClient.isOpen) {
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.redisClient.connect().finally(() => {
        this.connectPromise = null;
      });
    }

    await this.connectPromise;

    Logging.debugMessage({
      severity: 'FINEST',
      message: 'RedisConnector.connected',
      location: 'RedisConnector.connect',
    });
  }

  /**
   * Trennt die Verbindung. Ein bereits geschlossener Client ist kein Fehler —
   * `quit()` lehnte dort ab ("The client is closed"), und die Ablehnung hing
   * aus demselben Grund wie oben.
   */
  async disconnect() {
    Logging.debugMessage({
      severity: 'FINEST',
      message: 'RedisConnector.disconnecting',
      location: 'RedisConnector.disconnect',
    });

    if (!this.redisClient.isOpen) {
      return;
    }

    await this.redisClient.quit();

    Logging.debugMessage({
      severity: 'FINEST',
      message: 'RedisConnector.disconnected',
      location: 'RedisConnector.disconnect',
    });
  }

  /**
   * This method will handle the connection and disconnection of the RedisConnector.
   * @param  method the method that will be called after the connection to the cache has been established. A promise should be returned by this method.
   *  The method should accept the RedisConnector as a parameter.
   * @returns a Promise withe the data returned by the method.
   */
  async methodWrapper(method) {
    const LOCATION = 'RedisConnector.methodWrapper';

    return new Promise((mainResolve, mainReject) => {
      const readystate = this.redisClient.isReady;
      let returnedData;
      if (!readystate) {
        Logging.debugMessage({
          severity: 'FINEST',
          message: 'RedisConnector not ready ... temporarily connecting',
          location: LOCATION,
        });
        this.connect().then(() => {
          Logging.debugMessage({
            severity: 'FINEST',
            message: 'RedisConnector connected ... getting data',
            location: LOCATION,
          });
          method(this.redisClient).then((data) => {
            Logging.debugMessage({
              severity: 'FINEST',
              message: 'RedisConnector connected ... data retuned',
              location: LOCATION,
            });
            if (data) {
              returnedData = data;
            }
            Logging.debugMessage({
              severity: 'FINEST',
              message: 'RedisConnector disconnecting',
              location: LOCATION,
            });
            this.disconnect().then(() => {
              Logging.debugMessage({
                severity: 'FINEST',
                message: 'RedisConnector disconnected',
                location: LOCATION,
              });
              Logging.debugMessage({
                severity: 'FINEST',
                message: 'Data returned',
                location: LOCATION,
              });
              if (returnedData) {
                mainResolve(returnedData);
              } else {
                mainResolve();
              }
            });
          });
        });
      } else {
        Logging.debugMessage({
          severity: 'FINEST',
          message: 'RedisConnector already connected ... getting data',
          location: LOCATION,
        });
        method(this.redisClient).then((data) => {
          Logging.debugMessage({
            severity: 'FINEST',
            message: 'Data returned',
            location: LOCATION,
          });
          if (data) {
            mainResolve(data);
          } else {
            mainResolve();
          }
        });
      }
    });
  }

  async get(key) {
    const LOCATION = 'RedisConnector.get';

    Logging.debugMessage({
      severity: 'FINEST',
      message: `Getting Key: ${key}`,
      location: LOCATION,
    });
    return this.methodWrapper((redisClient) => {
      return redisClient.get(key);
    });
  }

  async setEx(key, expiration, value) {
    const LOCATION = 'RedisConnector.setEx';

    Logging.debugMessage({
      severity: 'FINEST',
      message: `Setting Key: ${key}`,
      location: LOCATION,
    });
    return this.methodWrapper((redisClient) => {
      return redisClient.setEx(key, expiration, value);
    });
  }

  async del(key) {
    const LOCATION = 'RedisConnector.del';
    Logging.debugMessage({
      severity: 'FINEST',
      message: `Deleting Key: ${key}`,
      location: LOCATION,
    });
    return this.methodWrapper((redisClient) => {
      return redisClient.del(key);
    });
  }
}

module.exports = { RedisConnector };

// =========================================================
// Example Usage
// =========================================================

//const DEFAULT_CACHE_EXPIRATION = 60 * 60 * 24; // 1 day
// default expiration is 10 seconds
const DEFAULT_CACHE_EXPIRATION = 30;

const testdata = {
  name: 'John Doe',
  age: 30,
  city: 'New York',
  state: 'NY',
};

const KEY_NAME = 'testKey';

async function testWithUpfrontConnection() {
  const connector = new RedisConnector();
  connector
    .connect()
    .then(() => {
      connector.setEx(
        KEY_NAME,
        DEFAULT_CACHE_EXPIRATION,
        JSON.stringify(testdata)
      );
    })
    .then(() => {
      connector.get(KEY_NAME).then((data) => {
        console.log('Data:', data);
      });
    })
    .finally(() => {
      connector.disconnect();
    });
}

async function testWithTemporaryConnection() {
  const connector = new RedisConnector();
  connector
    .setEx(KEY_NAME, DEFAULT_CACHE_EXPIRATION, JSON.stringify(testdata))
    .then(() => {
      connector.get(KEY_NAME).then((data) => {
        console.log('Data:', data);
      });
    });
}

//testWithTemporaryConnection();
//testWithUpfrontConnection();
