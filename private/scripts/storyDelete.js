// private/scripts/deleteStory.js
const { StoryActions } = require('../database/story.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const storyActions = new StoryActions(pgConnector);

const deleteStory = async (storyId) => {
  try {
    await storyActions.deleteStory(storyId);
    console.log(`Story with id ${storyId} deleted successfully.`);
  } catch (error) {
    console.error('Error deleting story:', error);
  }
};

const storyData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  storyData[lowercaseKey] = value;
});

deleteStory(storyData.id);
