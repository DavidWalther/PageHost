/**
 * Abschluss der Phase „neue Lesequelle": derselbe Vertrag gegen beide Quellen.
 *
 * Gemockt ist nur der `pgConnector` — also externes I/O. Alles darüber läuft
 * echt: bei der alten Quelle `DataStorage` samt SQL-Erzeugung und Mapping, bei
 * der neuen die Sichtbarkeitsauflösung und das Kompat-Mapping. Jede Seite
 * bekommt die Zeilen ihres eigenen Datenmodells; erwartet wird dieselbe Antwort.
 */

const {
  describeContentRepositoryContract,
  IDS,
  PUBLISHED,
} = require('../../../testSupport/contentRepositoryContract.js');
const {
  storyJoinChapterRow,
  chapterJoinParagraphRow,
} = require('../../../testSupport/readPathHarness.js');

jest.mock('../../DataStorage/pgConnector.js');
jest.mock('../../../modules/logging');

const { PostgresActions } = require('../../DataStorage/pgConnector.js');
const { LegacyContentRepository } = require('../LegacyContentRepository.js');
const { NodeContentRepository } = require('../NodeContentRepository.js');

const APPLICATION_KEY = 'vertragsApp';

// Zeilen, die der jeweilige Mock ausliefert. Die Seeds unten fuellen sie.
let legacyRows;
let nodeRows;

beforeEach(() => {
  legacyRows = {};
  nodeRows = {};

  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    // Alte Quelle: ActionGet baut den SQL-Text; hier wird nach der abgefragten
    // Tabelle unterschieden.
    executeSql: jest.fn(async (statement) => {
      if (statement.includes('FROM Story LEFT JOIN')) {
        return legacyRows.storyJoin || [];
      }
      if (statement.includes('FROM Chapter LEFT JOIN')) {
        return legacyRows.chapterJoin || [];
      }
      if (statement.includes('FROM Paragraph')) {
        return legacyRows.paragraph || [];
      }
      if (statement.includes('FROM Story')) {
        return legacyRows.allStories || [];
      }
      if (statement.includes('FROM Chapter')) {
        return legacyRows.allChapters || [];
      }
      return [];
    }),
    // Neue Quelle: feste Abfragen, unterschieden am Tabellennamen.
    executeParameterizedSql: jest.fn(async (statement) => {
      if (statement.includes('FROM app_node')) return nodeRows.appNodes || [];
      if (statement.includes('FROM content_node cn')) {
        return nodeRows.content || [];
      }
      if (statement.includes('FROM content_node')) {
        return nodeRows.contentNodes || [];
      }
      return nodeRows.nodes || [];
    }),
  }));
});

// ---------------------------------------------------------------------------
// Alte Quelle: Zeilen aus story / chapter / paragraph
// ---------------------------------------------------------------------------

const legacySeed = {
  storyWithTwoChapters() {
    const story = {
      Id: IDS.story,
      Name: 'Erste Story',
      LastUpdate: null,
      SortNumber: 10,
      PublishDate: PUBLISHED,
      coverId: IDS.chapterA,
      applicationincluded: APPLICATION_KEY,
    };
    legacyRows.storyJoin = [
      storyJoinChapterRow({
        story,
        chapter: { Id: IDS.chapterA, Name: 'Kapitel A', SortNumber: 1 },
      }),
      storyJoinChapterRow({
        story,
        chapter: { Id: IDS.chapterB, Name: 'Kapitel B', SortNumber: 2 },
      }),
    ];
  },

  chapterWithOneParagraph() {
    legacyRows.chapterJoin = [
      chapterJoinParagraphRow({
        chapter: {
          Id: IDS.chapterA,
          StoryId: IDS.story,
          Name: 'Kapitel A',
          LastUpdate: null,
          SortNumber: 1,
          reversed: true,
          PublishDate: PUBLISHED,
        },
        paragraph: { Id: IDS.paragraph, Name: 'Absatz 1', SortNumber: 1 },
      }),
    ];
  },

  paragraphWithHtml() {
    legacyRows.paragraph = [
      {
        id: IDS.paragraph,
        name: 'Absatz 1',
        lastupdate: null,
        content: 'Reiner Text',
        htmlcontent: '<p>Reiner Text</p>',
        sortnumber: 1,
        chapterid: IDS.chapterA,
        storyid: IDS.story,
        publishdate: PUBLISHED,
        applicationincluded: APPLICATION_KEY,
        applicationexcluded: null,
      },
    ];
  },

  contentsTree() {
    legacyRows.allStories = [
      {
        id: IDS.story,
        name: 'Erste Story',
        lastupdate: null,
        sortnumber: 10,
        publishdate: PUBLISHED,
        coverid: IDS.chapterA,
        applicationincluded: APPLICATION_KEY,
      },
    ];
    legacyRows.allChapters = [
      {
        id: IDS.chapterB,
        storyid: IDS.story,
        name: 'Kapitel B',
        lastupdate: null,
        sortnumber: 2,
        reversed: null,
        publishdate: PUBLISHED,
      },
      {
        id: IDS.chapterA,
        storyid: IDS.story,
        name: 'Kapitel A',
        lastupdate: null,
        sortnumber: 1,
        reversed: true,
        publishdate: PUBLISHED,
      },
    ];
    // Ohne App-Spalten, obwohl die echte Abfrage sie liefert: die alte Quelle
    // räumt sie im Baum auf der Kapitel-Ebene NICHT weg (siehe Kommentar im
    // Vertrag). Sie hier mitzugeben würde den Vertrag an dieser Altlast
    // scheitern lassen, statt an einer Aussage über die Antwort.
  },

  nothingFound() {
    legacyRows = {};
  },
};

// ---------------------------------------------------------------------------
// Neue Quelle: Zeilen aus node / app_node / content_node / content_item
// ---------------------------------------------------------------------------

const NODE_STORY = {
  id: '000n1',
  name: 'Erste Story',
  description: null,
  sortnumber: 10,
  reversed: null,
  parent_node_id: null,
  cover_node_id: '000n2',
  legacy_id: IDS.story,
  published_date: PUBLISHED,
  is_parent_controls_visibility: null,
};
const NODE_CHAPTER_A = {
  id: '000n2',
  name: 'Kapitel A',
  description: null,
  sortnumber: 1,
  reversed: true,
  parent_node_id: '000n1',
  cover_node_id: null,
  legacy_id: IDS.chapterA,
  published_date: PUBLISHED,
  is_parent_controls_visibility: true,
};
const NODE_CHAPTER_B = {
  ...NODE_CHAPTER_A,
  id: '000n3',
  name: 'Kapitel B',
  sortnumber: 2,
  reversed: null,
  legacy_id: IDS.chapterB,
};

function nodeTree() {
  nodeRows.nodes = [NODE_STORY, NODE_CHAPTER_A, NODE_CHAPTER_B];
  nodeRows.appNodes = [
    { node_id: '000n1', relation: 'include', app_name: APPLICATION_KEY },
  ];
}

const nodeSeed = {
  storyWithTwoChapters: nodeTree,

  chapterWithOneParagraph() {
    nodeTree();
    nodeRows.contentNodes = [
      {
        id: '00cn1',
        name: 'Absatz 1',
        sortnumber: 1,
        legacy_id: IDS.paragraph,
        published_date: PUBLISHED,
        node_id: '000n2',
      },
    ];
  },

  paragraphWithHtml() {
    nodeTree();
    const base = {
      id: '00cn1',
      name: 'Absatz 1',
      sortnumber: 1,
      legacy_id: IDS.paragraph,
      published_date: PUBLISHED,
      node_id: '000n2',
      active_content_item: '00ci2',
    };
    nodeRows.content = [
      {
        ...base,
        item_id: '00ci1',
        item_type: 'text',
        item_content: 'Reiner Text',
      },
      {
        ...base,
        item_id: '00ci2',
        item_type: 'html',
        item_content: '<p>Reiner Text</p>',
      },
    ];
  },

  contentsTree: nodeTree,

  nothingFound() {
    nodeRows = {};
  },
};

describeContentRepositoryContract({
  name: 'LegacyContentRepository (story / chapter / paragraph)',
  createRepository: () =>
    new LegacyContentRepository({
      APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
    }).setApplicationKey(APPLICATION_KEY),
  seed: legacySeed,
});

describeContentRepositoryContract({
  name: 'NodeContentRepository (node / content_node / content_item)',
  createRepository: () =>
    new NodeContentRepository({
      APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
    }).setApplicationKey(APPLICATION_KEY),
  seed: nodeSeed,
});
