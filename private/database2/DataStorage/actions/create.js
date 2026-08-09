const { Logging } = require('../../../modules/logging');

/**
 * Baut und fuehrt ein INSERT aus -- schemaunabhaengig, ueber `setValue`.
 *
 * **Werte werden gebunden.** Frueher liefen sie durch den `Sanitizer` und
 * wurden dann in den SQL-Text geschrieben; das Verdoppeln der Anfuehrungs-
 * zeichen war der Ersatz fuer eine Bindung. Mit `$1`, `$2`, ... braucht es ihn
 * nicht mehr, und der Wert kommt unveraendert in der Spalte an -- `trim()` und
 * verdoppelte Apostrophe inklusive.
 */

class ActionCreate {
  constructor() {
    this.values = {};
  }

  setPgConnector(pgConnector) {
    if (!pgConnector) {
      return this;
    }
    this.pgConnector = pgConnector;
    return this;
  }

  setTable(table) {
    if (!table) {
      return this;
    }
    this.table = table;
    return this;
  }

  setValue(key, value) {
    if (!key || value === undefined) {
      return this;
    }

    // check if the key is a valid field for the table
    let tableFields = this.table.getTableFields()();
    tableFields = tableFields.map((field) => field.toLowerCase());
    if (!tableFields.includes(key.toLowerCase())) {
      throw new Error(
        `Field "${key}" is not defined for table "${this.table.getTableName()()}"`
      );
    }

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      value !== null
    ) {
      throw new Error('Unsupported value type');
    }
    this.values[key] = value;
    return this;
  }

  async execute() {
    const tableName = this.table.getTableName()();
    const tableFields = Object.keys(this.values);
    const placeholders = tableFields.map((_, index) => `$${index + 1}`);
    const parameters = tableFields.map((field) => this.values[field]);
    const sqlStatement = `INSERT INTO ${tableName} (${tableFields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`;

    Logging.debugMessage({
      severity: 'FINEST',
      location: 'ActionCreate.execute',
      message: `Executing SQL: ${sqlStatement}`,
    });
    return this.pgConnector.executeParameterizedSql(sqlStatement, parameters);
  }
}

module.exports = { ActionCreate };
