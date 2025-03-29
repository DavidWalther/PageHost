class TableConfiguration {
  constructor() {
    this.tableName = 'configuration';
    this.tableFields = ['key', 'value', 'applicationincluded', 'applicationexcluded'];
    this.tableKeyPrefix = '000m';
  }

  getTableName() {
    return () => this.tableName;
  }

  getTableFields() {
    return () => [... this.tableFields];
  }

  getTableKeyPrefix() {
    return () => this.tableKeyPrefix;
  }
}

module.exports = { TableConfiguration };
