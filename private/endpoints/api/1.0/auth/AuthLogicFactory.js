const { Logging } = require('../../../../modules/logging.js');
const CodeExchangeEndpoint = require('./oAuth2/CodeExchangeEndpoint.js');
const RequestAuthStateEndpoint = require('./oAuth2/requestAuthStateEndpoint.js');
const LogoutEndpoint = require('./LogoutEndpoint.js');

class AuthLogicFactory {
  static getProduct(requestObject) {
    let LOCATION = 'Server.AuthLogicFactory.getProduct';
    const url = requestObject.url;
    Logging.debugMessage({severity:'INFO', message: `Url: ${url}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Params: ${JSON.stringify(requestObject.params)}`, location: LOCATION });
    Logging.debugMessage({severity:'FINE', message: `Query: ${JSON.stringify(requestObject.query)}`, location: LOCATION });



    let isRequestAuthState = url.endsWith('/oAuth2/requestAuthState');
    let isCodeExchange = url.endsWith('/oAuth2/codeexchange');
    let isLogout = url.endsWith('/logout');

    if (isRequestAuthState) {
      return new RequestAuthStateEndpoint();
    }
    if (isCodeExchange) {
      return new CodeExchangeEndpoint();
    }
    if (isLogout) {
      return new LogoutEndpoint();
    }

    // no match found
    Logging.debugMessage({severity:'FINE', message: `No matching endpoint found`, location: LOCATION });
    throw new Error(`Unknown auth endpoint for URL: ${url}`);

    /*
    const authAction = requestObject.params[1].toLowerCase();

    switch (authAction) {
      case 'codeexchange':
        return new CodeExchangeEndpoint();
      case 'requestAuthState':
        return new RequestAuthStateEndpoint();
      case 'logout':
        return new LogoutEndpoint();
      default:
        throw new Error(`Unknown auth action: ${authAction}`);
    }
    */
  }
}

module.exports = AuthLogicFactory;
