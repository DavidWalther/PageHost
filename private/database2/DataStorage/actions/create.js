const { Logging } = require("../../../modules/logging");

class ActionCreate {
  constructor() {
    this.values = {};
  }

  setPgConnector(pgConnector) {
    if (!pgConnector) { return this; }
    this.pgConnector = pgConnector;
    return this;
  }

  setTable(table) {
    if (!table) { return this; }
    this.table = table;
    return this;
  }

  setValue(key, value) {
    if (!key || value === undefined) { return this; }
    if (typeof value === 'string') {
      this.values[key] = `'${value}'`;
    } else if (typeof value === 'number' || value === null) {
      this.values[key] = value;
    } else {
      throw new Error('Unsupported value type');
    }
    return this;
  }

  async execute() {
    const tableName = this.table.getTableName()();
    const tableFields = Object.keys(this.values);
    const fieldValues = tableFields.map(field => `${this.values[field]}`);
    const sqlStatement = `INSERT INTO ${tableName} (${tableFields.join(', ')}) VALUES (${fieldValues.join(', ')});`;

    Logging.debugMessage({ severity: 'FINEST', location: 'ActionCreate.execute', message: `Executing SQL: ${sqlStatement}` });
    return this.pgConnector.executeSql(sqlStatement);
  }
}

module.exports = { ActionCreate };
