const { Logging } = require("../../../modules/logging");

class ActionUpdate {
  constructor() {
    this.values = {};
  }

  setPgConnector(pgConnector) {
    if (!pgConnector) {
      throw new Error("Postgres connector is required");
    }
    this.pgConnector = pgConnector;
    return this;
  }

  setTable(table) {
    if (!table) {
      throw new Error("Table is required");
    }
    this.table = table;
    return this;
  }

  setValues(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Data object is required");
    }
    this.values = data;
    return this;
  }

  /**
   * Executes the update operation.
   * @returns {Promise} - A promise that resolves to the result of the SQL execution.
   * @throws {Error} - Throws an error if the pgConnector, table, or values are not set.
   */
  async execute() {
      if (!this.pgConnector) { throw new Error("Postgres connector is not set"); }
      if (!this.table) { throw new Error("Table is not set"); }
      if (!this.values) { throw new Error("Data object is not set"); }
      if (!this.values.id) {
        throw new Error("Update operation requires an 'id' field in the data object.");
      }

      const tableName = this.table.getTableName()();
      const id = this.values.id;
      delete this.values.id;

      const setClauses = Object.entries(this.values)
        .map(([key, value]) => {
          if (typeof value === "string") {
            return `${key} = '${value}'`;
          } else if (typeof value === "number" || value === null) {
            return `${key} = ${value}`;
          } else {
            throw new Error("Unsupported value type");
          }
        })
        .join(", ");

      const sqlStatement = `UPDATE ${tableName} SET ${setClauses} WHERE id = '${id}' RETURNING id;`;

      Logging.debugMessage({
        severity: "FINEST",
        location: "ActionUpdate.execute",
        message: `Executing SQL: ${sqlStatement}`,
      });

      return this.pgConnector.executeSql(sqlStatement,  {closeConnection: true});
  }
}

module.exports = ActionUpdate;
