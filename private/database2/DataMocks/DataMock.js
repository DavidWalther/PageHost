const { DataMockBuilder } = require("./DataMockBuilder");
const { Environment } = require("../../modules/environment");
const fs = require('fs');
const path = require('path');

const LOREM_IPSUM_ARRAY = [
  'Sint ullamco amet anim est ea sunt do. Culpa quis ea consectetur nostrud est non sunt qui sint laboris. Tempor ad laboris ipsum amet. Aute sint sint reprehenderit excepteur aliquip tempor deserunt dolore ex reprehenderit velit pariatur. Quis do consequat dolore sunt nulla quis id aliqua ut quis tempor. Anim aliquip ea sit culpa consequat. Elit sint eiusmod nostrud ipsum proident anim veniam laborum id nulla fugiat magna pariatur.',
  'Nulla nulla ea aliquip dolor tempor dolore. Consectetur sint do cupidatat aliqua aute dolor ipsum veniam. Culpa dolor tempor cillum deserunt nulla laboris do.',
  'Adipisicing est cupidatat adipisicing nisi nostrud amet id velit adipisicing nulla amet irure. Sit qui pariatur cillum sunt. Amet ea Lorem eu aliqua ullamco irure duis nisi commodo fugiat mollit dolor consectetur eiusmod. Consequat nostrud amet tempor eiusmod adipisicing ea adipisicing id proident sunt exercitation labore.',
  'Incididunt voluptate cillum ipsum mollit consectetur veniam. Reprehenderit voluptate duis dolore qui est. Nisi amet est tempor culpa veniam minim. Voluptate culpa exercitation minim dolore non incididunt. Adipisicing cillum culpa ea officia proident quis laborum consectetur eu pariatur eiusmod aliquip anim.',
  'Enim sunt voluptate tempor irure sunt mollit do eiusmod ex eiusmod. Labore eiusmod nulla nostrud adipisicing sunt. Enim culpa adipisicing id qui proident. Labore amet incididunt do labore aliquip. Irure mollit adipisicing qui tempor excepteur quis.',
  'Ea nisi ex excepteur culpa nisi adipisicing non Lorem pariatur exercitation tempor qui exercitation. Veniam velit fugiat sint ad id incididunt voluptate quis. Proident reprehenderit laborum esse labore deserunt eu.',
]

const MOCK_CONFIGURATION_MAP = new Map([
  ['metaTitle', 'Mock Tabtitle'],
  ['pageHeaderHeadline', 'Mock Headline'],
  ['pageSidebarTitle', 'Mock Contents']
]);

class DataMock {
  constructor() {}

  createConfiguration() {
    const LOCATION = 'DataMock.createMockConfiguration';
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, '../tables/mocks/configuration.json');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          let loadedConfiguration = JSON.parse(data);
          let collapsedConfiguration = loadedConfiguration.reduce((acc, config) => {
            acc[config.key] = config.value;
            return acc;
          }, {});
          resolve(collapsedConfiguration);
        }
      });
    });
  }

  getAllStories() {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, '../tables/mocks/story.json');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
  }

  getStoryById(storyId) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, '../tables/mocks/story.json');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          const stories = JSON.parse(data);
          const story = stories.find(story => story.id === storyId);
          if (story) {
            resolve(story);
          } else {
            reject(new Error('Story not found'));
          }
        }
      });
    });
  }

  getChapterById(chapterId) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, '../tables/mocks/chapter.json');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          const chapters = JSON.parse(data);
          const chapter = chapters.find(chapter => chapter.id === chapterId);
          if (chapter) {
            resolve(chapter);
          } else {
            reject(new Error('Chapter not found'));
          }
        }
      });
    });
  }

  getParagraphById(paragraphId) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, '../tables/mocks/paragraph.json');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          const paragraphs = JSON.parse(data);
          const paragraph = paragraphs.find(paragraph => paragraph.id === paragraphId);
          if (paragraph) {
            resolve(paragraph);
          } else {
            reject(new Error('Paragraph not found'));
          }
        }
      });
    });
  }
}

module.exports = { DataMock };
