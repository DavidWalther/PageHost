const { ParagraphActions } = require('../database/paragraph.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const paragraphActions = new ParagraphActions(pgConnector);

const paragraphData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  paragraphData[lowercaseKey] = value;
});

paragraphActions.readParagraph(paragraphData).then(paragraph => {
  console.log(paragraph);
});
