const { Logging } = require('../../../modules/logging.js');
const { DataCache2 } = require('../../../database2/DataCache/DataCache.js');
const {Environment}= require('../../environment.js');
const AccessTokenService = require('../AccessTokenService.js');
const crypto = require('crypto');

jest.mock('../../../modules/logging.js');
jest.mock('../../../database2/DataCache/DataCache.js');
jest.mock('../../environment.js');

let mockCacheSet = jest.fn();
let mockCacheGet = jest.fn();
let mockCacheDel = jest.fn();
DataCache2.mockImplementation(() => {
  return {
    set: mockCacheSet,
    get: mockCacheGet,
    del: mockCacheDel,
  }
});

let mockGetEnvironment = jest.fn();
Environment.mockImplementation(() => {
  return {
    getEnvironment: mockGetEnvironment,
  }
});

const serverSecret = 'secret';

describe('AccessTokenService', () => {
  let accessTokenService;

  beforeEach(() => {
    const mockedEnvironment = new Environment();
    mockedEnvironment.getEnvironment = jest.fn().mockReturnValue({
      AUTH_SERVER_SECRET: serverSecret,
    });

    accessTokenService = new AccessTokenService();
    accessTokenService.setEnvironment(mockedEnvironment.getEnvironment());
  });

  describe('createBearer', () => {
    it('should create a Bearer from userInfo, scopes and environment variable', async () => {
      let testUserInfo = {
        email: 'test@mail.com',
        iss: 'https://accounts.google.com',
        aud: 'test-client-id'
      };
      let testScopes = ['edit', 'create', 'delete', 'publish']; // these are hardcoded (for the time being)

      const bearerToken = await accessTokenService.createBearer(testUserInfo);
      const expectedHashKey = 'mid-term-bearer-token-' + bearerToken;
      expect(mockCacheSet).toHaveBeenCalledWith(expectedHashKey, { userInfo: testUserInfo, scopes: testScopes });
    });

    it('should reject promise when no userInfo is provided', async () => {
      accessTokenService.createBearer().then(() => {
        expect(mockCacheSet).not.toHaveBeenCalled();
      }).
      catch((error) => {
        expect(error).toBe('User information is missing');
      });
    });
  });

  describe('isBearerValidFromScope', () => {
    const bearerToken = 'testBearerToken';
    const cacheKey = `mid-term-bearer-token-${bearerToken}`;
    const userInfo = {
      email: 'test@mail.com',
      iss: 'https://accounts.google.com',
      aud: 'test-client-id',
    };
    const validScopes = ['edit'];
    const invalidScopes = ['delete'];

    beforeEach(() => {
      mockCacheGet.mockReset();
    });

    it('should return true when all criteria are fulfilled', async () => {
      mockCacheGet.mockResolvedValue({ userInfo, scopes: validScopes });

      const result = await accessTokenService.isBearerValidFromScope(bearerToken, ['edit']);
      expect(result).toBe(true);
      expect(mockCacheGet).toHaveBeenCalledWith(cacheKey);
    });

    it('should return false when the cache key is missing', async () => {
      mockCacheGet.mockResolvedValue(null);

      const result = await accessTokenService.isBearerValidFromScope(bearerToken, ['edit']);
      expect(result).toBe(false);
      expect(mockCacheGet).toHaveBeenCalledWith(cacheKey);
    });

    it('should return false when the user does not have the requested scope', async () => {
      mockCacheGet.mockResolvedValue({ userInfo, scopes: validScopes });

      const result = await accessTokenService.isBearerValidFromScope(bearerToken, invalidScopes);
      expect(result).toBe(false);
      expect(mockCacheGet).toHaveBeenCalledWith(cacheKey);
    });

    it('should return false when the bearer was not created for the requested scope', async () => {
      const scopesCreatedForBearer = ['edit'];
      mockCacheGet.mockResolvedValue({ userInfo, scopes: scopesCreatedForBearer });

      const result = await accessTokenService.isBearerValidFromScope(bearerToken, ['delete']);
      expect(result).toBe(false);
      expect(mockCacheGet).toHaveBeenCalledWith(cacheKey);
    });
  });
});
