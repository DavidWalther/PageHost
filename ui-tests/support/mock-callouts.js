/**
 * Callout-Mocks für die Bookstore-UI-Tests.
 *
 * Die Frontend-App feuert beim Laden mehrere Datencallouts. Da die UI-Tests
 * ohne echtes Backend (Postgres/Redis) laufen, werden diese Callouts hier per
 * `page.route()` abgefangen und mit deterministischen Mock-Bodies beantwortet.
 *
 * Die Datenformen orientieren sich am echten Datenmodell (Story → Chapter →
 * Paragraph; Story `000s00000000000011` = "Mock Story 1"), damit die App wie
 * mit echten Daten rendert.
 *
 * Auth wird nicht gemockt: Ein frischer Browser-Context hat keine Session
 * (`code_exchange_response`), daher nutzt die App plain `fetch` statt
 * `authenticatedFetch` und ruft den Identity Provider nie auf.
 */

const MOCK_METADATA = {
  pageHeaderHeadline: 'Mock Bookstore',
  metaTitle: 'Mock Bookstore',
  meta: {},
};

const MOCK_STORY = {
  id: '000s00000000000011',
  name: 'Mock Story 1',
  sortnumber: 1,
  publishdate: '2022-01-01 00:00:00',
  chapters: [
    {
      id: '000c00000000000001',
      storyid: '000s00000000000011',
      name: 'Mock Chapter 1 for Story 1',
      sortnumber: 1,
      publishdate: '2022-01-01 00:00:00',
    },
    {
      id: '000c00000000000002',
      storyid: '000s00000000000011',
      name: 'Mock Chapter 2 for Story 1',
      sortnumber: 2,
      publishdate: '2022-01-01 00:00:00',
    },
  ],
};

const MOCK_CHAPTER = {
  id: '000c00000000000001',
  storyid: '000s00000000000011',
  name: 'Mock Chapter 1 for Story 1',
  sortnumber: 1,
  publishdate: '2022-01-01 00:00:00',
  paragraphs: [
    {
      id: '000p00000000000001',
      name: 'Mock Paragraph 1 for Chapter 1 of Story 1',
      sortnumber: 1,
    },
  ],
};

const MOCK_PARAGRAPH = [
  {
    id: '000p00000000000001',
    chapterid: '000c00000000000001',
    storyid: '000s00000000000011',
    name: 'Mock Paragraph 1 for Chapter 1 of Story 1',
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    htmlcontent:
      '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>',
    sortnumber: 1,
    publishdate: '2022-01-01 00:00:00',
  },
];

// Inhaltsbaum wie vom Endpoint `/api/1.0/contents/all` geliefert:
// Node = { id, label, name, childnodes: Node[] } (allowlist, siehe
// private/endpoints/api/1.0/contents/README.md). Zwei Stories, damit das
// Navigations-Modal das Listen *aller* Stories zeigt.
const MOCK_CONTENTS = {
  result: [
    {
      id: '000s00000000000011',
      label: 'Mock Story 1',
      name: 'Mock Story 1',
      childnodes: [
        {
          id: '000c00000000000001',
          label: 'Mock Chapter 1 for Story 1',
          name: 'Mock Chapter 1 for Story 1',
          childnodes: [],
        },
        {
          id: '000c00000000000002',
          label: 'Mock Chapter 2 for Story 1',
          name: 'Mock Chapter 2 for Story 1',
          childnodes: [],
        },
      ],
    },
    {
      id: '000s00000000000012',
      label: 'Mock Story 2',
      name: 'Mock Story 2',
      childnodes: [
        {
          id: '000c00000000000003',
          label: 'Mock Chapter 1 for Story 2',
          name: 'Mock Chapter 1 for Story 2',
          childnodes: [],
        },
      ],
    },
  ],
};

// ─── Typfreie Antwortform (/data/query/node, /data/query/content) ───────────
//
// Die App liest seit dem Frontend-Umbau über Knoten. Die Ids sind hier bewusst
// die ALTEN: der Inhaltsbaum (`/api/1.0/contents/all`) liefert sie so, und das
// Backend löst sie über `legacy_id` auf. Damit bildet der Mock den Zustand ab,
// in dem die App tatsächlich läuft.
//
// Der Wurzelknoten hat Kinder und keine Inhalte, seine Kinder haben Inhalte und
// keine Kinder — genau die Aufteilung, die früher Story und Kapitel hieß.

const MOCK_NODES = {
  '000s00000000000011': {
    id: '000n00000000000011',
    legacy_id: '000s00000000000011',
    name: 'Mock Story 1',
    description: null,
    sortnumber: 1,
    reversed: null,
    parent_node_id: null,
    cover_node_id: '000c00000000000001',
    published_date: '2022-01-01 00:00:00',
    nodes: [
      {
        id: '000c00000000000001',
        legacy_id: '000c00000000000001',
        name: 'Mock Chapter 1 for Story 1',
        description: null,
        sortnumber: 1,
        reversed: null,
        parent_node_id: '000s00000000000011',
        cover_node_id: null,
        published_date: '2022-01-01 00:00:00',
      },
      {
        id: '000c00000000000002',
        legacy_id: '000c00000000000002',
        name: 'Mock Chapter 2 for Story 1',
        description: null,
        sortnumber: 2,
        reversed: null,
        parent_node_id: '000s00000000000011',
        cover_node_id: null,
        published_date: '2022-01-01 00:00:00',
      },
    ],
    contents: [],
  },
  '000c00000000000001': {
    id: '000c00000000000001',
    legacy_id: '000c00000000000001',
    name: 'Mock Chapter 1 for Story 1',
    description: null,
    sortnumber: 1,
    reversed: null,
    parent_node_id: '000s00000000000011',
    cover_node_id: null,
    published_date: '2022-01-01 00:00:00',
    nodes: [],
    contents: [
      {
        id: '000p00000000000001',
        legacy_id: '000p00000000000001',
        name: 'Mock Paragraph 1 for Chapter 1 of Story 1',
        sortnumber: 1,
        published_date: '2022-01-01 00:00:00',
      },
    ],
  },
  '000c00000000000002': {
    id: '000c00000000000002',
    legacy_id: '000c00000000000002',
    name: 'Mock Chapter 2 for Story 1',
    description: null,
    sortnumber: 2,
    reversed: null,
    parent_node_id: '000s00000000000011',
    cover_node_id: null,
    published_date: '2022-01-01 00:00:00',
    nodes: [],
    contents: [],
  },
};

const MOCK_CONTENT = {
  id: '000p00000000000001',
  legacy_id: '000p00000000000001',
  name: 'Mock Paragraph 1 for Chapter 1 of Story 1',
  sortnumber: 1,
  published_date: '2022-01-01 00:00:00',
  node_id: '000c00000000000001',
  active_content_item: '00ci00000000000002',
  active_type: 'html',
  items: [
    {
      id: '00ci00000000000001',
      type: 'text',
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    },
    {
      id: '00ci00000000000002',
      type: 'html',
      content:
        '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>',
    },
  ],
};

/** Unbekannte Id → leeres Objekt, genau wie der echte Endpunkt. */
function nodeFor(url) {
  const id = new URL(url).searchParams.get('id');
  return MOCK_NODES[id] || {};
}

/**
 * Registriert alle Callout-Mocks für einen Playwright-`page`.
 * Muss vor der Navigation (`page.goto`) aufgerufen werden.
 */
async function mockBookstoreCallouts(page) {
  await page.route('**/data/query/node**', (route) =>
    route.fulfill({ json: nodeFor(route.request().url()) })
  );
  await page.route('**/data/query/content**', (route) =>
    route.fulfill({ json: MOCK_CONTENT })
  );
  await page.route('**/metadata', (route) =>
    route.fulfill({ json: MOCK_METADATA })
  );
  await page.route('**/api/1.0/contents/**', (route) =>
    route.fulfill({ json: MOCK_CONTENTS })
  );
  await page.route('**/data/query/story**', (route) =>
    route.fulfill({ json: MOCK_STORY })
  );
  await page.route('**/data/query/chapter**', (route) =>
    route.fulfill({ json: MOCK_CHAPTER })
  );
  await page.route('**/data/query/paragraph**', (route) =>
    route.fulfill({ json: MOCK_PARAGRAPH })
  );
}

module.exports = {
  mockBookstoreCallouts,
  MOCK_METADATA,
  MOCK_STORY,
  MOCK_CHAPTER,
  MOCK_PARAGRAPH,
  MOCK_CONTENTS,
  MOCK_NODES,
  MOCK_CONTENT,
};
