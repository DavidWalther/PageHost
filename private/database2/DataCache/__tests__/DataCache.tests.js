const { DataCache2 } = require('../DataCache.js');
const { RedisConnector } = require('../RedisConnector.js');

jest.mock('../RedisConnector.js');

const MOCK_ENVIRONMENT = {
  APPLICATION_APPLICATION_KEY: 'testKey',
  LOGGING_SEVERITY_LEVEL: 'INFO',
  CACHE_DATA_INCREMENT: '17',
  CACHE_KEY_PREFIX: 'testPrefix',
  CACHE_CONTAINER_EXPIRATION_SECONDS: '3600',
  REDIS_PASSWORD: 'test-password',
  REDIS_HOST: 'test-host',
  REDIS_PORT: 'test-port',
};
//const mockConnect =  () => { return new Promise((resolve) => {resolve()}) };

let MOCK_GET_VALUE = { key: 'value' };
let mockConnect = jest.fn().mockImplementation(() => {
  return new Promise((resolve, reject) => {
    if (valueIsReady) {
      reject('Already connected');
    }
    valueIsReady = true;
    resolve();
  });
});

let mockDisconnect = jest.fn().mockImplementation(() => {
  return new Promise((resolve, reject) => {
    if (!valueIsReady) {
      reject('Not connected');
    }
    valueIsReady = false;
    resolve();
  });
});
let mockGet = jest.fn().mockResolvedValue(JSON.stringify(MOCK_GET_VALUE));
let mockSetEx = jest.fn().mockResolvedValue();
let mockDel = jest.fn().mockResolvedValue();
let mockIsReady = jest.fn().mockReturnValue(false);
let mockIsOpen = jest.fn().mockReturnValue(false);

RedisConnector.mockImplementation(() => {
  return {
    connect: mockConnect,
    disconnect: mockDisconnect,
    get: mockGet,
    setEx: mockSetEx,
    del: mockDel,
    isReady: mockIsReady,
    isOpen: mockIsOpen,
  };
});

describe('Basics', () => {
  beforeEach(() => {
    process.env = MOCK_ENVIRONMENT;
    RedisConnector.mockClear();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockGet.mockClear();
    mockSetEx.mockClear();
    mockDel.mockClear();
    valueIsReady = false;
  });

  it('constructor should call RedisConnector constructor', () => {
    expect(RedisConnector).not.toHaveBeenCalled();

    const dataCache = new DataCache2(MOCK_ENVIRONMENT);
    expect(RedisConnector).toHaveBeenCalled();
  });

  it("the connection should be opened implicitly when calling 'get()'", async () => {
    expect(RedisConnector).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();

    const dataCache = new DataCache2(MOCK_ENVIRONMENT);
    expect(RedisConnector).toHaveBeenCalled();

    await dataCache.get('metadata');
    expect(mockConnect).toHaveBeenCalled();
  });

  it("the connection should be closed implicitly when calling 'get()'", async () => {
    expect(RedisConnector).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();

    const dataCache = new DataCache2(MOCK_ENVIRONMENT);
    expect(RedisConnector).toHaveBeenCalled();

    await dataCache.get('metadata');
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

describe('Cache Keys', () => {
  beforeEach(() => {
    RedisConnector.mockClear();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockGet.mockClear();
    valueIsReady = false;
  });

  it('should call RedisConnector.get with the correct key when "metadata" is requested', async () => {
    const dataCache = new DataCache2(MOCK_ENVIRONMENT);

    let getPromise = dataCache.get('metadata');
    expect(getPromise).toBeInstanceOf(Promise);

    let result = await getPromise;
    const expectedKey_current = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-metadata`;
    expect(mockGet).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(expectedKey_current);

    expect(result).toStrictEqual(MOCK_GET_VALUE);
  });

  it('should call RedisConnector.get with the correct key when "metadata" and its deprecated version is requested', async () => {
    const dataCache = new DataCache2(MOCK_ENVIRONMENT);

    let getPromise = dataCache.get('metadata');
    expect(getPromise).toBeInstanceOf(Promise);
    let result = await getPromise;
    const expectedKey_current = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-metadata`;
    const expectedKey_deprecated = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-metadata`;
    expect(result).toStrictEqual(MOCK_GET_VALUE);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenCalledWith(expectedKey_current);
    expect(mockGet).toHaveBeenCalledWith(expectedKey_deprecated);
  });

  it('should call RedisConnector.get with the correct key when "contentsTree" is requested', async () => {
    const dataCache = new DataCache2(MOCK_ENVIRONMENT);

    await dataCache.get('contentsTree');
    const expectedKey = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-contents-tree`;
    expect(mockGet).toHaveBeenCalledWith(expectedKey);
  });

  it('should call RedisConnector.setEx with the correct key and long-term TTL when "contentsTree" is set', async () => {
    const dataCache = new DataCache2(MOCK_ENVIRONMENT);

    const value = { result: [] };
    const expectedKey = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-contents-tree`;

    await dataCache.set('contentsTree', value);
    expect(mockSetEx).toHaveBeenCalledWith(
      expectedKey,
      MOCK_ENVIRONMENT.CACHE_CONTAINER_EXPIRATION_SECONDS,
      JSON.stringify(value)
    );
  });

  it('should call RedisConnector.setEx with the correct key when "metadata" is set', async () => {
    const dataCache = new DataCache2(MOCK_ENVIRONMENT);

    const key = 'metadata';
    const value = { key: 'value' };
    const expectedKey = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-metadata`;

    let setPromise = dataCache.set(key, value);
    expect(setPromise).toBeInstanceOf(Promise);

    await setPromise;
    expect(mockSetEx).toHaveBeenCalled();
    expect(mockSetEx).toHaveBeenCalledWith(
      expectedKey,
      MOCK_ENVIRONMENT.CACHE_CONTAINER_EXPIRATION_SECONDS,
      JSON.stringify(value)
    );
  });
});

describe('Cache Keys der typfreien Antwortform', () => {
  const PREFIX = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}`;

  beforeEach(() => {
    RedisConnector.mockClear();
    mockGet.mockClear();
    mockSetEx.mockClear();
    valueIsReady = false;
  });

  it('legt einen Knoten in einem eigenen Schlüsselraum ab', async () => {
    await new DataCache2(MOCK_ENVIRONMENT).get('node:000n00000000000011');

    expect(mockGet).toHaveBeenCalledWith(`${PREFIX}-nodes-000n00000000000011`);
  });

  it('legt einen Inhalt in einem eigenen Schlüsselraum ab', async () => {
    await new DataCache2(MOCK_ENVIRONMENT).get('content:00cn00000000000033');

    expect(mockGet).toHaveBeenCalledWith(
      `${PREFIX}-contents-00cn00000000000033`
    );
  });

  it('trennt dieselbe Id in alter und neuer Form', async () => {
    // Ein alter Deep-Link kann über beide Wege hereinkommen. Ohne eigenen Raum
    // bekäme der zweite Aufruf die Antwort des ersten — in der falschen Form.
    const cache = new DataCache2(MOCK_ENVIRONMENT);

    await cache.get('000s00000000000011');
    await cache.get('node:000s00000000000011');

    expect(mockGet).toHaveBeenCalledWith(
      `${PREFIX}-stories-000s00000000000011`
    );
    expect(mockGet).toHaveBeenCalledWith(`${PREFIX}-nodes-000s00000000000011`);
  });

  it('fragt keinen abgelösten Schlüssel ab — die Form ist neu', async () => {
    await new DataCache2(MOCK_ENVIRONMENT).get('node:000n00000000000011');

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('schreibt mit der regulären Lebensdauer', async () => {
    const value = { id: '000n00000000000011' };

    await new DataCache2(MOCK_ENVIRONMENT).set(
      'node:000n00000000000011',
      value
    );

    expect(mockSetEx).toHaveBeenCalledWith(
      `${PREFIX}-nodes-000n00000000000011`,
      MOCK_ENVIRONMENT.CACHE_CONTAINER_EXPIRATION_SECONDS,
      JSON.stringify(value)
    );
  });
});

describe('Cache Deletion', () => {
  beforeEach(() => {
    RedisConnector.mockClear();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockGet.mockClear();
    mockSetEx.mockClear();
    mockDel.mockClear();
    mockIsReady.mockClear();
    mockIsOpen.mockClear();
    valueIsReady = false;
  });

  it('should call RedisConnector.del with the correct key when "del" is called', async () => {
    const dataCache = new DataCache2(MOCK_ENVIRONMENT);

    const key = 'short-term-auth-state-testState';
    const expectedKey = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-${key}`;

    // const mockDel = jest.fn().mockResolvedValue(true);
    // dataCache.redis.del = mockDel;

    await dataCache.del(key);

    expect(mockDel).toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalledWith(expectedKey);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
