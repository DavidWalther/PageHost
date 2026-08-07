const { Logging } = require('../../../modules/logging');
const { Sanitizer } = require('./sanitizer');

/**
 * Lesen aus den Tabellen, die **nicht** zum Inhalt gehören: `configuration`
 * und `identity`.
 *
 * Diese Klasse war einmal die Abfrage-Maschinerie des alten Datenmodells —
 * LEFT JOINs zwischen Story und Kapitel, Publish-Filter je Tabellenseite,
 * Sortier-Strategien, alles über Zeichenketten zusammengesetzt. Mit dem
 * Wegfall der alten Tabellen ist davon nichts mehr erreichbar gewesen; übrig
 * bleibt eine Abfrage über **eine** Tabelle.
 *
 * **Werte werden gebunden, nicht konkateniert.** Das war der letzte Ort, an
 * dem ein Wert aus einer Anfrage in den SQL-Text geriet: der Anmeldeschlüssel
 * in `queryIdentityByKey` und die Token-Id im `RefreshEndpoint` kamen beide
 * vom Client. `setConditionEquals` nimmt Werte entgegen und stellt sie als
 * `$1`, `$2`, … in die Anfrage.
 *
 * `setCustomConditions` bleibt für Fragmente **ohne** Wert (`active = true`).
 * Wer dort einen Wert einsetzt, baut die Lücke wieder ein.
 */
class ActionGet {
  setPgConnector(pgConnector) {
    this.pgConnector = pgConnector;
    return this;
  }

  setTableName(tableName) {
    this.tableName = tableName;
    return this;
  }

  setTableFields(tableFields) {
    this.tableFields = tableFields;
    return this;
  }

  getTableName() {
    return typeof this.tableName === 'function'
      ? this.tableName()
      : this.tableName;
  }

  getFieldString() {
    const fields =
      typeof this.tableFields === 'function'
        ? this.tableFields()
        : this.tableFields;
    if (!fields || fields.length === 0) {
      return '*';
    }
    return fields.join(', ');
  }

  /**
   * App-Filter, wie ihn `configuration` und `identity` seit jeher tragen:
   * eine Positiv-Liste mit `'*'` als „alle Apps" und eine Negativ-Ausnahme.
   * Der Schlüssel wird gebunden.
   */
  setConditionApplicationKey(applicationKey) {
    this.conditionApplicationKey = applicationKey;
    return this;
  }

  /** Bedingung mit einem Wert. Der Wert geht gebunden in die Anfrage. */
  setConditionEquals(expression, value) {
    if (!expression) {
      return this;
    }
    if (this.boundConditions === undefined) {
      this.boundConditions = [];
    }
    this.boundConditions.push({ expression, value });
    return this;
  }

  /** Bedingung **ohne** Wert, etwa `active = true`. */
  setCustomConditions(customCondition) {
    if (!customCondition) {
      return this;
    }
    if (this.customConditions === undefined) {
      this.customConditions = [];
    }
    this.customConditions.push(customCondition);
    return this;
  }

  async execute() {
    const conditions = [];
    const parameters = [];

    if (this.conditionApplicationKey) {
      const placeholder = `$${parameters.length + 1}`;
      parameters.push(this.conditionApplicationKey);
      conditions.push(
        `(applicationIncluded LIKE '%' || ${placeholder} || '%'` +
          ` OR applicationIncluded = '*')` +
          ` AND (applicationExcluded IS NULL` +
          ` OR applicationExcluded NOT LIKE '%' || ${placeholder} || '%')`
      );
    }

    (this.boundConditions || []).forEach(({ expression, value }) => {
      const placeholder = `$${parameters.length + 1}`;
      parameters.push(value);
      conditions.push(`${expression} = ${placeholder}`);
    });

    (this.customConditions || []).forEach((condition) => {
      conditions.push(condition);
    });

    let sqlStatement = `SELECT ${this.getFieldString()} FROM ${this.getTableName()}`;
    if (conditions.length > 0) {
      sqlStatement += ` WHERE (${conditions.join(' AND ')})`;
    }

    Logging.debugMessage({
      severity: 'FINEST',
      location: 'ActionGet.execute',
      message: `Executing SQL: ${sqlStatement}`,
    });

    const result = await this.pgConnector.executeParameterizedSql(
      sqlStatement,
      parameters,
      { closeConnection: true }
    );

    // Der Sanitizer ersetzt beim Schreiben Zeichen, die den alten
    // String-Statements gefährlich wurden; beim Lesen wird das rückgängig
    // gemacht. Er bleibt, solange geschriebene Bestandsdaten so aussehen.
    if (!Array.isArray(result)) {
      return result;
    }
    return result.map((row) => {
      const desanitized = {};
      Object.entries(row).forEach(([key, value]) => {
        desanitized[key] = Sanitizer.desanitize(value);
      });
      return desanitized;
    });
  }
}

module.exports = { ActionGet };
