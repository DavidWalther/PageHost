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
    const tableName = this.table.getTableName();
    const LOCATION = 'ActionDelete.execute';
    const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`;
    Logging.debugMessage({ severity: 'FINE', location: LOCATION, message: `Executing: ${query} with id: ${this.id}` });
    const result = await this.pgConnector.query(query, [this.id]);
    return result.rows;
  }
}

module.exports = { ActionDelete };
