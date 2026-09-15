/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// runOmnisearch — the merge of every surface behind /api/search and the chat
// agent's site-search tool.
//
// The Postgres RPC, the parts guard and the video index are all mocked; what
// is under test is the in-process half: per-word ranking of the static
// sources, the query-shaped surface order, the new surfaces appearing at all,
// and the ABSENCE of miss recording on the search call (misses are posted by
// the client on a commit — see server/api/search/miss.post.ts).
// ---------------------------------------------------------------------------

const { mockRpc, mockLoadSources, mockSearchVisibleParts, mockGetVideoIndex, mockSearchVideoIndex } = vi.hoisted(
  () => ({
    mockRpc: vi.fn(),
    mockLoadSources: vi.fn(),
    mockSearchVisibleParts: vi.fn(),
    mockGetVideoIndex: vi.fn(),
    mockSearchVideoIndex: vi.fn(),
  })
);

vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: () => ({ rpc: mockRpc }),
}));
vi.mock('~~/server/utils/partsSearch', () => ({
  loadVisiblePartSources: mockLoadSources,
  searchVisibleParts: mockSearchVisibleParts,
  findVisiblePart: vi.fn().mockResolvedValue(null),
}));
vi.mock('~~/server/utils/youtubeCatalog', () => ({
  getVideoIndex: mockGetVideoIndex,
  searchVideoIndex: mockSearchVideoIndex,
}));

const { runOmnisearch } = await import('~~/server/utils/omnisearch');

const SOURCES = { visible: [], visibleIds: ['src-1'], sourceById: new Map() };

const VIDEO = {
  videoId: 'abc123',
  title: 'How To Bleed Your Brakes',
  description: 'Bleeding the brakes on a classic Mini.',
  publishedAt: '2023-04-01T00:00:00Z',
  thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
  url: 'https://www.youtube.com/watch?v=abc123',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: [], error: null });
  mockLoadSources.mockResolvedValue(SOURCES);
  mockSearchVisibleParts.mockResolvedValue([]);
  mockGetVideoIndex.mockResolvedValue([VIDEO]);
  mockSearchVideoIndex.mockReturnValue([]);
});

describe('runOmnisearch', () => {
  it('returns the intent alongside the results, even for a too-short query', async () => {
    const response = await runOmnisearch('a');
    expect(response.total).toBe(0);
    expect(response.intent.kind).toBe('lookup');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('matches a tool one word at a time, so "comp ratio" finds the compression calculator', async () => {
    const response = await runOmnisearch('comp ratio');
    const tools = response.results.filter((result) => result.surface === 'tools');
    expect(tools[0]?.url).toBe('/technical/compression');
  });

  it('reaches a hyphenated synonym typed with its hyphen', async () => {
    // `lb-ft` is a searchTerm on Torque Specs. The query is split like the
    // text, so the hyphen is a word boundary on both sides.
    const response = await runOmnisearch('lb-ft');
    expect(response.results.find((result) => result.surface === 'tools')?.url).toBe('/technical/torque');
  });

  it('does not let one common word drag in every tool', async () => {
    // "spot light bracket": no tool matches two of three words, so no tool
    // should come back merely because a summary contains "light".
    const response = await runOmnisearch('spot light bracket');
    expect(response.results.filter((result) => result.surface === 'tools')).toEqual([]);
  });

  it('never records a miss from the search call', async () => {
    await runOmnisearch('nothing matches this');
    const rpcNames = mockRpc.mock.calls.map(([name]) => name);
    expect(rpcNames).toEqual(['omnisearch']);
  });

  it('adds the parts surface through the shared kill-switch helper', async () => {
    mockSearchVisibleParts.mockResolvedValue([
      {
        partNumber: '12G940',
        slug: '12G940',
        description: 'Cylinder head',
        kind: null,
        system: 'Engine',
        sourceName: 'Mini Spares',
      },
    ]);
    const response = await runOmnisearch('12g940');
    const parts = response.results.filter((result) => result.surface === 'parts');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ title: '12G940', tag: 'Mini Spares', url: '/archive/parts?q=12G940' });
    // The source list is read once and handed in; the surface does not reload it.
    expect(mockLoadSources).toHaveBeenCalledTimes(1);
    expect(mockSearchVisibleParts).toHaveBeenCalledWith(expect.anything(), '12g940', expect.any(Number), SOURCES);
    // A part number leads with parts.
    expect(response.results[0]?.surface).toBe('parts');
    expect(response.counts.parts).toBe(1);
  });

  it('adds the video surface only when a YouTube key is supplied', async () => {
    mockSearchVideoIndex.mockReturnValue([{ ...VIDEO, score: 0.9 }]);

    const withoutKey = await runOmnisearch('how do i bleed the brakes');
    expect(withoutKey.results.filter((result) => result.surface === 'videos')).toEqual([]);
    expect(mockGetVideoIndex).not.toHaveBeenCalled();

    const withKey = await runOmnisearch('how do i bleed the brakes', undefined, { youtubeApiKey: 'key' });
    const videos = withKey.results.filter((result) => result.surface === 'videos');
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ id: 'abc123', url: VIDEO.url, icon: VIDEO.thumbnail, tag: 'Video' });
    // A question leads with videos.
    expect(withKey.results[0]?.surface).toBe('videos');
  });

  it('survives the video index being unavailable', async () => {
    mockGetVideoIndex.mockRejectedValue(new Error('quota exceeded'));
    const response = await runOmnisearch('brake bleeding', undefined, { youtubeApiKey: 'key' });
    expect(response.results.filter((result) => result.surface === 'videos')).toEqual([]);
  });

  it('finds a supplier by tag and region', async () => {
    const japan = await runOmnisearch('japan');
    expect(japan.results.some((result) => result.surface === 'suppliers')).toBe(true);
    const panels = await runOmnisearch('body panels');
    expect(panels.results.some((result) => result.surface === 'suppliers')).toBe(true);
    expect(panels.results.find((result) => result.surface === 'suppliers')?.url).toMatch(/^\/archive\/suppliers#/);
  });

  it('keeps the original order for a plain lookup', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          surface: 'wheels',
          id: 'w1',
          title: 'Minilite',
          subtitle: null,
          url: '/archive/wheels/w1',
          icon: 'fas fa-circle',
          tag: null,
          contributor_username: null,
          verified: true,
        },
        {
          surface: 'exchange',
          id: 'l1',
          title: 'Minilite set',
          subtitle: null,
          url: '/exchange/listings/l1',
          icon: 'fas fa-tag',
          tag: null,
          contributor_username: null,
          verified: false,
        },
      ],
      error: null,
    });
    const response = await runOmnisearch('minilite');
    const surfaces = response.results.map((result) => result.surface);
    expect(surfaces.indexOf('wheels')).toBeLessThan(surfaces.indexOf('exchange'));
  });

  it('fails the search only when the core RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(runOmnisearch('wheels')).rejects.toMatchObject({ statusCode: 502 });
  });
});
