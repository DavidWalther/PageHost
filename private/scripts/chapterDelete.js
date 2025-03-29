// private/scripts/deleteChapter.js
const { ChapterActions } = require('../database/chapter.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const chapterActions = new ChapterActions(pgConnector);

const deleteChapter = async (chapterId) => {
  try {
    await chapterActions.deleteChapter(chapterId);
    console.log(`Chapter with id ${chapterId} deleted successfully.`);
  } catch (error) {
    console.error('Error deleting Chapter:', error);
  }
};

const chapterData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  chapterData[lowercaseKey] = value;
});

deleteChapter(chapterData.id);
