class DataMockBuilder {
  constructor() {
    this.productParameters = {};
    this.setfields = new Set();
  }

  /**
   * produces the configured product
   */
  getProduct() {
    const idPrefixes = new Map([
      ['story', '000s'],
      ['chapter', '000c'] ,
      ['paragraph', '000p'],
      ['configuration', '000m']
    ]);

    // only pass for valid dataTableName
    if (idPrefixes.get(this.productParameters.dataTableName) === undefined) {
      return {};
    }

    let currentCounter = this.productParameters.productCounter || 0;
    let idPrefix = idPrefixes.get(this.productParameters.dataTableName) ;
    let generatedId = this.productParameters.id || idPrefix + currentCounter.toString().padStart(14, '0');

    let product = {};
    switch (this.productParameters.dataTableName.toLowerCase()) {
      case 'story': {
        // logic for '000s' dataTableName
        product.name = this.productParameters.name || `Story ${currentCounter + 1}`;
        break;
      }
      case 'chapter': {
        // logic for '000c' dataTableName
        product.name = this.productParameters.name || `Chapter ${currentCounter + 1}`;
        break;
      }
      case 'paragraph': {
        // logic for '000p' dataTableName
        product.name = this.productParameters.name || `Paragraph ${currentCounter + 1}`;
        break;
      }
      case 'configuration': {
        // logic for '000m' dataTableName
        product.name = this.productParameters.name || `Configuration ${currentCounter + 1}`;
        break;
      }
    }

    product.id = generatedId;
    product['publishdate'] = '2022-01-01 00:00:00';
    this.setfields.forEach((value) => {
      product[value] = this.productParameters[value];
    });

    if (this.productParameters.applicationIncluded) {
      product['applicationincluded'] = Array.from(this.productParameters.applicationIncluded).join(', ');
    }

    this.productParameters.productCounter = currentCounter+1;
    return product;
  }

  setApplicationIncluded(applicationIncluded) {
    if (!this.productParameters.applicationIncluded) {
      this.productParameters.applicationIncluded = new Set();
    }
    this.productParameters.applicationIncluded.add(applicationIncluded);
    return this;
  }

  /**
   * configures the data table to use
   */
  setTable(dataTableName) {
    this.productParameters.dataTableName = dataTableName;
    return this;
  }

  /**
   * configures the product name
   */
  setName(name) {
    this.productParameters.name = name;
    return this;
  }

  setId(id) {
    this.productParameters.id = id;
    return this;
  }

  setSortNumber(sortNumber) {
    this.setfields.add('sortnumber');
    this.productParameters.sortnumber = sortNumber;
    return this;
  }

  setStoryId(storyId) {
    this.setfields.add('storyid');
    this.productParameters.storyId = storyId;
    return
  }

  setDescription(description) {
    this.setfields.add('description');
    this.productParameters.description = description;
    return this;
  }

  setLastUpdate(lastUpdate) {
    this.setfields.add('lastupdate');
    this.productParameters.lastUpdate = lastUpdate;
    return this;
  }

  setReversed(reversed) {
    this.setfields.add('reversed');
    this.productParameters.reversed = reversed;
    return this;
  }

  setChapterId(chapterId) {
    this.setfields.add('chapterid');
    this.productParameters.chapterId = chapterId;
    return this;
  }

  setContent(content) {
    this.setfields.add('content');
    this.productParameters.content = content;
    return this;
  }

  setHtmlContent(htmlContent) {
    this.setfields.add('htmlcontent');
    this.productParameters.htmlContent = htmlContent;
    return this;
  }
  /**
   * clears the product configuration
   */
  clearConfig() {
    this.productParameters = {};
    this.setfields.clear();
    return this;
  }
}

module.exports = { DataMockBuilder };
