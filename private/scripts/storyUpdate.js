const { StoryActions } = require('../database/story.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const storyActions = new StoryActions(pgConnector);

const updateStory = async (storyId, storyData) => {

    storyActions.updateStory(storyId, storyData);

    try {
       // await storyActions.createStory(storyData);
        console.log('Story updated successfully.');
    } catch (error) {
        console.error('Error updating story:', error);
    }
};


const storyData = {};
process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    const lowercaseKey = key.toLowerCase();
    storyData[lowercaseKey] = value;
});


updateStory(storyData.id, storyData);