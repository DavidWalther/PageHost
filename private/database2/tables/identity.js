class TableIdentity {
  constructor() {
    this.tableName = 'identity';
    this.tableFields = ['id', 'recordnumber', 'key', 'active', 'createddate', 'applicationincluded', 'applicationexcluded'];
    this.tableKeyPrefix = '000i';
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

module.exports = { TableIdentity };

