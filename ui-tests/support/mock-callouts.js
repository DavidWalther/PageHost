/**
 * Callout-Mocks für die Bookstore-UI-Tests.
 *
 * Die Frontend-App feuert beim Laden mehrere Datencallouts. Da die UI-Tests
 * ohne echtes Backend (Postgres/Redis) laufen, werden diese Callouts hier per
 * `page.route()` abgefangen und mit deterministischen Mock-Bodies beantwortet.
 *
 * Die Datenformen orientieren sich an den echten Fixtures unter
 * `private/database2/tables/mocks/` (Story `000s00000000000011` = "Mock Story 1"),
 * damit die App wie mit echten Daten rendert.
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

const MOCK_ENV_VARIABLES = {
  isMock: true,
  auth: {
    google: {
      clientId: 'mock-client-id',
      redirect_uri: 'http://localhost:3000/',
      scope: 'openid email profile',
      response_type: 'code',
    },
  },
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

const MOCK_CONTENTS = {
  result: [
    {
      id: '000s00000000000011',
      name: 'Mock Story 1',
      sortnumber: 1,
      publishdate: '2022-01-01 00:00:00',
      chapters: MOCK_STORY.chapters,
    },
  ],
};

/**
 * Registriert alle Callout-Mocks für einen Playwright-`page`.
 * Muss vor der Navigation (`page.goto`) aufgerufen werden.
 */
async function mockBookstoreCallouts(page) {
  await page.route('**/metadata', (route) =>
    route.fulfill({ json: MOCK_METADATA })
  );
  await page.route('**/api/1.0/env/variables', (route) =>
    route.fulfill({ json: MOCK_ENV_VARIABLES })
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
  MOCK_ENV_VARIABLES,
  MOCK_STORY,
  MOCK_CHAPTER,
  MOCK_PARAGRAPH,
  MOCK_CONTENTS,
};
