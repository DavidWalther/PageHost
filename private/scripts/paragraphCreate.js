const { ParagraphActions } = require('../database/paragraph.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const paragraphActions = new ParagraphActions(pgConnector);

const createParagraph = async (paragraphData) => {
  
  paragraphActions.createParagraph(paragraphData);

  try {
     // await storyActions.createStory(storyData);
    console.log('Paragraph created successfully.');
  } catch (error) {
    console.error('Error creating paragraph:', error);
  }
}

const paragraphData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  paragraphData[lowercaseKey] = value;
});

createParagraph(paragraphData);
