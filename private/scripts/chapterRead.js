const { ChapterActions } = require('../database/chapter.js');
const { PostgresActions } = require('../database/pgConnector.js');

const pgConnector = new PostgresActions();
const chapterActions = new ChapterActions(pgConnector);

const paragraphData = {};
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  const lowercaseKey = key.toLowerCase();
  paragraphData[lowercaseKey] = value;
});

chapterActions.readChapter(paragraphData).then(chapter => {
    console.log(chapter);
});
