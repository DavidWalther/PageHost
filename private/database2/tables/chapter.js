class TableChapter {
  constructor() {
    this.tableName = 'Chapter';
    this.tableFields = ['Id', 'StoryId', 'Name', 'LastUpdate', 'SortNumber', 'reversed', 'PublishDate', 'applicationincluded', 'applicationexcluded'];
    this.tablHeadDataFields = ['Id', 'StoryId', 'Name', 'SortNumber'];
    this.tableKeyPrefix = '000c';
  }

  getTableName() {
    return () => this.tableName;
  }

  getTableFields() {
    return () => [... this.tableFields];
  }

  getTableHeadDataFields() {
    return () => [... this.tablHeadDataFields];
  }

  getTableKeyPrefix() {
    return () => this.tableKeyPrefix;
  }
}

module.exports = { TableChapter };
