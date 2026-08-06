const { Logging } = require('../modules/logging');
const { FallbackEndpoint } = require('./data/query/FallbackEndpoint');
const { TypeFreeQueryEndpoint } = require('./data/query/TypeFreeQueryEndpoint');

class DataQueryLogicFactory {
  static getProduct(requestObject) {
    let LOCATION = 'Server.DataQueryLogicFactory.getProduct';
    const url = requestObject.url;
    Logging.debugMessage({
      severity: 'INFO',
      message: `Url: ${url}`,
      location: LOCATION,
    });
    Logging.debugMessage({
      severity: 'FINE',
      message: `Params: ${JSON.stringify(requestObject.params)}`,
      location: LOCATION,
    });
    Logging.debugMessage({
      severity: 'FINE',
      message: `Query: ${JSON.stringify(requestObject.query)}`,
      location: LOCATION,
    });
    const query = requestObject.params[0];
    const postgresTable = query.split('/')[0].toLowerCase();

    switch (postgresTable) {
      case 'node':
      case 'content':
        return new TypeFreeQueryEndpoint(postgresTable);
      default:
        // Hier standen bis zum Abschluss der Umstellung `story`, `chapter` und
        // `paragraph`. Sie sind mit dem alten Datenmodell weggefallen; ein
        // Aufruf landet jetzt im Fallback wie jeder andere unbekannte Name.
        return new FallbackEndpoint();
    }
  }
}

module.exports = { DataQueryLogicFactory };
