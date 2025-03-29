/**
 * This script is used to import paragraphs into the database.
 * 
 * It reads the input from STDIN and expects the following parameters:
 * --storyid: the id of the story
 * --chapterid: the id of the chapter
 * --publishdate: the publish date of the paragraph
 * --sortnumber: the sort number of the paragraph
 */

const { ActionLogic } = require('./create');
const { PostgresActions } = require('../../database/pgConnector.js');
const fs = require('fs');
const minimist = require('minimist');

let args = minimist(process.argv.slice(2));

async function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.on('data', (data) => {
      input += data;
    });
    process.stdin.on('end', () => {
      resolve(input);
    });
  })
}

function readParameters() {
  return new Promise((resolve, reject) => {
    let inputParams = {};
    try {
      if(!args.storyid) {
        throw new Error('storyid not provided');
      }
      inputParams.storyid = args.storyid;
      
      if(!args.chapterid) {
        throw new Error('chapterid not provided');
      }
      inputParams.chapterid = args.chapterid;
      
      if(!args.publishdate) {
        throw new Error('publishdate not provided');
      }
      inputParams.publishdate = args.publishdate;

      if(!args.sortnumber) {
        throw new Error('sortnumber not provided');
      }
      inputParams.sortnumber = args.sortnumber;
      
      resolve(inputParams);
    } catch (error) {
      reject(error);
    }
  });
}

importParagraph = (paragraph, input) => {
  let paramObj = {
    operation: 'create',
    table: 'paragraph',
    storyid: input.storyid,
    chapterid: input.chapterid,
    publishdate: input.publishdate,
    sortnumber: input.sortnumber,
    content: paragraph
  };
  
  const pgConnector = new PostgresActions();
  const actionLogic = new ActionLogic(pgConnector);
  actionLogic.execute(paramObj.operation, paramObj.table, paramObj);
}

let promiseArray = [];
promiseArray.push(readParameters());
promiseArray.push(readStdin());

Promise.all(promiseArray).then((resolveArray) => {
  let inputParams = resolveArray[0];
  let input = resolveArray[1];
  
  let paragraphs = input.split('\n\n');
  paragraphs.forEach((paragraph) => {
    importParagraph(paragraph, inputParams);
    inputParams.sortnumber++;
  });
})
.catch((error) => {
  console.error(error);
});
