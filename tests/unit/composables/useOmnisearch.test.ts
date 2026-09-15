import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// useOmnisearch — the miss commit.
//
// A miss feeds Most Wanted, which is public once promoted. The contract the
// rule file states: a miss is posted ONCE per query per session, only for a
// query that was actually searched and came back empty, and only on a commit
// (idle, Enter, close, or the results page). This pins each clause.
// ---------------------------------------------------------------------------

const mockRouter = { push: vi.fn() };
(global as any).useRouter = vi.fn(() => mockRouter);
(global as any).useSupabase = vi.fn(() => ({ auth: { getSession: async () => ({ data: { session: null } }) } }));

const fetchMock = vi.fn();
(global as any).$fetch = fetchMock;

const EMPTY = {
  query: '',
  intent: { kind: 'lookup', surfaceOrder: [], askPosition: 'bottom' },
  results: [],
  counts: {},
};
const HIT = {
  ...EMPTY,
  results: [
    {
      surface: 'tools',
      id: 'x',
      title: 'X',
      subtitle: null,
      url: '/x',
      icon: '',
      tag: null,
      contributorUsername: null,
      verified: false,
    },
  ],
};

function missPosts() {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/search/miss').map(([, opts]) => opts.body.q);
}

let useOmnisearch: any;

beforeEach(async () => {
  vi.useFakeTimers();
  mockRouter.push.mockClear();
  vi.resetModules();
  (global as any).__resetNuxtState();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => (url === '/api/search' ? EMPTY : null));
  useOmnisearch = (await import('~~/app/composables/useOmnisearch')).useOmnisearch;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useOmnisearch miss commit', () => {
  it('commits an empty search after the idle window, once', async () => {
    const search = useOmnisearch();
    search.query.value = 'bad wolf';
    await search.runSearch();
    expect(missPosts()).toEqual([]);

    await vi.advanceTimersByTimeAsync(1500);
    expect(missPosts()).toEqual(['bad wolf']);

    // Enter and close after the idle commit are the same miss.
    search.selectHighlighted();
    search.close();
    expect(missPosts()).toEqual(['bad wolf']);
  });

  it('never commits a query that was not searched', async () => {
    const search = useOmnisearch();
    search.query.value = 'bad w';
    await search.runSearch();
    // Typed inside the debounce, no search yet.
    search.query.value = 'bad wolf';
    search.close();
    expect(missPosts()).toEqual([]);
  });

  it('does not commit while a search is in flight', async () => {
    let resolveSearch!: (value: unknown) => void;
    fetchMock.mockImplementation((url: string) =>
      url === '/api/search' ? new Promise((resolve) => (resolveSearch = resolve)) : Promise.resolve(null)
    );
    const search = useOmnisearch();
    search.query.value = 'bad wolf';
    const pending = search.runSearch();
    search.close();
    expect(missPosts()).toEqual([]);
    resolveSearch(EMPTY);
    await pending;
  });

  it('does not commit a query that found something', async () => {
    fetchMock.mockImplementation(async (url: string) => (url === '/api/search' ? HIT : null));
    const search = useOmnisearch();
    search.query.value = 'minilite';
    await search.runSearch();
    await vi.advanceTimersByTimeAsync(1500);
    search.close();
    expect(missPosts()).toEqual([]);
  });

  it('dedupes the results page against the palette, case-insensitively', async () => {
    const search = useOmnisearch();
    search.query.value = 'Bad Wolf';
    await search.runSearch();
    await vi.advanceTimersByTimeAsync(1500);
    search.commitMiss('bad wolf', 'page');
    expect(missPosts()).toEqual(['Bad Wolf']);
  });

  it('askBot with inline returns true only when the quota allows, and never navigates then', async () => {
    const search = useOmnisearch();
    search.query.value = 'how do i bleed the brakes';
    expect(search.askBot('how do i bleed the brakes', { inline: true })).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();

    search.quota.value = { tier: 'anonymous', used: 15, limit: 15 };
    expect(search.askBot('how do i bleed the brakes', { inline: true })).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ path: '/login' }));

    mockRouter.push.mockClear();
    search.quota.value = { tier: 'free', used: 30, limit: 30 };
    expect(search.askBot('how do i bleed the brakes', { inline: true })).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/membership');

    mockRouter.push.mockClear();
    search.quota.value = { tier: 'member', used: 100, limit: 100 };
    expect(search.askBot('how do i bleed the brakes', { inline: true })).toBe(false);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('askBot without inline hands off to /chat with the source', () => {
    const search = useOmnisearch();
    expect(search.askBot('what oil for a 1275')).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith({
      path: '/chat',
      query: { message: 'what oil for a 1275', source: 'omnisearch' },
    });
  });

  it('ignores queries under the RPC floor', () => {
    const search = useOmnisearch();
    search.commitMiss('ab', 'page');
    expect(missPosts()).toEqual([]);
  });
});
