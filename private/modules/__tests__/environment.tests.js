const fs = require('fs');
const { Environment } = require('../environment.js');

jest.mock('fs');

describe('Environment', () => {
  beforeEach(() => {
    const mockEnv = {
      APPLICATION_APPLICATION_KEY: 'test-key',
      PORT: '3000',
      var1: 'test',
    };
    process.env = mockEnv;

    jest.resetModules();

  });

  it('should read environment variables from process.env', () => {
    const mockEnv = {
      APPLICATION_APPLICATION_KEY: 'test-key',
      PORT: '3000',
      var1: 'test',
    };

    const environment = new Environment();
    // expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(environment.getEnvironment()).toEqual(mockEnv);
  });

  it('should be immutable', () => {
    const environment = new Environment();
    let envObj = environment.getEnvironment();
    envObj.var1 = 'new value';
    expect(environment.getEnvironment().var1).toEqual('test');
  });

  it('should accept an object as constructor parameter to emulate a separate environment', () => {
    const mockEnv = {
      APPLICATION_APPLICATION_KEY: 'testkey',
      PORT: '7000',
      var1: 'testVal',
    };

    const environment = new Environment(mockEnv);
    // expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(environment.getEnvironment()).toEqual(mockEnv);
  });
});
