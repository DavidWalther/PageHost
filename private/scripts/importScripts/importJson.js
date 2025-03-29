/**
 * This script is used to import JSON data into the database.
 * It takes has paramters to specify informations where/how the paragraphs must be imported:
 *  --storyid
 *  --chapterid
 *  --publishdate: the publish date of the paragraphs
 *  --jsonfile: the file containing the JSON data
 *
 * The JSON file must contain an object with a key 'paragraphs' which is an array of paragraphs.
 * eg:
 *
 * {
 *   "paragraphs": [
 *     {
 *       "sortnumber": 1,
 *       "htmlcontent": "<p>This is a hello world paragraph</p>",
 *       "content":"This is a hello world paragraph",
 *       "name":"hello world",
 *     }
 *   ]
 * }
 *
 * ------------
 *
 * Steps
 * 1. The script reads/validates the parameters
 * 2. Reads the JSON file
 * 3. For each paragraph in the JSON file, informations from the parameters are added to the paragraph object
 * 4. The paragraph is imported into the database
 *
 */

const { DataStorage } = require('../../database2/DataStorage/DataStorage.js');
const { TableParagraph } = require('../../database2/tables/paragraph.js');
const { Environment } = require('../../modules/environment.js');
const { PostgresActions } = require('../../database2/DataStorage/pgConnector.js');
require('dotenv').config();
const fs = require('fs');
const minimist = require('minimist');
const { exit } = require('process');

let args = minimist(process.argv.slice(2));

function readFile(filepath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, 'utf8', (err, data) => {
      if(err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

const importParameterMap = [
  {
    name: 'storyid',
    type: 'string',
    required: true,
    environmeintVariable: 'STORY_ID',
    argument: 'storyid',
    errorMessage: 'storyid not provided'
  },
  {
    name: 'chapterid',
    type: 'string',
    required: true,
    environmeintVariable: 'CHAPTER_ID',
    argument: 'chapterid',
    errorMessage: 'chapterid not provided'
  },
  {
    name: 'publishdate',
    type: 'string',
    required: false,
    environmeintVariable: 'PUBLISH_DATE',
    argument: null,
    errorMessage: 'publishdate not provided'
  }
]

function readParameters() {
  let inputParams = {};

  const parameterValue = (parameterMappingObject) => {
    let value = process.env[parameterMappingObject.environmeintVariable] || args[parameterMappingObject.argument];
    if(!value && parameterMappingObject.required) {
      throw new Error(parameterMappingObject.errorMessage);
    }
    return value;
  }

  try {

    importParameterMap.forEach(parameterMappingObject => {
      inputParams[parameterMappingObject.name] = parameterValue(parameterMappingObject);
    });

    if(!args.jsonfile) {
      throw new Error('jsonfile not provided');
    }
    inputParams.jsonfile = args.jsonfile;

    return inputParams;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

const environment = new Environment().getEnvironment();
console.log('Environment:', environment);
const dataStorage = new DataStorage(environment);

function importParagraph(paragraph, input) {
  let paramObj = {
    ...paragraph,
    ...input,
  };
  delete paramObj.jsonfile;

  console.table(paramObj);
  try {
    return dataStorage.createRecord(new TableParagraph(), paramObj);
    console.log('Paragraph imported:', result);
  } catch (error) {
    console.error('Error importing paragraph:', error);
  }
}

// ----------------------
// Main
// ----------------------

let inputParams = readParameters();

readFile(inputParams.jsonfile)
.then(data => {
  data = JSON.parse(data);
  if(!data.paragraphs) {
    throw new Error('No paragraphs found in JSON file');
  }

  let paragraphs = data.paragraphs;
  let paragraphPromises = [];
  paragraphs.forEach(paragraph => {
    paragraph.publishdate = inputParams.publishdate;
    paragraph.chapterid = inputParams.chapterid;
    paragraph.storyid = inputParams.storyid;

    paragraphPromises.push(importParagraph(paragraph, inputParams));
  });
  console.log(`Number of paragraphs to import: ${paragraphPromises.length}`);
  return Promise.all(paragraphPromises)
})
.then(() => {
  console.log('Paragraph imported');
  exit(0);
});
