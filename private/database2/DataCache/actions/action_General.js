const redis = require('redis');
const { Logging } = require('../../../../public/modules/logging.js');

class ActionGeneral {

  constructor() {}

  setRedisClient(redisClient) {
    if(!redisClient) { return this; }
    this.redisClient = redisClient;
    return this;
  }

  async connect() {
    return new Promise((resolve) => {
      
      Logging.debugMessage({ severity: 'FINEST', message: 'RedisConnector.connecting', location: 'RedisConnector.connect' });
      this.redisClient.connect()
      .then(() => {

        // console.log('RedisConnector.connected');
        Logging.debugMessage({ severity: 'FINEST', message: 'RedisConnector.connected', location: 'RedisConnector.connect' });
        resolve();
      });
    });
  }

  async disconnect() {
    return new Promise((resolve) => {
      //console.log('RedisConnector.disconnecting');
      Logging.debugMessage({ severity: 'FINEST', message: 'RedisConnector.disconnecting', location: 'RedisConnector.disconnect' });
      this.redisClient.disconnect()
      .then(() => {
        //console.log('RedisConnector.disconnected');
        Logging.debugMessage({ severity: 'FINEST', message: 'RedisConnector.disconnected', location: 'RedisConnector.disconnect' });
        resolve();
      });
    });
  }
}

module.exports = { ActionGeneral };