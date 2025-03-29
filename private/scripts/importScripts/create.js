const { ParagraphActions } = require('../../database/paragraph.js');
const { ChapterActions } = require('../../database/chapter.js');
const { StoryActions } = require('../../database/story.js');
const { PostgresActions } = require('../../database/pgConnector.js');
let argv = require('minimist')(process.argv.slice(2));

// ==============
// Definitions
// ==============

class ActionLogic {
  constructor(pgConnector) {
    this.pgConnector = pgConnector;
  }

  async execute(operation, tableName, recordData) {
    switch (operation.toLowerCase()) {
      case 'create': {
        this.create(tableName, recordData);
        break;
      }
      // case 'update': {
      //   this.update(tableName, recordData);
      //   break;
      // }
      default: {
        console.error('Invalid operation');
        process.exit(1);
      }
    }
  }

  async create(tableName, recordData) {
    switch (tableName.toLowerCase()) {
      case 'paragraph': {
        this.createParagraph(recordData);
        break;
      }
      // case 'chapter': {
      //   this.createChapter(recordData);
      //   break;
      // }
      // case 'story': {
      //   this.createStory(recordData);
      //   break;
      // }
      default: {
        console.error('Invalid table name');
        process.exit(1);
      }
    }
  }

  async createParagraph(contentData) {
    this.paragraphActions = new ParagraphActions(this.pgConnector);
    try {
      console.log('Creating paragraph...');
      // remove key 'table' from object
      delete contentData.table;
      this.paragraphActions.createParagraph(contentData);
      console.log('Paragraph created successfully.');
    } catch (error) {
      console.error('Error creating paragraph:', error);
    }
  }
}

class ContentActions {
  constructor() {
    this.pgConnector = new PostgresActions();
  }

  /**
   * method 'execute' reads the 'operation' parameter and calls the respective method
   */
  async execute(contentData) {
    // remove key '_'
    delete contentData._;
    const operation = contentData.operation;

    switch (operation.toLowerCase()) {
      case 'create': {
        // remove key 'operation' from object
        delete argv.operation;
        this.create(contentData);
        break;
      }
      case 'update': {
        // remove key 'operation' from object
        delete argv.operation;
        this.update(contentData);
        break;
      }
      default: {
        console.error('Invalid operation');
        process.exit(1);
      }
    }
  }

  getContentData() {
    return argv;
  }

  async create(contentData) {
    switch (contentData.table.toLowerCase()) {
      case 'paragraph': {
        delete contentData.table;
        this.createParagraph(contentData);
        break;
      }
      case 'chapter': {
        delete contentData.table;
        this.createChapter(contentData);
        break;
      }
      case 'story': {
        delete contentData.table;
        this.createStory(contentData);
        break;
      }
      default: {
        console.error('Invalid table name');
        process.exit(1);
      }
    }
  }

  async createParagraph(contentData) {
    this.paragraphActions = new ParagraphActions(this.pgConnector);
    try {
      console.log('Creating paragraph...');
      // remove key 'table' from object
      delete contentData.table;
      this.paragraphActions.createParagraph(contentData);
      console.log('Paragraph created successfully.');
    } catch (error) {
      console.error('Error creating paragraph:', error);
    }
  }

  async createChapter(contentData) {
    this.chapterActions = new ChapterActions(this.pgConnector);
    try {
      console.log('Creating chapter...');
      // remove key 'table' from object
      delete contentData.table;
      this.chapterActions.createChapter(contentData);
      console.log('Chapter created successfully.');
    } catch (error) {
      console.error('Error creating chapter:', error);
    }
  }

  async createStory(contentData) {
    this.storyActions = new StoryActions(this.pgConnector);
    try {
      console.log('Creating story...');
      // remove key 'table' from object
      delete contentData.table;
      this.storyActions.createStory(contentData);
      console.log('Story created successfully.');
    } catch (error) {
      console.error('Error creating story:', error);
    }
  }

  async update(contentData) {
    // remove key '_'
    delete contentData._;

    if (!contentData.id) {
      console.error('an update operation requires an id.');
      process.exit(1);
    }
    let recordId = contentData.id;
    delete contentData.id;

    switch (contentData.table.toLowerCase()) {
      case 'paragraph': {
        // remove key 'table' from object
        delete contentData.table;
        this.updateParagraph(recordId, contentData);
        break;
      }
      case 'chapter': {
        // remove key 'table' from object
        delete contentData.table;
        this.updateChapter(contentData);
        break;
      }
      case 'story': {
        // remove key 'table' from object
        delete contentData.table;
        this.updateStory(contentData);
        break;
      }
      default: {
        console.error('Invalid table name');
        process.exit(1);
      }
    }
  }

  async updateParagraph(recordId, contentData) {
    this.paragraphActions = new ParagraphActions(this.pgConnector);
    try {
      console.log('Updating paragraph...');      
      console.table(contentData);
      this.paragraphActions.updateParagraph(recordId, contentData);
      console.log('Paragraph updated successfully.');
    } catch (error) {
      console.error('Error updating paragraph:', error);
    }
  }
}

module.exports = { ContentActions, ActionLogic };

async function createContent() {
  const actions = new ContentActions();
  let contentData = actions.getContentData();
  await actions.execute(contentData);
}

// ==============
// Main
// ==============

//createContent();
