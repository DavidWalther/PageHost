const { DataMock } = require('../DataMock');
const fs = require('fs');
const path = require('path');

jest.mock('../../../modules/environment');
jest.mock('fs');

describe('DataMock', () => {

  it('can be instantiated', () => {
    const dataMock = new DataMock();
    expect(dataMock).toBeInstanceOf(DataMock);
  });

  describe('createMockConfiguration', () => {
    it('should return a configuration object from the JSON file', async () => {
      const mockFilePath = path.join(__dirname, '../../tables/mocks/configuration.json');
      const mockData = [
        {
          "id": "000m00000000000001",
          "key": "metaTitle",
          "value": "Mock Tabtitle",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        },
        {
          "id": "000m00000000000002",
          "key": "pageHeaderHeadline",
          "value": "Mock Headline",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        },
        {
          "id": "000m00000000000003",
          "key": "pageSidebarTitle",
          "value": "Mock Contents",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        }
      ];

      fs.readFile.mockImplementation((filePath, encoding, callback) => {
        if (filePath === mockFilePath) {
          callback(null, JSON.stringify(mockData));
        } else {
          callback(new Error('File not found'));
        }
      });

      const dataMock = new DataMock();
      const configuration = await dataMock.createConfiguration();

      expect(configuration.metaTitle).toEqual('Mock Tabtitle');
      expect(configuration.pageHeaderHeadline).toEqual('Mock Headline');
      expect(configuration.pageSidebarTitle).toEqual('Mock Contents');
    });
  });

  describe('getAllStories', () => {
    it('should return all stories from the JSON file', async () => {
      const mockFilePath = path.join(__dirname, '../../tables/mocks/story.json');
      const mockData = [
        {
          "id": "000s00000000000001",
          "name": "Mock Story 1",
          "lastupdate": "2022-01-01 00:00:00",
          "sortnumber": 1,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        },
        {
          "id": "000s00000000000002",
          "name": "Mock Story 2",
          "lastupdate": "2022-01-01 00:00:00",
          "sortnumber": 2,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        },
        {
          "id": "000s00000000000003",
          "name": "Mock Story 3",
          "lastupdate": "2022-01-01 00:00:00",
          "sortnumber": 3,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        }
      ];

      fs.readFile.mockImplementation((filePath, encoding, callback) => {
        if (filePath === mockFilePath) {
          callback(null, JSON.stringify(mockData));
        } else {
          callback(new Error('File not found'));
        }
      });

      const dataMock = new DataMock();
      const stories = await dataMock.getAllStories();

      expect(stories).toEqual(mockData);
    });
  });

  describe('getStoryById', () => {
    it('should return the proper story by its ID from the JSON file', async () => {
      const mockFilePath = path.join(__dirname, '../../tables/mocks/story.json');
      const mockData = [
        {
          "id": "000s00000000000001",
          "name": "Mock Story 1",
          "lastupdate": "2022-01-01 00:00:00",
          "sortnumber": 1,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        },
        {
          "id": "000s00000000000002",
          "name": "Mock Story 2",
          "lastupdate": "2022-01-01 00:00:00",
          "sortnumber": 2,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        },
        {
          "id": "000s00000000000003",
          "name": "Mock Story 3",
          "lastupdate": "2022-01-01 00:00:00",
          "sortnumber": 3,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        }
      ];

      fs.readFile.mockImplementation((filePath, encoding, callback) => {
        if (filePath === mockFilePath) {
          callback(null, JSON.stringify(mockData));
        } else {
          callback(new Error('File not found'));
        }
      });

      const dataMock = new DataMock();
      const story = await dataMock.getStoryById("000s00000000000002");

      expect(story).toEqual(mockData[1]);
    });
  });

  describe('getChapterById', () => {
    it('should return the proper chapter by its ID with child paragraphs head data from the JSON file', async () => {
      const mockFilePath = path.join(__dirname, '../../tables/mocks/chapter.json');
      const mockData = [
        {
          "id": "000c00000000000001",
          "storyid": "000s00000000000011",
          "name": "Mock Chapter 1 for Story 1",
          "lastupdate": "2022-01-01 00:00:00",
          "sortnumber": 1,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3",
          "paragraphs": [
            { "id": "000p00000000000001", "name": "Mock Paragraph 1 for Chapter 1 of Story 1", "sortnumber": 1 },
            { "id": "000p00000000000002", "name": "Mock Paragraph 2 for Chapter 1 of Story 1", "sortnumber": 2 },
            { "id": "000p00000000000003", "name": "Mock Paragraph 3 for Chapter 1 of Story 1", "sortnumber": 3 }
          ]
        },
        // ...other chapters...
      ];

      fs.readFile.mockImplementation((filePath, encoding, callback) => {
        if (filePath === mockFilePath) {
          callback(null, JSON.stringify(mockData));
        } else {
          callback(new Error('File not found'));
        }
      });

      const dataMock = new DataMock();
      const chapter = await dataMock.getChapterById("000c00000000000001");

      expect(chapter).toEqual(mockData[0]);
      expect(chapter.paragraphs).toBeDefined();
      expect(chapter.paragraphs.length).toBeGreaterThan(0);
    });
  });

  describe('getParagraphById', () => {
    it('should return the proper paragraph by its ID from the JSON file', async () => {
      const mockFilePath = path.join(__dirname, '../../tables/mocks/paragraph.json');
      const mockData = [
        {
          "id": "000p00000000000001",
          "chapterid": "000c00000000000001",
          "storyid": "000s00000000000011",
          "name": "Mock Paragraph 1 for Chapter 1 of Story 1",
          "lastupdate": "2022-01-01 00:00:00",
          "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
          "htmlcontent": "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>",
          "sortnumber": 1,
          "publishdate": "2022-01-01 00:00:00",
          "applicationincluded": "app1, app2",
          "applicationexcluded": "app3"
        },
        // ...other paragraphs...
      ];

      fs.readFile.mockImplementation((filePath, encoding, callback) => {
        if (filePath === mockFilePath) {
          callback(null, JSON.stringify(mockData));
        } else {
          callback(new Error('File not found'));
        }
      });

      const dataMock = new DataMock();
      const paragraph = await dataMock.getParagraphById("000p00000000000001");

      expect(paragraph).toEqual(mockData[0]);
    });
  });
});
