const { Logging } = require("../../../modules/logging");
const { Sanitizer } = require("./sanitizer");

// Strategy interfaces
class OrderStrategy {
  getOrderString() {
    throw new Error("Method 'getOrderString()' must be implemented.");
  }
}

class LeftOrderWithoutTablePrefix extends OrderStrategy {
  setOrderDirection(orderDirection) {
    this.orderDirection = orderDirection;
    return this;
  }

  getOrderString() {
    return `${this.orderDirection.fieldname} ${this.orderDirection.direction}`;
  }
}

class LeftOrderWithTablePrefix extends OrderStrategy {
  setLeftTable(leftTable) {
    this.leftTable = leftTable;
    return this;
  }

  setOrderDirection(orderDirection) {
    this.orderDirection = orderDirection;
    return this;
  }

  getOrderString() {
    let leftTableName = this.leftTable.getTableName()();
    return `${leftTableName}.${this.orderDirection.fieldname} ${this.orderDirection.direction}`;
  }
}

class RightOrderWithTablePrefix extends OrderStrategy {
  setRightTable(rightTable) {
    this.rightTable = rightTable;
    return this;
  }

  setRightSortOrder(rightSortOrder) {
    this.rightSortOrder = rightSortOrder;
    return this;
  }

  getOrderString() {
    let rightTableName = this.rightTable.getTableName()();
    return `${rightTableName}.${this.rightSortOrder.fieldname} ${this.rightSortOrder.direction}`;
  }
}

class CombinedLeftRightOrder extends OrderStrategy {
  setLeftTable(leftTable) {
    this.leftTable = leftTable;
    return this;
  }

  setRightTable(rightTable) {
    this.rightTable = rightTable;
    return this;
  }

  setOrderDirection(orderDirection) {
    this.orderDirection = orderDirection;
    return this;
  }

  setRightSortOrder(rightSortOrder) {
    this.rightSortOrder = rightSortOrder;
    return this;
  }

  getOrderString() {
    let leftTableName = this.leftTable.getTableName()();
    let rightTableName = this.rightTable.getTableName()();
    return `${leftTableName}.${this.orderDirection.fieldname} ${this.orderDirection.direction}, ${rightTableName}.${this.rightSortOrder.fieldname} ${this.rightSortOrder.direction}`;
  }
}

// Factory class
class OrderStrategyFactory {
  static createStrategy(leftTable, rightTable, orderDirection, rightSortOrder) {
    let strategy = null;
    if (!rightTable && orderDirection) {
      Logging.debugMessage({severity: 'FINEST', location: 'OrderStrategyFactory.createStrategy', message: `Creating LeftOrderWithoutTablePrefix`});
      strategy = new LeftOrderWithoutTablePrefix().setOrderDirection(orderDirection);
    }
    if (rightTable && orderDirection && !rightSortOrder) {
      Logging.debugMessage({severity: 'FINEST', location: 'OrderStrategyFactory.createStrategy', message: `Creating LeftOrderWithTablePrefix`});
      strategy = new LeftOrderWithTablePrefix().setLeftTable(leftTable).setOrderDirection(orderDirection);
    }
    if (rightTable && !orderDirection && rightSortOrder) {
      Logging.debugMessage({severity: 'FINEST', location: 'OrderStrategyFactory.createStrategy', message: `Creating RightOrderWithTablePrefix`});
      strategy = new RightOrderWithTablePrefix().setRightTable(rightTable).setRightSortOrder(rightSortOrder);
    }
    if (rightTable && orderDirection && rightSortOrder) {
      Logging.debugMessage({severity: 'FINEST', location: 'OrderStrategyFactory.createStrategy', message: `Creating CombinedLeftRightOrder`});
      strategy = new CombinedLeftRightOrder().setLeftTable(leftTable).setRightTable(rightTable).setOrderDirection(orderDirection).setRightSortOrder(rightSortOrder);
    }
    return strategy;
  }
}

class PublishDateCondition {
  setDateTime(dateTime) {
    this.dateTime = dateTime;
    return this;
  }

  setTableName(tableName) {
    this.tableName = tableName;
    return this;
  }

  setRightTable(rightTable) {
    this.rightTable = rightTable;
    return this;
  }

  getCondition() {
    throw new Error("Method 'getCondition()' must be implemented.");
  }
}

class PublishDateUndefined extends PublishDateCondition {
  getCondition() {
    let condition = '';
    if(!this.rightTable) {
      condition += 'PublishDate <= NOW()';
    }
    if (this.rightTable) {
      condition += this.tableName ? `${this.tableName}.PublishDate <= NOW()` : `PublishDate <= NOW()`;
      condition += ` AND ${this.rightTable}.PublishDate <= NOW()`;
    }
    return condition;
  }
}

class PublishDateNull extends PublishDateCondition {
  getCondition() {
    return '';
  }
}

class PublishDateActual extends PublishDateCondition {
  getCondition() {
    const publishDateObject = new Date(this.dateTime);
    const publishDateISO = publishDateObject.toISOString();
    const [datePart, timePart] = publishDateISO.split('T');
    const [timeWithoutMs] = timePart.split('.');

    let condition = '';
    if(!this.rightTable) {
      condition += `PublishDate <= '${datePart} ${timeWithoutMs}'`;
    }
    if (this.rightTable) {
      condition += this.tableName ? `${this.tableName}.PublishDate <= '${datePart} ${timeWithoutMs}'` : `PublishDate <= '${datePart} ${timeWithoutMs}'`;
      condition += ` AND ${this.rightTable}.PublishDate <= '${datePart} ${timeWithoutMs}'`;
    }
    return condition;
  }
}

class PublishDateConditionFactory {
  static createCondition(tableName, dateTime, rightTable) {
    let conditionInstance;
    if (dateTime === undefined) {
      conditionInstance = new PublishDateUndefined();
    } else if (dateTime === null) {
      conditionInstance = new PublishDateNull();
    } else {
      conditionInstance = new PublishDateActual();
    }
    return conditionInstance.setTableName(tableName).setDateTime(dateTime).setRightTable(rightTable);
  }
}

class ActionGet {
  constructor() {}

  setPgConnector(pgConnector) {
    if(!pgConnector) { return this; }
    this.pgConnector = pgConnector;
    return this;
  }

  setTableName(tableName) {
    if(!tableName) { return this; }
    this.tableName = tableName;
    return this;
  }

  setTableFields(tableFields) {
    if(!tableFields) { return this; }

    if(this.tableFields === undefined) {
      this.tableFields = [];
    }
    this.tableFields = this.tableFields.concat(tableFields);

    return this;
  }

  setTable(leftTable) {
    this.leftTable = leftTable;
    return this;
  }

  setRightTable(rightTable) {
    this.rightTable = rightTable;
    return this;
  }

  setJoinCondition(joinCondition) {
    this.joinCondition = joinCondition;
    return this;
  }

  setConditionPublishDate(dateTime) {
    this.publishDateTime = dateTime;
    return this;
  }

  getLeftTablePublishDate() {
    if (this.publishDateTime === undefined) {
      return 'PublishDate <= NOW()';
    } else if (this.publishDateTime === null) {
      return '';
    } else {
      const publishDateObject = new Date(this.publishDateTime);
      const publishDateISO = publishDateObject.toISOString();
      const [datePart, timePart] = publishDateISO.split('T');
      const [timeWithoutMs] = timePart.split('.');
      return `PublishDate <= '${datePart} ${timeWithoutMs}'`;
    }
  }

  getRightTablePublishDate() {
    if (!this.rightTable || this.publishDateTime === null) {
      return '';
    }

    let rightTableName = this.rightTable.getTableName()();
    if (this.publishDateTime === undefined) {
      return `${rightTableName}.PublishDate <= NOW()`;
    } else {
      const publishDateObject = new Date(this.publishDateTime);
      const publishDateISO = publishDateObject.toISOString();
      const [datePart, timePart] = publishDateISO.split('T');
      const [timeWithoutMs] = timePart.split('.');
      return `${rightTableName}.PublishDate <= '${datePart} ${timeWithoutMs}'`;
    }
  }

  setConditionId(recordId) {
    if(!recordId) { return this; }

    if(!this.rightTable) {
      this.conditionRecordId = `id = '${recordId}'`;
      return this;
    }
    if(this.rightTable) {
      let leftTableName = this.leftTable?.getTableName()() || this.tableName;
      let rightTableName = this.rightTable.getTableName()();
      this.conditionRecordId = `${leftTableName}.id = '${recordId}'`;
      return this;
    }
  }

  setCustomConditions(customCondition) {
    if(!customCondition) { return this; }

    if(this.customConditions === undefined) {
      this.customConditions = [];
    }
    this.customConditions.push(customCondition);

    return this;
  }

  setConditions(conditions) {
    if(!conditions) { return this; }

    if(this.conditions === undefined) {
      this.conditions = [];
    }
    this.conditions = this.conditions.concat(conditions);

    return this;
  }

  setOrderField(orderfield) {
    if(!orderfield) { return this; }

    if(this.orderDirection === undefined) {
      this.orderDirection = {};
    }

    this.orderDirection.fieldname = orderfield;

    return this;
  }

  setOrderDirection(orderdirection) {
    if(!orderdirection) { return this; }

    if(this.orderDirection === undefined) {
      this.orderDirection = {};
    }

    this.orderDirection.direction = orderdirection || 'ASC';

    return this;
  }

  setRightOrderField(orderfield) {
    if(!orderfield) { return this; }
    if(!this.rightSortOrder) {
      this.rightSortOrder = {};
    }
    this.rightSortOrder.fieldname = orderfield;
    return this;
  }

  setRightOrderDirection(orderdirection) {
    if(!orderdirection) { return this; }
    if(!this.rightSortOrder) {
      this.rightSortOrder = {};
    }
    this.rightSortOrder.direction = orderdirection;
    return this;
  }

  setConditionApplicationKey(applicationKey) {
    if(!applicationKey) { return this; }

    this.conditionApplicationKey = applicationKey;

    return this;
  }

  getLeftTableApplicationKey() {
    let leftTableName = this.leftTable?.getTableName()() || this.tableName;
    let tablePrefix = this.rightTable ? `${leftTableName}.` : '';
    
    let applicationIncludedCriteria = [];
    applicationIncludedCriteria.push(`${tablePrefix}applicationIncluded LIKE '%' || '${this.conditionApplicationKey}' || '%'`);
    applicationIncludedCriteria.push(`${tablePrefix}applicationIncluded = '*'`);

    let applicationExcludedCriteria = [];
    applicationExcludedCriteria.push(`${tablePrefix}applicationExcluded isNull`);
    applicationExcludedCriteria.push(`${tablePrefix}applicationExcluded NOT LIKE '%' || '${this.conditionApplicationKey}' || '%'`);

    return `(${applicationIncludedCriteria.join(' OR ')}) AND (${applicationExcludedCriteria.join(' OR ')})`;
  }

  getRightTableApplicationKey() {
    if (!this.rightTable) {
      return '';
    }

    let rightTableName = this.rightTable.getTableName()();
    
    let rightApplicationIncludedCriteria = [];
    rightApplicationIncludedCriteria.push(`${rightTableName}.applicationIncluded LIKE '%' || '${this.conditionApplicationKey}' || '%'`);
    rightApplicationIncludedCriteria.push(`${rightTableName}.applicationIncluded = '*'`);
    
    let rightApplicationExcludedCriteria = [];
    rightApplicationExcludedCriteria.push(`${rightTableName}.applicationExcluded isNull`);
    rightApplicationExcludedCriteria.push(`${rightTableName}.applicationExcluded NOT LIKE '%' || '${this.conditionApplicationKey}' || '%'`);

    return `(${rightApplicationIncludedCriteria.join(' OR ')}) AND (${rightApplicationExcludedCriteria.join(' OR ')})`;
  }

  getConditionApplicationKey() {
    // For WHERE clause - only return left table conditions
    return this.getLeftTableApplicationKey();
  }

  setLeftJoin(rightTableClass, joinCondition) {
    if(!rightTableClass || !joinCondition) { return this; }

    this.rightTable = rightTableClass;
    this.joinCondition = joinCondition;

    return this;
  }

  createCombinedCriteria() {
    let conditionArray = [];
    if(this.conditionRecordId) {conditionArray.push(this.conditionRecordId);}
    
    // Add left table publish date condition if it was set (even if undefined)
    if(this.publishDateTime !== null && this.hasOwnProperty('publishDateTime')) {
      let leftTableName = this.leftTable?.getTableName()() || this.tableName;
      let leftPublishCondition = this.getLeftTablePublishDate();
      if (leftPublishCondition) {
        if (this.rightTable) {
          // Prefix with table name for joins
          if (leftPublishCondition.includes('PublishDate <= NOW()')) {
            leftPublishCondition = `${leftTableName}.PublishDate <= NOW()`;
          } else {
            leftPublishCondition = leftPublishCondition.replace('PublishDate <=', `${leftTableName}.PublishDate <=`);
          }
        }
        conditionArray.push(leftPublishCondition);
      }
    }
    
    if(this.conditionApplicationKey) {conditionArray.push(this.getConditionApplicationKey());}
    if(this.customConditions && this.customConditions.length >0) {
      this.customConditions.forEach(customCondition => {
        conditionArray.push(customCondition);
      });
    }

    return conditionArray;
  }

  async execute() {
    let sqlStatement = `SELECT ${this.getFieldString()} FROM ${this.getTableName()}`;
    let conditionArray = this.createCombinedCriteria();
    if(conditionArray.length >0) {
      let criteria = '(' + conditionArray.join(' AND ') + ')';
      sqlStatement += ` WHERE ${criteria}`;
    }
    sqlStatement += this.getOrderString();
    Logging.debugMessage({severity: 'FINEST', location: 'ActionGet.execute', message: `Executing SQL: ${sqlStatement}`});
    const result = await this.pgConnector.executeSql(sqlStatement, {closeConnection: true});
    // Desanitize all string fields in the result rows
    if (result && result.rows) {
      result.rows = result.rows.map(row => {
        const desanitized = {};
        for (const [key, value] of Object.entries(row)) {
          desanitized[key] = Sanitizer.desanitize(value);
        }
        return desanitized;
      });
    }
    return result;
  }

  getFieldString() {
    if(this.rightTable) {
      let rightTableName = this.rightTable.getTableName()();
      let rightTableFieldPrefix = rightTableName.toLowerCase();
      let rightTableFields = ['Id', 'Name', 'SortNumber'];
      let rightTableFieldNames = rightTableFields.map(field => `${rightTableName}.${field} as ${rightTableFieldPrefix}_${field}`);

      let leftTableName = this.leftTable?.getTableName()() || this.tableName;
      let leftTableFieldPrefix = leftTableName.toLowerCase();
      let leftTableFields = this.leftTable?.getTableFields()() || this.tableFields;
      let leftTableFieldNames = leftTableFields.map(field => `${leftTableName}.${field} as ${leftTableFieldPrefix}_${field}`);

      return leftTableFieldNames.concat(rightTableFieldNames).join(', ');
    } else {
      let tableFields = this.leftTable?.getTableFields()() || this.tableFields;
      return tableFields.join(', ');
    }
  }

  getTableName() {
    let leftTableName = this.leftTable?.getTableName()() || this.tableName;

    if(this.rightTable) {
      let rightTableName = this.rightTable?.getTableName()();
      let joinCondition = this.joinCondition;
      let additionalConditions = [];
      
      // Add right table application conditions to JOIN ON clause if they exist
      if (this.conditionApplicationKey) {
        let rightTableConditions = this.getRightTableApplicationKey();
        if (rightTableConditions) {
          additionalConditions.push(rightTableConditions);
        }
      }
      
      // Add right table publish date conditions to JOIN ON clause if they exist
      if (this.publishDateTime !== null && this.hasOwnProperty('publishDateTime')) {
        let rightPublishCondition = this.getRightTablePublishDate();
        if (rightPublishCondition) {
          additionalConditions.push(rightPublishCondition);
        }
      }
      
      if (additionalConditions.length > 0) {
        joinCondition = `(${this.joinCondition} AND ${additionalConditions.join(' AND ')})`;
      }
      
      return `${leftTableName} LEFT JOIN ${rightTableName} ON ${joinCondition}`;
    }
    return leftTableName;
  }

  getOrderString() {
    const sortmode = OrderStrategyFactory.createStrategy(this.leftTable, this.rightTable, this.orderDirection, this.rightSortOrder);

    if (sortmode === null) {
      return '';
    }

    return ' ORDER BY ' + sortmode.getOrderString();
  }
}

module.exports = { ActionGet };
