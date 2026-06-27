const { ContentsEndpoint } = require('../ContentsEndpoint');
const { DataFacade } = require('../../../../../database2/DataFacade');

jest.mock('../../../../../database2/DataFacade');
jest.mock('../../../../../modules/logging');

const PAST = '2020-01-01 00:00:00';
const FUTURE = '2999-01-01 00:00:00';

function buildRawTree() {
  return [
    {
      id: 'story-2',
      name: 'Story B',
      sortnumber: 2,
      publishdate: PAST,
      chapters: [
        { id: 'c-b1', storyid: 'story-2', name: 'Chapter B1', sortnumber: 1, publishdate: PAST },
      ],
    },
    {
      id: 'story-1',
      name: 'Story A',
      sortnumber: 1,
      publishdate: PAST,
      chapters: [
        { id: 'c-a1', storyid: 'story-1', name: 'Chapter A1', sortnumber: 1, publishdate: PAST },
        { id: 'c-a2', storyid: 'story-1', name: 'Chapter A2 (draft)', sortnumber: 2, publishdate: FUTURE },
      ],
    },
  ];
}

describe('ContentsEndpoint', () => {
  let endpoint;
  let mockResponseObject;
  let mockEnvironment;
  let mockGetData;
  let mockSetSkipCache;

  beforeEach(() => {
    mockEnvironment = { APPLICATION_APPLICATION_KEY: 'test-key' };
    mockResponseObject = { json: jest.fn() };
    mockGetData = jest.fn().mockResolvedValue(buildRawTree());
    mockSetSkipCache = jest.fn();

    DataFacade.mockImplementation(() => ({
      setSkipCache: mockSetSkipCache,
      getData: mockGetData,
    }));

    endpoint = new ContentsEndpoint();
    endpoint
      .setEnvironment(mockEnvironment)
      .setRequestObject({ query: {} })
      .setResponseObject(mockResponseObject);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('wraps the result as { result: Node[] }', async () => {
    await endpoint.execute();
    const payload = mockResponseObject.json.mock.calls[0][0];
    expect(payload).toHaveProperty('result');
    expect(Array.isArray(payload.result)).toBe(true);
  });

  it('maps records to Nodes with label === name and nested childnodes', async () => {
    await endpoint.execute();
    const { result } = mockResponseObject.json.mock.calls[0][0];

    const node = result[0];
    expect(node).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      label: node.name,
      childnodes: expect.any(Array),
    });
    expect(node.label).toBe(node.name);
    expect(node.childnodes[0].label).toBe(node.childnodes[0].name);
  });

  it('removes unpublished chapters for anonymous requests', async () => {
    await endpoint.execute();
    const { result } = mockResponseObject.json.mock.calls[0][0];

    const storyA = result.find((n) => n.id === 'story-1');
    // draft chapter (future publishdate) is filtered out
    expect(storyA.childnodes.map((c) => c.id)).toEqual(['c-a1']);
  });

  it('keeps unpublished chapters for edit scope and skips the cache', async () => {
    endpoint.setScopes(new Set(['edit']));

    await endpoint.execute();

    expect(mockSetSkipCache).toHaveBeenCalledWith(true);
    const { result } = mockResponseObject.json.mock.calls[0][0];
    const storyA = result.find((n) => n.id === 'story-1');
    expect(storyA.childnodes.map((c) => c.id)).toEqual(['c-a1', 'c-a2']);
  });

  it('does not skip the cache for anonymous requests', async () => {
    await endpoint.execute();
    expect(mockSetSkipCache).not.toHaveBeenCalled();
  });

  it('depth=1 returns stories only (empty childnodes)', async () => {
    endpoint.setRequestObject({ query: { depth: '1' } });

    await endpoint.execute();
    const { result } = mockResponseObject.json.mock.calls[0][0];

    result.forEach((node) => expect(node.childnodes).toEqual([]));
  });

  describe('parseDepth', () => {
    it('defaults to full depth when missing or invalid', () => {
      expect(ContentsEndpoint.parseDepth(undefined)).toBe(2);
      expect(ContentsEndpoint.parseDepth('')).toBe(2);
      expect(ContentsEndpoint.parseDepth('abc')).toBe(2);
      expect(ContentsEndpoint.parseDepth('0')).toBe(2);
      expect(ContentsEndpoint.parseDepth('-3')).toBe(2);
      expect(ContentsEndpoint.parseDepth('1.5')).toBe(2);
    });

    it('clamps to MAX_DEPTH and accepts valid values', () => {
      expect(ContentsEndpoint.parseDepth('1')).toBe(1);
      expect(ContentsEndpoint.parseDepth('2')).toBe(2);
      expect(ContentsEndpoint.parseDepth('9')).toBe(2);
    });
  });
});
