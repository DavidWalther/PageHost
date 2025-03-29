class TableStory {
  constructor() {
    this.tableName = 'Story';
    this.tableFields = ['Id', 'Name', 'LastUpdate', 'SortNumber', 'PublishDate', 'applicationincluded', 'applicationexcluded'];
    this.tableHeadDataFields = ['Id', 'Name', 'SortNumber'];
    this.tableKeyPrefix = '000s';
  }

  getTableName() {
    return () => this.tableName;
  }

  getTableFields() {
    return () => [... this.tableFields];
  }

  getTableHeadDataFields() {
    return () => [... this.tableHeadDataFields];
  }

  getTableKeyPrefix() {
    return () => this.tableKeyPrefix;
  }
}

module.exports = { TableStory };
