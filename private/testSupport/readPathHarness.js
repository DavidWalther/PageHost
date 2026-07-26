/**
 * Harness für die Charakterisierungstests des Lesepfads.
 *
 * Zweck: den heutigen Ist-Zustand der Leseantworten festschreiben, bevor die
 * Datenschicht auf das neue Modell umgestellt wird. Die Tests sollen brechen,
 * sobald sich die ausgelieferte Form ändert — auch dann, wenn die Änderung
 * unbeabsichtigt ist.
 *
 * Schnittebene: gemockt wird **nur** externes I/O, also der `pgConnector`
 * (Postgres) und der `DataCache2` (Redis). `DataFacade`, `DataStorage` und die
 * SQL-Erzeugung in `actions/get.js` laufen echt. Genau dort entstehen die
 * Eigenheiten, die festgehalten werden sollen: kleingeschriebene Feldnamen,
 * die Verschachtelung `story.chapters[]` / `chapter.paragraphs[]`, das
 * Weglassen falsy Felder und die App-/Publish-Bedingungen im SQL.
 *
 * Dieses Verzeichnis liegt bewusst **nicht** unter `__tests__/`: Jests
 * Default-`testMatch` sammelt dort jede `.js`-Datei als Testdatei ein und
 * scheitert an einer Helferdatei ohne Tests.
 */

/** Von `executeSql` nacheinander zurückgegebene Ergebnisse. */
let queuedResults = [];
/** Alle abgesetzten SQL-Statements, in Reihenfolge. */
let executedStatements = [];

class PostgresActionsMock {
  constructor(environment) {
    if (!environment) {
      throw new Error('Environment object is required');
    }
  }

  executeSql(sqlStatement) {
    executedStatements.push(sqlStatement);
    const next = queuedResults.shift();
    // Der echte postgres-Treiber liefert ein Array von Zeilen zurück, kein
    // Objekt mit `.rows` — das Mock bildet das nach.
    return Promise.resolve(next === undefined ? [] : next);
  }
}

class DataCache2Mock {
  constructor() {}
  async get() {
    return null; // immer Cache-Miss: der Lesepfad soll bis Postgres durchlaufen
  }
  async set() {
    return undefined;
  }
}

/** Ergebnisse in der Reihenfolge festlegen, in der Queries abgesetzt werden. */
function queueResults(...results) {
  queuedResults.push(...results);
}

/** Vor jedem Test aufrufen. */
function resetHarness() {
  queuedResults = [];
  executedStatements = [];
}

function statements() {
  return executedStatements;
}

function lastStatement() {
  return executedStatements[executedStatements.length - 1];
}

/**
 * Zeile eines `story LEFT JOIN chapter`-Ergebnisses.
 *
 * Die Spaltennamen entsprechen den Aliassen aus `ActionGet.getFieldString()`
 * (`Story.Name as story_Name`), die Postgres auf Kleinschreibung faltet.
 * Die rechte Tabelle liefert dabei nur `Id`, `Name`, `SortNumber` — nicht die
 * vollen Kapitelfelder.
 */
function storyJoinChapterRow({ story = {}, chapter = null } = {}) {
  const row = {};
  Object.entries(story).forEach(([key, value]) => {
    row[`story_${key.toLowerCase()}`] = value;
  });
  if (chapter) {
    Object.entries(chapter).forEach(([key, value]) => {
      row[`chapter_${key.toLowerCase()}`] = value;
    });
  }
  return row;
}

/** Zeile eines `chapter LEFT JOIN paragraph`-Ergebnisses. */
function chapterJoinParagraphRow({ chapter = {}, paragraph = null } = {}) {
  const row = {};
  Object.entries(chapter).forEach(([key, value]) => {
    row[`chapter_${key.toLowerCase()}`] = value;
  });
  if (paragraph) {
    Object.entries(paragraph).forEach(([key, value]) => {
      row[`paragraph_${key.toLowerCase()}`] = value;
    });
  }
  return row;
}

module.exports = {
  PostgresActionsMock,
  DataCache2Mock,
  queueResults,
  resetHarness,
  statements,
  lastStatement,
  storyJoinChapterRow,
  chapterJoinParagraphRow,
};
