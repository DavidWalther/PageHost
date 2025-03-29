const redis = require('redis');
const { RedisConnector } = require('../RedisConnector');
const { Logging } = require('../../../modules/logging.js');

const MOCK_ENVIRONMENT = {
  APPLICATION_APPLICATION_KEY: 'testKey',
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  REDIS_PASSWORD: 'test-password',
  REDIS_HOST: 'test-host',
  REDIS_PORT: 'test-port'
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
  } );

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
