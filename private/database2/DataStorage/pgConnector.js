const postgres = require('postgres');

/** Voreinstellungen des Pools, wenn die Umgebung nichts sagt. */
const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 30;

/**
 * Zugang zu Postgres.
 *
 * **Der Verbindungspool ist prozessweit, nicht pro Instanz.** Das ist der Kern
 * dieser Klasse und war einmal anders: jede `new PostgresActions(...)` legte
 * einen eigenen Pool an, und `closeConnection: true` riss ihn nach der Abfrage
 * wieder ab. Gemessen kostete das ~19 ms Handshake bei ~1 ms Abfrage — der
 * Aufbau der Verbindung war teurer als alles, wofür sie gebraucht wurde.
 *
 * Der `postgres`-Treiber ist auf genau das Gegenteil ausgelegt: `postgres(...)`
 * liefert einen Pool, der offen bleibt, Verbindungen nach Bedarf öffnet und
 * nach `idle_timeout` wieder freigibt. Er wird hier einmal angelegt und von
 * allen Aufrufern geteilt.
 *
 * **Es gibt deshalb kein `closeConnection` mehr.** Eine einzelne Anfrage darf
 * den Pool nicht beenden — sie würde ihn allen anderen wegnehmen. Wer den Pool
 * wirklich schließen will (Prozessende, Testisolation), ruft `closePool()`.
 */
class PostgresActions {
  /** Der geteilte Pool und die Verbindungsangabe, zu der er gehört. */
  static pool = null;
  static poolKey = null;

  /**
   * Verbindungsangaben aus der Umgebung.
   *
   * `PG_POOL_MAX` und `PG_IDLE_TIMEOUT` (in Sekunden) sind einstellbar, weil
   * die sinnvolle Größe vom Hosting abhängt: Zahl der Dynos mal Poolgröße muss
   * unter dem Verbindungslimit der Datenbank bleiben.
   */
  static connectionOptions(environment) {
    const isLocal = environment.PG_LOCAL_DB === 'true';
    const options = {
      host: environment.PGHOST,
      database: environment.PGDATABASE,
      username: environment.PGUSER,
      password: environment.PGPASSWORD,
      port: 5432,
      max: Number(environment.PG_POOL_MAX) || DEFAULT_POOL_MAX,
      idle_timeout:
        Number(environment.PG_IDLE_TIMEOUT) || DEFAULT_IDLE_TIMEOUT_SECONDS,
    };
    if (isLocal) {
      return options;
    }
    return {
      ...options,
      ssl: 'require',
      connection: {
        options: `project=${environment.ENDPOINT_ID}`,
      },
    };
  }

  static connect(environment) {
    return postgres(PostgresActions.connectionOptions(environment));
  }

  /**
   * Der geteilte Pool. Beim ersten Zugriff angelegt, danach wiederverwendet.
   *
   * Der Schlüssel ist die Verbindungsangabe: zeigt eine Umgebung auf eine
   * andere Datenbank, bekommt sie einen eigenen Pool statt still auf dem
   * falschen zu landen.
   */
  static sharedPool(environment) {
    const key = [
      environment.PGHOST,
      environment.PGDATABASE,
      environment.PGUSER,
      environment.PG_LOCAL_DB,
    ].join('|');

    if (PostgresActions.pool && PostgresActions.poolKey === key) {
      return PostgresActions.pool;
    }
    if (PostgresActions.pool) {
      PostgresActions.pool.end();
    }
    PostgresActions.pool = PostgresActions.connect(environment);
    PostgresActions.poolKey = key;
    return PostgresActions.pool;
  }

  /**
   * Schließt den geteilten Pool.
   *
   * Für das Prozessende (`SIGTERM`) und für Tests, die zwischen zwei Fällen
   * einen frischen Pool brauchen. **Nicht** nach einer Abfrage aufrufen.
   */
  static async closePool() {
    if (!PostgresActions.pool) {
      return;
    }
    const pool = PostgresActions.pool;
    PostgresActions.pool = null;
    PostgresActions.poolKey = null;
    await pool.end();
  }

  constructor(environmentObject) {
    if (!environmentObject) {
      throw new Error('Environment object is required');
    }
    this.sql = PostgresActions.sharedPool(environmentObject);
  }

  /**
   * Führt ein Statement mit gebundenen Parametern aus (`$1`, `$2`, …).
   *
   * Werte gehören gebunden, nicht in den String konkateniert.
   */
  async executeParameterizedSql(sqlStatement, parameters = []) {
    try {
      return await this.sql.unsafe(sqlStatement, parameters);
    } catch (error) {
      console.error('Error executing parameterized SQL statement:', error);
      throw error;
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
  async transaction(callback) {
    try {
      return await this.sql.begin(async (sql) => {
        return callback((statement, parameters = []) =>
          sql.unsafe(statement, parameters)
        );
      });
    } catch (error) {
      console.error('Error executing transaction:', error);
      throw error;
    }
  }
}

module.exports = { PostgresActions };
