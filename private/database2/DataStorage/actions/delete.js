const { Logging } = require('../../../modules/logging.js');

class ActionDelete {
  setPgConnector(pgConnector) {
    this.pgConnector = pgConnector;
    return this;
  }

  setTable(table) {
    this.table = table;
    return this;
  }

  setId(id) {
    this.id = id;
    return this;
  }

  async execute() {
    if (!this.table) {
      throw new Error('Table is required');
    }
    if (!this.id) {
      throw new Error('ID is required for delete');
    }
    const tableName = this.table.getTableName()();
    const LOCATION = 'ActionDelete.execute';
    const sqlStatementTpl = 'DELETE FROM {tablename} WHERE id = \'{recordId}\';';
    const sqlStatement = sqlStatementTpl
      .replace('{tablename}', tableName)
      .replace('{recordId}', this.id);
    Logging.debugMessage({
      severity: "FINEST",
      location: LOCATION,
      message: `Executing SQL: ${sqlStatement}`
    });

    const result = await this.pgConnector.executeSql(sqlStatement);
    return result.rows;
  }
}

module.exports = { ActionDelete };
