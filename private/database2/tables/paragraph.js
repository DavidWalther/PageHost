class TableParagraph {
  constructor() {
    this.tableName = 'Paragraph';
    this.tableFields = ['Id', 'Name', 'LastUpdate', 'Content', 'HtmlContent', 'SortNumber', 'ChapterId', 'StoryId', 'PublishDate', 'applicationincluded', 'applicationexcluded'];
    this.tableHeadDataFields = ['Id', 'Name', 'SortNumber', 'ChapterId'];
    this.tableKeyPrefix = '000p';
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

module.exports = { TableParagraph };
