const SitemapEndpointLogic = require('../SitemapEndpointLogic.js');
const { DataFacade } = require('../../../database2/DataFacade.js');

jest.mock('../../../database2/DataFacade.js');
jest.mock('../../../modules/logging');

/**
 * `sitemap.xml` lieferte lange 404, obwohl der `ContentVisibilityFilter` genau
 * dafür als wiederverwendbares Modul gebaut wurde. Diese Suite hält fest, was
 * daraus geworden ist — und vor allem, dass Unveröffentlichtes **nicht** darin
 * steht.
 */

const GESTERN = '2020-01-01T00:00:00.000Z';
const MORGEN = '2999-01-01T00:00:00.000Z';

const ENVIRONMENT = { APPLICATION_APPLICATION_KEY: 'testApp' };

let tree;
let response;

beforeEach(() => {
  tree = [
    {
      id: 'n-wurzel',
      name: 'Wurzel',
      published_date: GESTERN,
      nodes: [
        { id: 'n-kind', name: 'Kind', published_date: GESTERN, nodes: [] },
        {
          id: 'n-kind-morgen',
          name: 'Kind B',
          published_date: MORGEN,
          nodes: [],
        },
      ],
    },
  ];

  DataFacade.mockReset();
  DataFacade.mockImplementation(() => ({
    getData: jest.fn(async () => tree),
  }));

  response = {
    set: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
});

function run() {
  return new SitemapEndpointLogic()
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({
      protocol: 'https',
      get: (name) => (name === 'host' ? 'example.test' : undefined),
    })
    .setResponseObject(response)
    .execute()
    .then(() => response.send.mock.calls[0][0]);
}

describe('SitemapEndpointLogic', () => {
  it('liefert XML statt 404', async () => {
    const xml = await run();

    expect(response.set).toHaveBeenCalledWith(
      'Content-Type',
      'application/xml'
    );
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
  });

  it('nennt jeden veröffentlichten Knoten mit absoluter URL', async () => {
    const xml = await run();

    expect(xml).toContain('<loc>https://example.test/n-wurzel</loc>');
    expect(xml).toContain('<loc>https://example.test/n-kind</loc>');
  });

  it('lässt unveröffentlichte Knoten heraus', async () => {
    const xml = await run();

    expect(xml).not.toContain('n-kind-morgen');
  });

  it('lässt einen unveröffentlichten Teilbaum ganz heraus', async () => {
    // Der Filter verwirft einen versteckten Knoten samt allem darunter.
    tree[0].published_date = null;

    const xml = await run();

    expect(xml).not.toContain('<loc>');
  });

  it('fragt den Inhaltsbaum, nicht die Knoten einzeln', async () => {
    const facade = { getData: jest.fn(async () => tree) };
    DataFacade.mockImplementation(() => facade);

    await run();

    expect(facade.getData).toHaveBeenCalledWith({
      returnPromise: true,
      request: { table: 'contents', id: null },
    });
  });

  it('sammelt Ids Eltern vor Kindern', () => {
    expect(SitemapEndpointLogic.collectIds(tree)).toEqual([
      'n-wurzel',
      'n-kind',
      'n-kind-morgen',
    ]);
  });

  it('kommt mit einem leeren Baum zurecht', async () => {
    tree = [];

    const xml = await run();

    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<loc>');
  });
});
