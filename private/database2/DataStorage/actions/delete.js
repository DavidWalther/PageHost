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
    // Der Tabellenname stammt aus einer Tabellen-Definition, die Id aus einer
    // Anfrage -- deshalb steht der eine im Text und die andere gebunden.
    const sqlStatement = `DELETE FROM ${tableName} WHERE id = $1;`;
    Logging.debugMessage({
      severity: 'FINEST',
      location: LOCATION,
      message: `Executing SQL: ${sqlStatement}`,
    });

    return this.pgConnector.executeParameterizedSql(sqlStatement, [this.id]);
  }
}

module.exports = { ActionDelete };
