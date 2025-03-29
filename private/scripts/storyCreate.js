// createStory.js
const { StoryActions } = require('../database/story.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const storyActions = new StoryActions(pgConnector);

const createStory = async (storyData) => {
    
    storyActions.createStory(storyData);

    try {
       // await storyActions.createStory(storyData);
        console.log('Story created successfully.');
    } catch (error) {
        console.error('Error creating story:', error);
    }
};


const storyData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  storyData[lowercaseKey] = value;
});

createStory(storyData);