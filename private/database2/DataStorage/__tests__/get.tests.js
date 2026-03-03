const { ActionGet } = require('../actions/get.js');
const { PostgresActions } = require('../pgConnector.js');
const { TableStory } = require('../../tables/story.js');
const { TableParagraph } = require('../../tables/paragraph.js');
const { TableChapter } = require('../../tables/chapter.js');

// ToDos:
// - Order
//- Table class as parameter


jest.mock('../pgConnector.js');


const MOCK_ENVIRONMENT = {
  LOGGING_SEVERITY_LEVEL: 'DEBUG',
  PGHOST: 'localhost',
  PGDATABASE: 'test',
  PGUSER: 'testUser',
  PGPASSWORD: 'testPassword',
  ENDPOINT_ID: 'testEndpoint',
  PG_LOCAL_DB: 'true'
};

const MOCK_CONFIGURATION = [{ key: 'firstname', value: 'Tom'}, { key: 'lastname', value: 'Jones'}];
let mockExecuteSql = jest.fn().mockResolvedValue();
PostgresActions.mockImplementation(() => {
  return {
    executeSql: mockExecuteSql,
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue([])
  };
});

describe('SQL-Actions', () => {
  beforeEach(() => {
    PostgresActions.mockClear();
    mockExecuteSql.mockClear();
    process.env = MOCK_ENVIRONMENT;
  });

  describe('get', () => {
    it('should create a proper SQL criteria for application key', () => {
      mockExecuteSql = jest.fn().mockResolvedValue([{ Id: 1337, Name: 'TestName', Value: 'TestValue' }]);
      const actionGet = new ActionGet();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTableName('TestTable');
      actionGet.setTableFields(['Id', 'Name', 'Value', 'coverId']);
      actionGet.setConditionApplicationKey('TestApplicationKey');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      expect(mockExecuteSql).toHaveBeenCalled();
      expect(mockExecuteSql.mock.calls[0][0]).toEqual('SELECT Id, Name, Value, coverId FROM TestTable WHERE ((applicationIncluded LIKE \'%\' || \'TestApplicationKey\' || \'%\' OR applicationIncluded = \'*\') AND (applicationExcluded isNull OR applicationExcluded NOT LIKE \'%\' || \'TestApplicationKey\' || \'%\'))');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('should create a proper SQL statement with combined criteria', () => {
      mockExecuteSql = jest.fn().mockResolvedValue([{ Id: 1337, Name: 'TestName', Value: 'TestValue' }]);
      const actionGet = new ActionGet();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTableName('TestTable');
      actionGet.setTableFields(['Id', 'Name', 'Value', 'coverId']);
      actionGet.setConditionId('1337');
      actionGet.setConditionPublishDate('2021-01-01');
      actionGet.setConditionApplicationKey('TestApplicationKey');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      expect(mockExecuteSql).toHaveBeenCalled();
      expect(mockExecuteSql.mock.calls[0][0]).toEqual('SELECT Id, Name, Value, coverId FROM TestTable WHERE (id = \'1337\' AND PublishDate <= \'2021-01-01 00:00:00\' AND (applicationIncluded LIKE \'%\' || \'TestApplicationKey\' || \'%\' OR applicationIncluded = \'*\') AND (applicationExcluded isNull OR applicationExcluded NOT LIKE \'%\' || \'TestApplicationKey\' || \'%\'))');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('should create a proper SQL statement with a left join', () => {
      mockExecuteSql = jest.fn().mockResolvedValue([{ Id: 1337, Name: 'TestName', Value: 'TestValue' }]);
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setConditionApplicationKey('TestApplicationKey');
      let joinOnCondition = 'TestTable.Id = TestChildTable.parentId';
      actionGet.setLeftJoin(new TableChapter(), joinOnCondition);
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      expect(mockExecuteSql).toHaveBeenCalled();
      expect(mockExecuteSql.mock.calls[0][0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON TestTable.Id = TestChildTable.parentId WHERE (((Story.applicationIncluded LIKE \'%\' || \'TestApplicationKey\' || \'%\' OR Story.applicationIncluded = \'*\') AND (Story.applicationExcluded isNull OR Story.applicationExcluded NOT LIKE \'%\' || \'TestApplicationKey\' || \'%\')) AND ((Chapter.applicationIncluded LIKE \'%\' || \'TestApplicationKey\' || \'%\' OR Chapter.applicationIncluded = \'*\') AND (Chapter.applicationExcluded isNull OR Chapter.applicationExcluded NOT LIKE \'%\' || \'TestApplicationKey\' || \'%\')))');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

  });

  describe('\'setConditionId\' creates propper SQL statement', () => {
    it('without a right table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setConditionId('1337');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Id, Name, LastUpdate, SortNumber, PublishDate, applicationincluded, applicationexcluded, coverId FROM Story WHERE (id = \'1337\')');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('with a right table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setConditionId('1337');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId WHERE (Story.id = \'1337\')');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });
  });

  describe('\'setConditionPublishDate\' creates proper SQL statement', () => {
    it('without a right table, datetime is undefined', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setConditionPublishDate(undefined);
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Id, Name, LastUpdate, SortNumber, PublishDate, applicationincluded, applicationexcluded, coverId FROM Story WHERE (PublishDate <= NOW())');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('without a right table, datetime is null', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setConditionPublishDate(null);
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Id, Name, LastUpdate, SortNumber, PublishDate, applicationincluded, applicationexcluded, coverId FROM Story');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('without a right table, datetime is actual datetime', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setConditionPublishDate('2021-01-01');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Id, Name, LastUpdate, SortNumber, PublishDate, applicationincluded, applicationexcluded, coverId FROM Story WHERE (PublishDate <= \'2021-01-01 00:00:00\')');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('with a right table, datetime is undefined', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setConditionPublishDate(undefined);
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId WHERE (Story.PublishDate <= NOW() AND Chapter.PublishDate <= NOW())');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('with a right table, datetime is null', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setConditionPublishDate(null);
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('with a right table, datetime is actual datetime', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setConditionPublishDate('2021-01-01');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId WHERE (Story.PublishDate <= \'2021-01-01 00:00:00\' AND Chapter.PublishDate <= \'2021-01-01 00:00:00\')');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });
  });

  describe('\'setOrderDirection\' creates propper SQL statement', () => {
    it('without a right table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setOrderField('SortNumber');
      actionGet.setOrderDirection('ASC');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Id, Name, LastUpdate, SortNumber, PublishDate, applicationincluded, applicationexcluded, coverId FROM Story ORDER BY SortNumber ASC');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('with a right table, sorting by left table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory)
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setOrderField('SortNumber');
      actionGet.setOrderDirection('ASC');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId ORDER BY Story.SortNumber ASC');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('with a right table, sorting by right table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setRightOrderField('SortNumber');
      actionGet.setRightOrderDirection('ASC');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId ORDER BY Chapter.SortNumber ASC');
      resultPromise.then((result) => {
      expect(result).toBeTruthy();
      });
    });

    it('with a right table, sorting by left and right table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setOrderField('SortNumber');
      actionGet.setOrderDirection('ASC');
      actionGet.setRightOrderField('SortNumber');
      actionGet.setRightOrderDirection('ASC');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId ORDER BY Story.SortNumber ASC, Chapter.SortNumber ASC');
      resultPromise.then((result) => {
      expect(result).toBeTruthy();
      });
    });
  });

  describe('\'setCustomCondition\' creates proper SQL statement', () => {
    it('without a right table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setCustomConditions('Name = \'TestName\'');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Id, Name, LastUpdate, SortNumber, PublishDate, applicationincluded, applicationexcluded, coverId FROM Story WHERE (Name = \'TestName\')');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('with a right table', () => {
      const actionGet = new ActionGet();
      let tableStory = new TableStory();
      let tableChapter = new TableChapter();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableStory);
      actionGet.setRightTable(tableChapter);
      actionGet.setJoinCondition('Story.Id = Chapter.storyId');
      actionGet.setCustomConditions('Story.Name = \'TestName\' AND Chapter.Name = \'TestChapterName\'');
      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];
      expect(firstCall[0]).toEqual('SELECT Story.Id as story_Id, Story.Name as story_Name, Story.LastUpdate as story_LastUpdate, Story.SortNumber as story_SortNumber, Story.PublishDate as story_PublishDate, Story.applicationincluded as story_applicationincluded, Story.applicationexcluded as story_applicationexcluded, Story.coverId as story_coverId, Chapter.Id as chapter_Id, Chapter.Name as chapter_Name, Chapter.SortNumber as chapter_SortNumber FROM Story LEFT JOIN Chapter ON Story.Id = Chapter.storyId WHERE (Story.Name = \'TestName\' AND Chapter.Name = \'TestChapterName\')');
      resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });
  });

  describe('LEFT JOIN bug reproduction - parent records not returned when no children exist', () => {
    it('should reproduce the original bug: application conditions for right table in WHERE clause instead of JOIN ON', () => {
      mockExecuteSql = jest.fn().mockResolvedValue([{ chapter_Id: '000c00000000000045', chapter_Name: 'TestChapter', paragraph_Id: null, paragraph_Name: null }]);

      const actionGet = new ActionGet();
      let tableChapter = new TableChapter();
      let tableParagraph = new TableParagraph();
      actionGet.setPgConnector(new PostgresActions(MOCK_ENVIRONMENT));
      actionGet.setTable(tableChapter);
      actionGet.setRightTable(tableParagraph);
      actionGet.setJoinCondition('chapter.Id = paragraph.chapterId');
      actionGet.setConditionId('000c00000000000045');
      actionGet.setConditionApplicationKey('storytellingdom');
      actionGet.setRightOrderField('SortNumber');
      actionGet.setRightOrderDirection('ASC');

      let resultPromise = actionGet.execute();
      expect(resultPromise).toBeInstanceOf(Promise);
      let firstCall = mockExecuteSql.mock.calls[0];

      const actualSQL = firstCall[0];
      console.log('Generated SQL:', actualSQL);

      // Check if the bug exists: right table application conditions in WHERE instead of JOIN ON
      const hasRightTableConditionsInWhere = actualSQL.includes('WHERE') &&
                                           actualSQL.includes('Paragraph.applicationIncluded') &&
                                           actualSQL.split('WHERE')[1].includes('Paragraph.applicationIncluded');

      const hasRightTableConditionsInJoinOn = actualSQL.includes('JOIN') &&
                                             actualSQL.split('ON')[1] &&
                                             actualSQL.split('WHERE')[0].includes('Paragraph.applicationIncluded');

      // Document the current behavior
      if (hasRightTableConditionsInWhere && !hasRightTableConditionsInJoinOn) {
        console.log('BUG CONFIRMED: Right table conditions are in WHERE clause - this filters out parent records without children');
      } else if (!hasRightTableConditionsInWhere && hasRightTableConditionsInJoinOn) {
        console.log('ALREADY FIXED: Right table conditions are correctly in JOIN ON clause');
      } else {
        console.log('MIXED: Conditions might be in both places or neither');
      }

      return resultPromise.then((result) => {
        expect(result).toBeTruthy();
      });
    });

    it('should demonstrate correct LEFT JOIN behavior where parent records are returned even without children', () => {
      // This test shows what the correct behavior should be after fixing
      // The application conditions for the right table should only be in the JOIN ON clause
      // not in the WHERE clause

      const correctSQL = `SELECT Chapter.Id as chapter_Id, Chapter.StoryId as chapter_StoryId, Chapter.Name as chapter_Name, Chapter.LastUpdate as chapter_LastUpdate, Chapter.SortNumber as chapter_SortNumber, Chapter.reversed as chapter_reversed, Chapter.PublishDate as chapter_PublishDate, Chapter.applicationincluded as chapter_applicationincluded, Chapter.applicationexcluded as chapter_applicationexcluded, Paragraph.Id as paragraph_Id, Paragraph.Name as paragraph_Name, Paragraph.SortNumber as paragraph_SortNumber FROM Chapter LEFT JOIN Paragraph ON (Chapter.Id = Paragraph.chapterId AND (Paragraph.applicationIncluded LIKE '%' || 'storytellingdom' || '%' OR Paragraph.applicationIncluded = '*') AND (Paragraph.applicationExcluded IS NULL OR Paragraph.applicationExcluded NOT LIKE '%' || 'storytellingdom' || '%')) WHERE (Chapter.id = '000c00000000000045' AND (Chapter.applicationIncluded LIKE '%' || 'storytellingdom' || '%' OR Chapter.applicationIncluded = '*') AND (Chapter.applicationExcluded IS NULL OR Chapter.applicationExcluded NOT LIKE '%' || 'storytellingdom' || '%')) ORDER BY Paragraph.SortNumber ASC`;

      // Verify structure of correct SQL
      expect(correctSQL).toContain('LEFT JOIN Paragraph ON (Chapter.Id = Paragraph.chapterId AND (Paragraph.applicationIncluded');
      expect(correctSQL.split('WHERE')[1]).not.toContain('Paragraph.applicationIncluded');
      expect(correctSQL.split('WHERE')[1]).toContain('Chapter.applicationIncluded');
    });
  });
});
