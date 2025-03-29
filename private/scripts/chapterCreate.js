const { ChapterActions } = require('../database/chapter.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const chapterActions = new ChapterActions(pgConnector);

const createChapter = async (chapterData) => {
    
    chapterActions.createChapter(chapterData);

    try {
       // await storyActions.createStory(storyData);
        console.log('Chapter created successfully.');
    } catch (error) {
        console.error('Error creating chapter:', error);
    }
}

const chapterData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  chapterData[lowercaseKey] = value;
});

createChapter(chapterData);
