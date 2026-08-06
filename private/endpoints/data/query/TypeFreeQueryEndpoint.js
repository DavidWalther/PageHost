const { Logging } = require('../../../modules/logging');
const { EndpointLogic } = require('../../EndpointLogic');
const { DataFacade } = require('../../../database2/DataFacade');

/** Die Tabellen, die diese Endpunkt-Logik bedient. */
const TYPE_FREE_TABLES = ['node', 'content'];

/**
 * Endpunkt-Logik der typfreien Antwortform: `/data/query/node?id=` und
 * `/data/query/content?id=`.
 *
 * **Eine Klasse für beide Routen.** `SingleStoryEndpoint`, `ChapterEndpoint`
 * und `ParagraphEndpoint` unterscheiden sich untereinander nur im Wert von
 * `request.table` — drei Dateien für einen String. Diese Dreiteilung war die
 * Folge dreier fester Ebenen im Datenmodell; im neuen gibt es sie nicht mehr,
 * also gibt es sie auch hier nicht mehr.
 *
 * Die alten Routen bleiben daneben bestehen, bis das Frontend umgestellt ist.
 */
class TypeFreeQueryEndpoint extends EndpointLogic {
  constructor(table) {
    super();
    if (!TYPE_FREE_TABLES.includes(table)) {
      throw new Error(`Unknown type-free table: ${table}`);
    }
    this.table = table;
  }

  /**
   * Für die Protokollzeile in `server.js`. Der reine Klassenname wäre hier
   * mehrdeutig — er sagt nicht, welche der beiden Routen gelaufen ist.
   */
  getClassName() {
    return `${this.constructor.name}(${this.table})`;
  }

  async execute() {
    const LOCATION = 'Server.TypeFreeQueryEndpoint.execute';

    Logging.debugMessage({
      severity: 'INFO',
      message: `Executing ${this.table} query`,
      location: LOCATION,
    });

    const dataFacade = new DataFacade(this.environment);
    const parameterObject = {
      returnPromise: true,
      request: {
        table: this.table,
        id: this.requestObject.query.id,
      },
    };

    if (this.scopes?.has('edit')) {
      Logging.debugMessage({
        severity: 'INFO',
        message: 'Edit scope detected, modifying request parameters',
        location: LOCATION,
      });
      // `null` heißt "gar kein Publish-Filter" — nicht "Standardfilter".
      parameterObject.request.publishDate = null;
      dataFacade.setSkipCache(true);
    }

    return dataFacade.getData(parameterObject).then((record) => {
      Logging.debugMessage({
        severity: 'FINER',
        message: `${this.table} returned`,
        location: LOCATION,
      });
      this.responseObject.json(record);
    });
  }
}

module.exports = { TypeFreeQueryEndpoint, TYPE_FREE_TABLES };
