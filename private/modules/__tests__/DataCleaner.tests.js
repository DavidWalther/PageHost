const { DataCleaner } = require('../DataCleaner');

const MOCK_ENVIRONMENT = {
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
};

describe('DataCleaner', () => {
  beforeEach(() => {
    process.env = MOCK_ENVIRONMENT;
  });

  it('should remove application keys from an object', () => {
    const dataCleaner = new DataCleaner();
    const input = {
      applicationincluded: 'value1',
      applicationexcluded: 'value2',
      application: 'value3',
      otherKey: 'value4'
    };
    const expectedOutput = {
      otherKey: 'value4'
    };

    dataCleaner.removeApplicationKeys(input);
    expect(input).toEqual(expectedOutput);
  });

  it('should remove application keys from all objects in an array', () => {
    const dataCleaner = new DataCleaner();
    const input = [
      {
        applicationincluded: 'value1',
        applicationexcluded: 'value2',
        application: 'value3',
        otherKey: 'value4'
      },
      {
        applicationincluded: 'value5',
        applicationexcluded: 'value6',
        application: 'value7',
        otherKey: 'value8'
      }
    ];
    const expectedOutput = [
      {
        otherKey: 'value4'
      },
      {
        otherKey: 'value8'
      }
    ];

    dataCleaner.removeApplicationKeys(input);
    expect(input).toEqual(expectedOutput);
  });
});
