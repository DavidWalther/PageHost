const { ParagraphActions } = require('../database/paragraph.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const paragraphActions = new ParagraphActions(pgConnector);

const updateParagraph = async (paragraphId, paragraphData) => {
    
  paragraphActions.updateParagraph(paragraphId, paragraphData);

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

updateParagraph(paragraphData.id, paragraphData);
