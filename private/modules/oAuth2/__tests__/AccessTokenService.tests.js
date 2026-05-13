const {Environment}= require('../../environment.js');
const AccessTokenService = require('../AccessTokenService.js');
const JwtService = require('../JwtService.js');

jest.mock('../../../modules/logging.js');
jest.mock('../../environment.js');
jest.mock('../JwtService.js');

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

  describe('createJwt', () => {
    const userInfo = { email: 'test@mail.com' };
    const scopes = ['edit', 'create', 'delete', 'publish'];

    beforeEach(() => {
      JwtService.createJwt = jest.fn().mockReturnValue('mocked-jwt-token');
    });

    it('should call JwtService.createJwt with correct parameters and default lifetime', () => {
      const token = accessTokenService.createJwt(userInfo, scopes);
      expect(JwtService.createJwt).toHaveBeenCalledWith(userInfo.email, 'google', scopes, serverSecret, 900);
      expect(token).toBe('mocked-jwt-token');
    });

    it('should use AUTH_JWT_LIFETIME_SECONDS from environment when set', () => {
      accessTokenService.setEnvironment({ AUTH_SERVER_SECRET: serverSecret, AUTH_JWT_LIFETIME_SECONDS: '3600' });
      accessTokenService.createJwt(userInfo, scopes);
      expect(JwtService.createJwt).toHaveBeenCalledWith(userInfo.email, 'google', scopes, serverSecret, 3600);
    });

    it('should fall back to default lifetime when AUTH_JWT_LIFETIME_SECONDS is not a valid number', () => {
      accessTokenService.setEnvironment({ AUTH_SERVER_SECRET: serverSecret, AUTH_JWT_LIFETIME_SECONDS: 'invalid' });
      accessTokenService.createJwt(userInfo, scopes);
      expect(JwtService.createJwt).toHaveBeenCalledWith(userInfo.email, 'google', scopes, serverSecret, 900);
    });

    it('should throw an error when userInfo is missing', () => {
      expect(() => accessTokenService.createJwt(null, scopes)).toThrow('User information is missing');
    });

    it('should throw an error when AUTH_SERVER_SECRET is not set', () => {
      accessTokenService.setEnvironment({ AUTH_SERVER_SECRET: null });
      expect(() => accessTokenService.createJwt(userInfo, scopes)).toThrow('No server secret provided');
    });
  });
});
