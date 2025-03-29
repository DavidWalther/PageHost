const { Environment } = require('../../modules/environment.js');
const postgres = require('postgres');


let IS_LOCAL;
class PostgresActions {

  static connect(environment) {
    IS_LOCAL = environment.PG_LOCAL_DB ? environment.PG_LOCAL_DB === 'true' : false;
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
        if(options?.closeConnection) { this.sql.end() };
      }
    });
  }
}

module.exports = { PostgresActions };
