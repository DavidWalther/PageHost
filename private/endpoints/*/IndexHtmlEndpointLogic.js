const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');

const RELATIVE_FILE_PATH = '/private/endpoints/*';
const ABSOLUTE_FILE_PATH = __dirname;

class IndexHtmlEndpointLogic extends EndpointLogic {
  constructor() {
    super();
  }

  async execute() {
    const LOCATION = 'Server.IndexEndpoint.execute';

    Logging.debugMessage({severity:'INFO', message: 'Executing index logic', location: LOCATION});

    return new Promise((resolve) => {
      Logging.debugMessage({severity:'INFO', message: `Request received - ${this.requestObject.url}`, location: LOCATION});
      Logging.debugMessage({severity:'FINER', message: 'Executed index request', location: LOCATION});

//      let indexPath = ABSOLUTE_FILE_PATH.replace(RELATIVE_FILE_PATH, '') + '/public/index.html';




      //this.responseObject.sendFile(indexPath);

      let headerEntries = [];
      headerEntries.push('<meta charset="UTF-8">');
      headerEntries.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
      headerEntries.push('<link rel="manifest" href="manifest.json" />');
      headerEntries.push('<link rel="stylesheet" type="text/css" href="/assets/styles/salesforce-lightning-design-system.min.css" />');
      headerEntries.push('<link rel="stylesheet" type="text/css" href="/styles/darkmode.css"/>');

      headerEntries.push('<script src="index.js"></script>');

      headerEntries.push('<script type="module" src="components/global-header/global-header.js"></script>');
      headerEntries.push('<script type="module" src="components/custom-paragraph/custom-paragraph.js"></script>');
      headerEntries.push('<script type="module" src="components/custom-chapter/custom-chapter.js"></script>');
      headerEntries.push('<script type="module" src="components/custom-story/custom-story.js"></script>');

      headerEntries.push('<script type="module" src="slds-components/slds-toggle/toggle.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-input/slds-input.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-button-icon/slds-button-icon.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-card/slds-card.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-global-header/slds-global-header.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-panel/slds-panel.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-spinner/slds-spinner.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-toast/slds-toast.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-combobox/slds-combobox.js"></script>');
      headerEntries.push('<script type="module" src="slds-components/slds-modal/slds-modal.js"></script>');

      headerEntries.push('<script type="module" src="applications/bookstore/bookstore.js"></script>');

      let headPlaceholder = '\n' + headerEntries.join('\n') + '\n';
      
      const indexContent = `
      <!DOCTYPE html>
      <html class="dark-mode">
        <head>${headPlaceholder}</head>
        <body onload="initializeApp()"></body>  
      </html>
      `;

      // headPlaceholder will be replaced with the actual content 
      this.responseObject.send(indexContent);

      resolve();
    });
  }
}

module.exports = IndexHtmlEndpointLogic
