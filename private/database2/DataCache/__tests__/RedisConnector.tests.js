const redis = require('redis');
const { RedisConnector } = require('../RedisConnector');
const { Logging } = require('../../../modules/logging.js');

const MOCK_ENVIRONMENT = {
  APPLICATION_APPLICATION_KEY: 'testKey',
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  REDIS_PASSWORD: 'test-password',
  REDIS_HOST: 'test-host',
  REDIS_PORT: 'test-port',
};

jest.mock('redis', () => {
  const mClient = {
    connect: jest.fn().mockResolvedValue(),
    quit: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(),
    setEx: jest.fn().mockResolvedValue(),
    del: jest.fn().mockResolvedValue(),
    isReady: false,
    on: jest.fn().mockImplementation((event, callback) => {
      // if (event === 'error') {
      //   callback(new Error('Redis Client Error'));
      // }
      return mClient;
    }),
  };
  return {
    createClient: jest.fn(() => mClient),
  };
});

jest.mock('../../../modules/logging.js', () => ({
  Logging: {
    debugMessage: jest.fn(),
  },
}));

describe('RedisConnector', () => {
  let redisConnector;
  let redisClient;

  beforeEach(() => {
    redisConnector = new RedisConnector(MOCK_ENVIRONMENT);
    redisClient = redis.createClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new instance of RedisConnector', () => {
    expect(redisConnector).toBeInstanceOf(RedisConnector);
  });

  it('should call the redis createClient method', () => {
    expect(redis.createClient).toHaveBeenCalled();
  });

  it('should connect to redis', async () => {
    await redisConnector.connect();
    expect(redisClient.connect).toHaveBeenCalled();
    expect(Logging.debugMessage).toHaveBeenCalledWith({
      severity: 'FINEST',
      message: 'RedisConnector.connecting',
      location: 'RedisConnector.connect',
    });
    expect(Logging.debugMessage).toHaveBeenCalledWith({
      severity: 'FINEST',
      message: 'RedisConnector.connected',
      location: 'RedisConnector.connect',
    });
  });

  it('should disconnect from redis', async () => {
    // Vorbedingung des Trennens: Es gibt eine offene Verbindung. Ohne sie
    // lehnt der echte Client mit "The client is closed" ab — deshalb ruft der
    // Connector `quit()` nur dann.
    redisClient.isOpen = true;
    await redisConnector.disconnect();
    expect(redisClient.quit).toHaveBeenCalled();
    expect(Logging.debugMessage).toHaveBeenCalledWith({
      severity: 'FINEST',
      message: 'RedisConnector.disconnecting',
      location: 'RedisConnector.disconnect',
    });
    expect(Logging.debugMessage).toHaveBeenCalledWith({
      severity: 'FINEST',
      message: 'RedisConnector.disconnected',
      location: 'RedisConnector.disconnect',
    });
  });

  it('should get value from redis', async () => {
    const key = 'testKey';
    const value = 'testValue';

    redisClient.get.mockResolvedValue(value);

    const result = await redisConnector.get(key);

    expect(redisClient.get).toHaveBeenCalledWith(key);
    expect(result).toBe(value);
    expect(Logging.debugMessage).toHaveBeenCalledWith({
      severity: 'FINEST',
      message: `Getting Key: ${key}`,
      location: 'RedisConnector.get',
    });
  });

  test('should set value in redis with expiration', async () => {
    const key = 'testKey';
    const value = 'testValue';
    const expiration = 30;

    await redisConnector.setEx(key, expiration, value);

    expect(redisClient.setEx).toHaveBeenCalledWith(key, expiration, value);
    expect(Logging.debugMessage).toHaveBeenCalledWith({
      severity: 'FINEST',
      message: `Setting Key: ${key}`,
      location: 'RedisConnector.setEx',
    });
  });

  test('should delete value from redis', async () => {
    const key = 'testKey';

    await redisConnector.del(key);

    expect(redisClient.del).toHaveBeenCalledWith(key);
    expect(Logging.debugMessage).toHaveBeenCalledWith({
      severity: 'FINEST',
      message: `Deleting Key: ${key}`,
      location: 'RedisConnector.del',
    });
  });
});

/**
 * Was passiert, wenn der Client **nicht** mitspielt.
 *
 * Beide Methoden hingen: Sie hängten nur ein `.then()` an — lehnte der Client
 * ab, wurde die umgebende Promise nie aufgelöst. Der Aufrufer wartete dann
 * ewig, und mit ihm die HTTP-Anfrage, die ihn ausgelöst hatte. Genau so blieb
 * das Löschen eines Absatzes stehen: Die Datenbank war abgeräumt, die Antwort
 * kam nie.
 *
 * Gemessen an `redis@4.7.1`, ohne laufenden Server:
 * - Ein zweiter `connect()` während des ersten lehnt ab: "Socket already opened"
 * - `quit()` an einem geschlossenen Client lehnt ab: "The client is closed"
 *
 * Beides tritt im Betrieb auf, sobald mehrere Schlüssel gleichzeitig abgeräumt
 * werden.
 */
describe('RedisConnector: der Client lehnt ab', () => {
  it('connect lehnt ab, statt zu hängen', async () => {
    const connector = new RedisConnector(MOCK_ENVIRONMENT);
    const client = redis.createClient();
    client.isOpen = false;
    client.connect.mockRejectedValueOnce(new Error('Socket already opened'));

    await expect(connector.connect()).rejects.toThrow('Socket already opened');
  });

  it('disconnect an einem geschlossenen Client ist kein Fehler', async () => {
    const connector = new RedisConnector(MOCK_ENVIRONMENT);
    const client = redis.createClient();
    client.isOpen = false;

    await expect(connector.disconnect()).resolves.toBeUndefined();
    expect(client.quit).not.toHaveBeenCalled();
  });

  it('quit lehnt ab, statt zu hängen', async () => {
    const connector = new RedisConnector(MOCK_ENVIRONMENT);
    const client = redis.createClient();
    client.isOpen = true;
    client.quit.mockRejectedValueOnce(new Error('The client is closed'));

    await expect(connector.disconnect()).rejects.toThrow(
      'The client is closed'
    );
  });

  it('gleichzeitige connect-Aufrufe teilen sich einen Verbindungsversuch', async () => {
    const connector = new RedisConnector(MOCK_ENVIRONMENT);
    const client = redis.createClient();
    client.isOpen = false;
    client.connect.mockClear();
    client.connect.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            client.isOpen = true;
            resolve();
          }, 10);
        })
    );

    await Promise.all([
      connector.connect(),
      connector.connect(),
      connector.connect(),
    ]);

    // Ein zweiter Aufruf am echten Client lehnt mit "Socket already opened" ab.
    expect(client.connect).toHaveBeenCalledTimes(1);
  });
});
