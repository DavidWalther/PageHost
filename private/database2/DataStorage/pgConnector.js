const { Environment } = require('../../modules/environment.js');
const postgres = require('postgres');

let IS_LOCAL;
class PostgresActions {
  static connect(environment) {
    IS_LOCAL = environment.PG_LOCAL_DB
      ? environment.PG_LOCAL_DB === 'true'
      : false;
    if (IS_LOCAL) {
      return postgres({
        host: environment.PGHOST,
        database: environment.PGDATABASE,
        username: environment.PGUSER,
        password: environment.PGPASSWORD,
        port: 5432,
      });
    } else {
      return postgres({
        host: environment.PGHOST,
        database: environment.PGDATABASE,
        username: environment.PGUSER,
        password: environment.PGPASSWORD,
        port: 5432,
        ssl: 'require',
        connection: {
          options: `project=${environment.ENDPOINT_ID}`,
        },
      });
    }
  }

  constructor(environmentObject) {
    if (!environmentObject) {
      throw new Error('Environment object is required');
    }
    this.sql = PostgresActions.connect(environmentObject);
  }

  /**
   * Führt ein Statement mit gebundenen Parametern aus (`$1`, `$2`, …).
   *
   * Bewusst eine eigene Methode statt einer Erweiterung von `executeSql`: dort
   * ist der zweite Parameter historisch das Options-Objekt und wird vom Treiber
   * im Parameter-Slot entgegengenommen. Die Signatur zu ändern hieße, jeden
   * bestehenden Aufruf anzufassen.
   *
   * Neuer Code baut seine Statements über diesen Weg — Werte gehören gebunden,
   * nicht in den String konkateniert.
   */
  async executeParameterizedSql(sqlStatement, parameters = [], options = {}) {
    try {
      return await this.sql.unsafe(sqlStatement, parameters);
    } catch (error) {
      console.error('Error executing parameterized SQL statement:', error);
      throw error;
    } finally {
      // Wie bei executeSql: die Verbindung bleibt standardmäßig offen.
      if (options?.closeConnection) {
        this.sql.end();
      }
    }
  }

  /**
   * Führt mehrere Statements in **einer** Transaktion aus.
   *
   * Nötig, weil `executeParameterizedSql` jedes Statement aus dem Pool bedient:
   * ein `BEGIN` landete dort womöglich auf einer anderen Verbindung als das
   * folgende `DELETE`. `sql.begin` des Treibers hält eine Verbindung fest und
   * setzt `COMMIT` bzw. bei einem Fehler `ROLLBACK`.
   *
   * Der Callback bekommt eine Funktion `run(statement, parameters)`, die an
   * genau diese Verbindung gebunden ist.
   */
  async transaction(callback, options = {}) {
    try {
      return await this.sql.begin(async (sql) => {
        return callback((statement, parameters = []) =>
          sql.unsafe(statement, parameters)
        );
      });
    } catch (error) {
      console.error('Error executing transaction:', error);
      throw error;
    } finally {
      if (options?.closeConnection) {
        this.sql.end();
      }
    }
  }

  executeSql(sqlStatement, options) {
    return new Promise(async (resolve, reject) => {
      try {
        // ToDo - add logging
        //console.log(`Executing SQL Statement: ${sqlStatement}`);
        const result = await this.sql.unsafe(sqlStatement, options);
        resolve(result);
      } catch (error) {
        console.error('Error executing SQL statement:', error);
        reject(error);
      } finally {
        // by default the conection stays open
        if (options?.closeConnection) {
          this.sql.end();
        }
      }
    });
  }
}

module.exports = { PostgresActions };
