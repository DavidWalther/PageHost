const { Logging } = require('../../../../public/modules/logging.js');
const { ActionGeneral } = require('./Action_General.js');

class ActionGet extends ActionGeneral{
  constructor() {
    super();
  }

  setKey(key) {
    if(!key) { return this; }
    this.key = key;
    return this;
  }

  async execute() {
    return new Promise((resolve, reject) => {
      if(!this.redisClient || !this.key) {
        reject('Redis connector and key are required');
      }

      let connectionData; // uses to store connection data
      let dataReturned; // uses to store data returned
      this.createConnection()
      .then(data => {
          connectionData = data;
          return this.redisClient.get(this.key);
      })
      .then(readData => {
        if(!connectionData.temporarilyConnected) {
          resolve(readData);
        } else {
          dataReturned = readData;
          return this.disconnect()
        }
      })
      .then(() => {
        resolve(dataReturned);
      });       
    });
  }

  createConnection() {
    return new Promise((resolve, reject) => {
      // readystate
      const readystate = this.redisClient.isReady;

      if(!readystate) {
        this.redisClient.connect()
        .then(() => {
          Logging.debugMessage({ severity: 'FINEST', message: 'Connection not ready ... temporarily connecting', location: 'RedisConnector.connect' });
          resolve({temporarilyConnected: true});
        });
      } else {
        Logging.debugMessage({ severity: 'FINEST', message: 'Already connected ... getting data', location: 'RedisConnector.connect' });
        resolve({temporarilyConnected: false});
      }
    });
  }
}

module.exports = { ActionGet };
/*


  async get(key) {
    const LOCATION = 'RedisConnector.get'

    Logging.debugMessage({ severity: 'FINEST', message: `Getting Key: ${key}`, location: LOCATION });
    return new Promise((resolve, reject) => {

      // readystate
      const readystate = this.redisClient.isReady;
      let returnedData;
      if(!readystate) {
        //console.log('RedisConnector.get - not ready ... temporarily connecting');
        Logging.debugMessage({ severity: 'FINEST', message: 'Connection not ready ... temporarily connecting', location: LOCATION });
        this.connect()
        .then(() => {
          //console.log('RedisConnector.get - getting data');
          Logging.debugMessage({ severity: 'FINEST', message: 'Getting data', location: LOCATION });
          this.redisClient.get(key)
          .then(data => {
            returnedData = data;
            //console.log('RedisConnector.get - resolve data');
            Logging.debugMessage({ severity: 'FINEST', message: 'Resolve data', location: LOCATION });
            //console.log('RedisConnector.get - closing temporary connection');
            Logging.debugMessage({ severity: 'FINEST', message: 'Closing temporary connection', location: LOCATION });
            this.disconnect()
            .then(() => {
              //console.log('RedisConnector.get - resolve data');
              Logging.debugMessage({ severity: 'FINEST', message: 'Resolve data', location: LOCATION });
              resolve(returnedData);
            });
          });
        });
      } else {
        //console.log('RedisConnector.get - already connected ... getting data');
        Logging.debugMessage({ severity: 'FINEST', message: 'Already connected ... getting data', location: LOCATION });
        this.redisClient.get(key)
        .then(data => {
          //console.log('RedisConnector.get - resolve data');
          Logging.debugMessage({ severity: 'FINEST', message: 'Resolve data', location: LOCATION });
          resolve(data);
        });
      }
    });
  }

*/