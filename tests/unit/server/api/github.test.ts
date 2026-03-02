/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock setup so it runs before any imports
const { mockRequest } = vi.hoisted(() => {
  const mockRequest = vi.fn();

  // Nitro globals
  (globalThis as any).defineEventHandler = (fn: any) => fn;
  (globalThis as any).createError = (opts: any) => {
    const err: any = new Error(opts.statusMessage || opts.message);
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage;
    return err;
  };
  (globalThis as any).useRuntimeConfig = () => ({
    githubAPIKey: 'test-gh-key',
  });
  (globalThis as any).setResponseHeaders = vi.fn();

  return { mockRequest };
});

vi.mock('@octokit/request', () => ({
  request: mockRequest,
}));

vi.mock('lodash', () => ({
  default: {},
}));

// ─── GitHub Commits ──────────────────────────────────────────────────────────

describe('server/api/github/commits', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    mockRequest.mockReset();
    (globalThis as any).setResponseHeaders = vi.fn();

    const mod = await import('~/server/api/github/commits');
    handler = mod.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeCommit(sha: string, message: string, date?: string) {
    return {
      sha,
      commit: {
        message,
        committer: date ? { date, name: 'Test User', email: 'test@test.com' } : undefined,
      },
      author: { login: 'testuser' },
      html_url: `https://github.com/SomethingNew71/MiniECUMaps/commit/${sha}`,
    };
  }

  it('returns mapped commits with formatted dates', async () => {
    const commits = [
      makeCommit('abc123', 'Fix bug', '2024-01-15T10:30:00Z'),
      makeCommit('def456', 'Add feature', '2024-03-20T15:00:00Z'),
    ];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result).toHaveLength(2);
    expect(result[0].sha).toBe('abc123');
    expect(result[1].sha).toBe('def456');
  });

  it('formats dates as "LLL dd" (e.g. "Jan 15")', async () => {
    const commits = [makeCommit('a1', 'Test', '2024-01-15T10:30:00Z')];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result[0].date).toBe('Jan 15');
  });

  it('formats December date correctly', async () => {
    // Use midday UTC to avoid timezone day-shift issues
    const commits = [makeCommit('a1', 'Test', '2023-12-25T12:00:00Z')];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result[0].date).toBe('Dec 25');
  });

  it('formats June date correctly', async () => {
    const commits = [makeCommit('a1', 'Test', '2025-06-01T12:00:00Z')];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result[0].date).toBe('Jun 01');
  });

  it('formats March date correctly', async () => {
    const commits = [makeCommit('a1', 'Test', '2024-03-07T08:00:00Z')];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result[0].date).toBe('Mar 07');
  });

  it('returns "Missing" when committer date is absent', async () => {
    const commits = [makeCommit('a1', 'No date commit')];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result[0].date).toBe('Missing');
  });

  it('returns "Missing" when commit.committer is undefined', async () => {
    const commit = {
      sha: 'nocommitter',
      commit: { message: 'test' },
      author: { login: 'user' },
    };
    mockRequest.mockResolvedValueOnce({ data: [commit] });
    const result = await handler({});
    expect(result[0].date).toBe('Missing');
  });

  it('returns "Missing" when commit property is undefined', async () => {
    const commit = { sha: 'nocommit', author: { login: 'user' } };
    mockRequest.mockResolvedValueOnce({ data: [commit] });
    const result = await handler({});
    expect(result[0].date).toBe('Missing');
  });

  it('preserves original commit fields via spread', async () => {
    const commits = [makeCommit('abc123', 'Fix bug', '2024-01-15T10:30:00Z')];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result[0].sha).toBe('abc123');
    expect(result[0].commit.message).toBe('Fix bug');
    expect(result[0].html_url).toContain('abc123');
  });

  it('sets cache headers with 30 minute max-age', async () => {
    mockRequest.mockResolvedValueOnce({ data: [] });
    const mockEvent = { id: 'test' };
    await handler(mockEvent);
    expect((globalThis as any).setResponseHeaders).toHaveBeenCalledWith(mockEvent, {
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      'CDN-Cache-Control': 'public, max-age=1800',
    });
  });

  it('returns empty array when no commits exist', async () => {
    mockRequest.mockResolvedValueOnce({ data: [] });
    const result = await handler({});
    expect(result).toEqual([]);
  });

  it('throws with API status code on status errors (404)', async () => {
    const apiError: any = new Error('Not Found');
    apiError.status = 404;
    mockRequest.mockRejectedValueOnce(apiError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(404);
      expect(error.statusMessage).toContain('GitHub API error');
    }
  });

  it('throws with 403 status on forbidden errors', async () => {
    const apiError: any = new Error('Forbidden');
    apiError.status = 403;
    mockRequest.mockRejectedValueOnce(apiError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(403);
    }
  });

  it('throws 504 on timeout errors', async () => {
    const timeoutError = new Error('GitHub API request timed out');
    mockRequest.mockRejectedValueOnce(timeoutError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(504);
      expect(error.statusMessage).toContain('timed out');
    }
  });

  it('throws 500 on generic errors', async () => {
    mockRequest.mockRejectedValueOnce(new Error('something unexpected'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(500);
      expect(error.statusMessage).toContain('Failed to fetch GitHub commits');
    }
  });

  it('includes error message in generic error response', async () => {
    mockRequest.mockRejectedValueOnce(new Error('custom failure'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusMessage).toContain('custom failure');
    }
  });

  it('handles multiple commits with mixed date availability', async () => {
    // Use midday UTC times to avoid timezone day-shift issues
    const commits = [
      makeCommit('a1', 'Has date', '2024-05-10T12:00:00Z'),
      makeCommit('a2', 'No date'),
      makeCommit('a3', 'Also has date', '2024-11-30T12:00:00Z'),
    ];
    mockRequest.mockResolvedValueOnce({ data: commits });
    const result = await handler({});
    expect(result[0].date).toBe('May 10');
    expect(result[1].date).toBe('Missing');
    expect(result[2].date).toBe('Nov 30');
  });

  it('passes authorization header and correct repo in request', async () => {
    mockRequest.mockResolvedValueOnce({ data: [] });
    await handler({});
    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/commits',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'test-gh-key',
        }),
        owner: 'SomethingNew71',
        repo: 'MiniECUMaps',
      }),
    );
  });
});

// ─── GitHub Releases ─────────────────────────────────────────────────────────

describe('server/api/github/releases', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    mockRequest.mockReset();
    (globalThis as any).setResponseHeaders = vi.fn();

    const mod = await import('~/server/api/github/releases');
    handler = mod.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeRelease(tagName: string, name: string, id: number) {
    return {
      url: `https://api.github.com/repos/SomethingNew71/MiniECUMaps/releases/${id}`,
      assets_url: null,
      upload_url: null,
      html_url: `https://github.com/SomethingNew71/MiniECUMaps/releases/tag/${tagName}`,
      id,
      author: { login: 'SomethingNew71' },
      node_id: `node-${id}`,
      tag_name: tagName,
      target_commitish: 'main',
      name,
      draft: false,
      prerelease: false,
      created_at: '2024-01-01T00:00:00Z',
      published_at: '2024-01-01T00:00:00Z',
      assets: [],
      tarball_url: null,
      zipball_url: null,
      body: 'Release notes',
    };
  }

  it('returns an object with latestRelease and releases keys', async () => {
    const releases = [makeRelease('v1.2.0', 'Release 1.2.0', 1)];
    mockRequest.mockResolvedValueOnce({ data: releases });
    const result = await handler({});
    expect(result).toHaveProperty('latestRelease');
    expect(result).toHaveProperty('releases');
  });

  it('latestRelease is the tag_name of the first release', async () => {
    const releases = [
      makeRelease('v2.0.0', 'Latest', 2),
      makeRelease('v1.0.0', 'Older', 1),
    ];
    mockRequest.mockResolvedValueOnce({ data: releases });
    const result = await handler({});
    expect(result.latestRelease).toBe('v2.0.0');
  });

  it('releases array contains all releases from API', async () => {
    const releases = [
      makeRelease('v3.0.0', 'Three', 3),
      makeRelease('v2.0.0', 'Two', 2),
      makeRelease('v1.0.0', 'One', 1),
    ];
    mockRequest.mockResolvedValueOnce({ data: releases });
    const result = await handler({});
    expect(result.releases).toHaveLength(3);
    expect(result.releases[0].tag_name).toBe('v3.0.0');
    expect(result.releases[2].tag_name).toBe('v1.0.0');
  });

  it('returns a single release correctly', async () => {
    const releases = [makeRelease('v1.0.0', 'Initial', 1)];
    mockRequest.mockResolvedValueOnce({ data: releases });
    const result = await handler({});
    expect(result.latestRelease).toBe('v1.0.0');
    expect(result.releases).toHaveLength(1);
  });

  it('returns "No releases" when releases array is empty', async () => {
    mockRequest.mockResolvedValueOnce({ data: [] });
    const result = await handler({});
    expect(result.latestRelease).toBe('No releases');
    expect(result.releases).toEqual([]);
  });

  it('sets cache headers with 30 minute max-age', async () => {
    mockRequest.mockResolvedValueOnce({ data: [] });
    const mockEvent = { id: 'test' };
    await handler(mockEvent);
    expect((globalThis as any).setResponseHeaders).toHaveBeenCalledWith(mockEvent, {
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      'CDN-Cache-Control': 'public, max-age=1800',
    });
  });

  it('throws with API status code on status errors (404)', async () => {
    const apiError: any = new Error('Not Found');
    apiError.status = 404;
    mockRequest.mockRejectedValueOnce(apiError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(404);
      expect(error.statusMessage).toContain('GitHub API error');
    }
  });

  it('throws with 401 on unauthorized errors', async () => {
    const apiError: any = new Error('Bad credentials');
    apiError.status = 401;
    mockRequest.mockRejectedValueOnce(apiError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(401);
    }
  });

  it('throws 504 on timeout errors', async () => {
    const timeoutError = new Error('GitHub API request timed out');
    mockRequest.mockRejectedValueOnce(timeoutError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(504);
      expect(error.statusMessage).toContain('timed out');
    }
  });

  it('throws 500 on generic errors', async () => {
    mockRequest.mockRejectedValueOnce(new Error('unexpected failure'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(500);
      expect(error.statusMessage).toContain('Failed to fetch GitHub releases');
    }
  });

  it('includes error message in generic error response', async () => {
    mockRequest.mockRejectedValueOnce(new Error('specific error detail'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusMessage).toContain('specific error detail');
    }
  });

  it('handles release with null tag_name gracefully', async () => {
    const release = makeRelease('v1.0.0', 'Test', 1);
    release.tag_name = null as any;
    mockRequest.mockResolvedValueOnce({ data: [release] });
    const result = await handler({});
    expect(result.latestRelease).toBe('No releases');
  });

  it('passes authorization header and correct repo in request', async () => {
    mockRequest.mockResolvedValueOnce({ data: [] });
    await handler({});
    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/releases',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'test-gh-key',
        }),
        owner: 'SomethingNew71',
        repo: 'MiniECUMaps',
      }),
    );
  });

  it('response structure matches IGithubReleaseParsedResponse shape', async () => {
    const releases = [makeRelease('v1.0.0', 'First', 1)];
    mockRequest.mockResolvedValueOnce({ data: releases });
    const result = await handler({});
    expect(typeof result.latestRelease).toBe('string');
    expect(Array.isArray(result.releases)).toBe(true);
    const release = result.releases[0];
    expect(release).toHaveProperty('tag_name');
    expect(release).toHaveProperty('name');
    expect(release).toHaveProperty('id');
    expect(release).toHaveProperty('draft');
    expect(release).toHaveProperty('prerelease');
  });
});
