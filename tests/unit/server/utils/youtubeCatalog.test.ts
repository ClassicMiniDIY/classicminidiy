// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetchJson } = vi.hoisted(() => ({ mockFetchJson: vi.fn() }));
vi.mock('~~/server/utils/fetchJsonWithRetry', () => ({ fetchJsonWithRetry: mockFetchJson }));

const { fetchVideoIndex, searchVideoIndex } = await import('~~/server/utils/youtubeCatalog');

/** One playlistItems row, in the shape the YouTube API returns. */
function item(overrides: Record<string, any> = {}) {
  const {
    videoId = 'abcdefghijk',
    title = 'How To Replace A Classic Mini Windscreen',
    description = 'Full walkthrough of removing and refitting the screen.',
    publishedAt = '2024-05-01T10:00:00Z',
    thumbnails = {
      default: { url: 'https://i.ytimg.com/vi/abcdefghijk/default.jpg' },
      maxres: { url: 'https://i.ytimg.com/vi/abcdefghijk/maxres.jpg' },
    },
  } = overrides;
  return { snippet: { title, description, publishedAt, thumbnails, resourceId: { kind: 'youtube#video', videoId } } };
}

describe('fetchVideoIndex', () => {
  beforeEach(() => mockFetchJson.mockReset());

  it('refuses to run without an API key', async () => {
    // A silent empty index would look exactly like "Cole has no videos", which
    // is the one thing this tool must never imply.
    await expect(fetchVideoIndex('')).rejects.toThrow(/not configured/i);
    expect(mockFetchJson).not.toHaveBeenCalled();
  });

  it('walks every page of the uploads playlist', async () => {
    mockFetchJson
      .mockResolvedValueOnce({ items: [item({ videoId: 'aaaaaaaaaaa' })], nextPageToken: 'page-2' })
      .mockResolvedValueOnce({ items: [item({ videoId: 'bbbbbbbbbbb' })], nextPageToken: 'page-3' })
      .mockResolvedValueOnce({ items: [item({ videoId: 'ccccccccccc' })] });

    const index = await fetchVideoIndex('key');

    expect(index).toHaveLength(3);
    expect(mockFetchJson).toHaveBeenCalledTimes(3);
    // The first call carries no pageToken; the rest carry the previous cursor.
    expect(mockFetchJson.mock.calls[0][0]).not.toContain('pageToken');
    expect(mockFetchJson.mock.calls[1][0]).toContain('pageToken=page-2');
    expect(mockFetchJson.mock.calls[2][0]).toContain('pageToken=page-3');
  });

  it('stops at the page ceiling rather than spinning', async () => {
    // A nextPageToken that never clears is a paging bug or a hostile response.
    // Either way it must terminate.
    mockFetchJson.mockResolvedValue({ items: [item()], nextPageToken: 'always' });
    await fetchVideoIndex('key');
    expect(mockFetchJson.mock.calls.length).toBeLessThanOrEqual(12);
  });

  it('aborts on a failed page instead of caching a partial index', async () => {
    // A partial index caches cleanly, looks healthy, and silently makes some of
    // Cole's videos unfindable for twelve hours. Throwing means the previous
    // cached index keeps serving and the run is reported degraded.
    mockFetchJson
      .mockResolvedValueOnce({ items: [item()], nextPageToken: 'page-2' })
      .mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(fetchVideoIndex('key')).rejects.toThrow(/quota exceeded/);
  });

  it('skips deleted and private uploads without aborting', async () => {
    // These stay in the playlist with no resourceId. They are not an error.
    mockFetchJson.mockResolvedValueOnce({
      items: [
        item({ videoId: 'aaaaaaaaaaa' }),
        { snippet: { title: 'Private video', publishedAt: '2024-01-01T00:00:00Z', thumbnails: {} } },
        item({ videoId: 'bbbbbbbbbbb' }),
      ],
    });

    const index = await fetchVideoIndex('key');
    expect(index.map((v) => v.videoId)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa'].sort().reverse().slice(0, 2).sort());
    expect(index).toHaveLength(2);
  });

  it('survives an item with no publishedAt instead of throwing in the sort', async () => {
    // REGRESSION. `publishedAt` is typed as a required string, but this walk
    // already assumes snippets can be incomplete (it guards resourceId and
    // title) and then feeds this field straight to `.localeCompare`. An item
    // missing it threw AFTER all ten pages had been fetched, discarding the
    // whole index and leaving video-search degraded for twelve hours.
    mockFetchJson.mockResolvedValueOnce({
      items: [
        item({ videoId: 'aaaaaaaaaaa' }),
        {
          snippet: {
            title: 'Still processing',
            description: '',
            thumbnails: {},
            resourceId: { videoId: 'bbbbbbbbbbb' },
          },
        },
      ],
    });

    const index = await fetchVideoIndex('key');
    expect(index).toHaveLength(2);
    expect(index.find((v) => v.videoId === 'bbbbbbbbbbb')!.publishedAt).toBe('');
  });

  it('warns rather than silently truncating at the page ceiling', async () => {
    // The doc comment on fetchVideoIndex calls a silently partial index the
    // worst available outcome, and the MAX_PAGES exit was exactly that.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchJson.mockResolvedValue({ items: [item()], nextPageToken: 'always' });

    await fetchVideoIndex('key');

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/truncated/i));
    warn.mockRestore();
  });

  it('truncates descriptions', async () => {
    // Cole's descriptions run to affiliate links and chapter lists. Storing all
    // of it puts ~1MB in KV and makes every match compete against boilerplate
    // that appears in all 466 rows.
    mockFetchJson.mockResolvedValueOnce({ items: [item({ description: 'x'.repeat(5000) })] });
    const [video] = await fetchVideoIndex('key');
    expect(video!.description.length).toBe(400);
  });

  it('returns newest first and takes the best thumbnail available', async () => {
    mockFetchJson.mockResolvedValueOnce({
      items: [
        item({ videoId: 'aaaaaaaaaaa', publishedAt: '2020-01-01T00:00:00Z' }),
        item({
          videoId: 'bbbbbbbbbbb',
          publishedAt: '2026-01-01T00:00:00Z',
          thumbnails: { default: { url: 'https://i.ytimg.com/d.jpg' }, high: { url: 'https://i.ytimg.com/h.jpg' } },
        }),
      ],
    });

    const index = await fetchVideoIndex('key');
    expect(index[0]!.videoId).toBe('bbbbbbbbbbb');
    // maxres absent, standard absent — falls to high, not to default.
    expect(index[0]!.thumbnail).toBe('https://i.ytimg.com/h.jpg');
    expect(index[1]!.thumbnail).toContain('maxres');
    expect(index[0]!.url).toBe('https://www.youtube.com/watch?v=bbbbbbbbbbb');
  });
});

describe('searchVideoIndex', () => {
  const index = [
    {
      videoId: 'aaaaaaaaaaa',
      title: 'How To Replace A Classic Mini Windscreen',
      description: 'Removing the old screen and fitting a new rubber.',
      publishedAt: '2024-05-01T10:00:00Z',
      thumbnail: '',
      url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    },
    {
      videoId: 'bbbbbbbbbbb',
      title: 'Rebuilding A Classic Mini Gearbox',
      description: 'Synchro replacement and selector fork inspection.',
      publishedAt: '2024-06-01T10:00:00Z',
      thumbnail: '',
      url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb',
    },
  ];

  it('ranks a title match above a description match on one shared word', () => {
    // REGRESSION. Scoring the query as a single fuzzy phrase put the gearbox
    // rebuild first here: its description says "Synchro replacement", and that
    // one strong word carried the whole phrase past a video whose TITLE is
    // about windscreens. Scoring word by word is what fixes it — see
    // searchVideoIndex.
    const [hit] = searchVideoIndex(index, 'windscreen replacement', 3);
    expect(hit!.videoId).toBe('aaaaaaaaaaa');
  });

  it('matches on the description, not only the title', () => {
    // "synchro" appears nowhere in a title. Someone describing a grinding
    // gearchange is very likely to type it.
    const [hit] = searchVideoIndex(index, 'synchro', 3);
    expect(hit!.videoId).toBe('bbbbbbbbbbb');
  });

  it('reports score as higher-is-better', () => {
    // Fuse returns a DISTANCE, where 0 is perfect. Everything downstream — the
    // rail's ordering, the model's sense of confidence — reads bigger as
    // better, so the inversion happens exactly once, in this function.
    const [hit] = searchVideoIndex(index, 'gearbox', 3);
    expect(hit!.score).toBeGreaterThan(0.5);
    expect(hit!.score).toBeLessThanOrEqual(1);
  });

  it('honours the limit and survives an empty index', () => {
    expect(searchVideoIndex(index, 'mini', 1)).toHaveLength(1);
    expect(searchVideoIndex([], 'anything', 3)).toEqual([]);
  });

  it('returns nothing for a subject the channel does not cover', () => {
    expect(searchVideoIndex(index, 'quantum chromodynamics', 3)).toEqual([]);
  });
});
