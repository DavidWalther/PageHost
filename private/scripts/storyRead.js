const { StoryActions } = require('../database/story.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const storyActions = new StoryActions(pgConnector);

const storyData = {};
process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    const lowercaseKey = key.toLowerCase();
    storyData[lowercaseKey] = value;
});

storyActions.readStory(storyData).then(story => {
        console.log(story);
});
