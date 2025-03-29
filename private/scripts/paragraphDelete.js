const { ParagraphActions } = require('../database/paragraph.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const paragraphActions = new ParagraphActions(pgConnector);

const deleteParagraph = async (paragraphId) => {
  try {
    await paragraphActions.deleteParagraph(paragraphId);
    console.log(`Paragraph with id ${paragraphId} deleted successfully.`);
  } catch (error) {
    console.error('Error deleting Paragraph:', error);
  }
};

const paragraphData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  paragraphData[lowercaseKey] = value;
});

deleteParagraph(paragraphData.id);
