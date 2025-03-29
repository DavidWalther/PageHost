const { Logging } = require('../modules/logging');
const { AllStoriesEndpoint } = require('./data/query/AllStoriesEndpoint');
const { SingleStoryEndpoint } = require('./data/query/SingleStoryEndpoint');
const { ChapterEndpoint } = require('./data/query/ChapterEndpoint');
const { ParagraphEndpoint } = require('./data/query/ParagraphEndpoint');
const { FallbackEndpoint } = require('./data/query/FallbackEndpoint');

class DataQueryLogicFactory {
  static getProduct(requestObject) {
    let LOCATION = 'Server.DataQueryLogicFactory.getProduct';
    const url = requestObject.url;
    Logging.debugMessage({severity:'INFO', message: `Url: ${url}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Params: ${JSON.stringify(requestObject.params)}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Query: ${JSON.stringify(requestObject.query)}`, location: LOCATION });
    const query = requestObject.params[0];
    const postgresTable = query.split('/')[0].toLowerCase();

    switch (postgresTable) {
      case 'story':
        if (requestObject.query.id) {
          return new SingleStoryEndpoint();
        } else {
          return new AllStoriesEndpoint();
        }
      case 'chapter':
        return new ChapterEndpoint();
      case 'paragraph':
        return new ParagraphEndpoint();
      default:
        return new FallbackEndpoint();
    }
  }
}

module.exports = { DataQueryLogicFactory };
