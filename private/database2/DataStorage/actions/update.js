const { Logging } = require('../../../modules/logging');

class ActionUpdate {
  constructor() {
    this.values = {};
  }

  setPgConnector(pgConnector) {
    if (!pgConnector) {
      throw new Error('Postgres connector is required');
    }
    this.pgConnector = pgConnector;
    return this;
  }

  setTable(table) {
    if (!table) {
      throw new Error('Table is required');
    }
    this.table = table;
    return this;
  }

  /**
   * Die zu setzenden Werte. Sie gehen gebunden in die Anfrage -- frueher
   * liefen sie durch den `Sanitizer` und dann in den SQL-Text.
   */
  setValues(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Data object is required');
    }
    this.values = { ...data };
    return this;
  }

  /**
   * Executes the update operation.
   * @returns {Promise} - A promise that resolves to the result of the SQL execution.
   * @throws {Error} - Throws an error if the pgConnector, table, or values are not set.
   */
  async execute() {
    if (!this.pgConnector) {
      throw new Error('Postgres connector is not set');
    }
    if (!this.table) {
      throw new Error('Table is not set');
    }
    if (!this.values) {
      throw new Error('Data object is not set');
    }
    if (!this.values.id) {
      throw new Error(
        "Update operation requires an 'id' field in the data object."
      );
    }

    const tableName = this.table.getTableName()();
    const id = this.values.id;
    delete this.values.id;

    const parameters = [];
    const setClauses = Object.entries(this.values)
      .map(([key, value]) => {
        if (
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean' &&
          value !== null
        ) {
          throw new Error('Unsupported value type');
        }
        parameters.push(value);
        return `${key} = $${parameters.length}`;
      })
      .join(', ');

    parameters.push(id);
    const sqlStatement = `UPDATE ${tableName} SET ${setClauses} WHERE id = $${parameters.length} RETURNING * ;`;

    Logging.debugMessage({
      severity: 'FINEST',
      location: 'ActionUpdate.execute',
      message: `Executing SQL: ${sqlStatement}`,
    });

    return this.pgConnector.executeParameterizedSql(sqlStatement, parameters, {
      closeConnection: true,
    });
  }
}

module.exports = ActionUpdate;
