const { Logging } = require('./logging.js');

class DataCleaner {
  constructor() {}

  removeApplicationKeys(param) {
    if(Array.isArray(param)) {
      this.removeApplicationKeysFromList(param);
    } else {
      this.removeApplicationKeysFromObject(param);
    }

    return this;
  }

  removeApplicationKeysFromObject(record) {
    const LOCATION = 'DataCleaner.removeApplicationKeysFromObject';

    if(!record) {return this;}
    Logging.debugMessage({severity: 'FINEST', message: 'Removing application keys', location: LOCATION});
    const keysToRemove = ['applicationIncluded', 'applicationExcluded', 'application', 'manifest']
      .map(key => key.toLowerCase());
    let removeKeySet = new Set(keysToRemove);

    keysToRemove.forEach(key => {
      Object.keys(record).forEach(key => {
        let lowercasedKey = key.toLowerCase();
        if(removeKeySet.has(lowercasedKey)) {
          Logging.debugMessage({severity: 'FINEST', message: `Removing key: ${lowercasedKey}`, location: LOCATION});
          delete record[key];
        }
      });
    });

    return this;
  }

  removeApplicationKeysFromList(list) {
    const LOCATION = 'DataCleaner.removeApplicationKeysFromList';

    if(!list) {return this;}

    Logging.debugMessage({severity: 'FINEST', message: 'Removing application keys from list', location: LOCATION});
    list.forEach(record => {
      this.removeApplicationKeys(record); // <=== Recursion
    });

    return this;
  }
}

module.exports = { DataCleaner };