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
  REDIS_PORT: 'test-port'
};
//const mockConnect =  () => { return new Promise((resolve) => {resolve()}) };

let MOCK_GET_VALUE = {key: 'value'};
let mockConnect = jest.fn().mockImplementation(() => {
  return new Promise((resolve, reject) => {
      if(valueIsReady) {
        reject('Already connected');
      }
      valueIsReady = true;
      resolve()
    })
  });

let mockDisconnect = jest.fn().mockImplementation(() => {
  return new Promise((resolve, reject) => {
    if(!valueIsReady) {
      reject('Not connected');
    }
    valueIsReady = false;
    resolve()
  })
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
    isOpen: mockIsOpen
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

  it('the connection should be opened implicitly when calling \'get()\'', async () => {
    expect(RedisConnector).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();

    const dataCache = new DataCache2(MOCK_ENVIRONMENT);
    expect(RedisConnector).toHaveBeenCalled();

    await dataCache.get('metadata');
    expect(mockConnect).toHaveBeenCalled();
  });

  it('the connection should be closed implicitly when calling \'get()\'', async () => {
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

  it('should call RedisConnector.setEx with the correct key when "metadata" is set', async () => {
    const dataCache = new DataCache2(MOCK_ENVIRONMENT);

    const key = 'metadata';
    const value = {key: 'value'};
    const expectedKey = `${MOCK_ENVIRONMENT.CACHE_KEY_PREFIX}-${MOCK_ENVIRONMENT.APPLICATION_APPLICATION_KEY}-${MOCK_ENVIRONMENT.CACHE_DATA_INCREMENT}-metadata`;

    let setPromise = dataCache.set(key, value);
    expect(setPromise).toBeInstanceOf(Promise);

    await setPromise;
    expect(mockSetEx).toHaveBeenCalled();
    expect(mockSetEx).toHaveBeenCalledWith(expectedKey, MOCK_ENVIRONMENT.CACHE_CONTAINER_EXPIRATION_SECONDS, JSON.stringify(value));
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
