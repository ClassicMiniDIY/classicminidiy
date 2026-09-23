import { request } from '@octokit/request';
import {
  ECU_MAPS_REPO,
  GITHUB_ROUTE_CACHE_HEADERS,
  type IGithubReleaseParsedResponse,
  type ReleaseItem,
} from '../../../data/models/github';

export default defineEventHandler(async (event): Promise<IGithubReleaseParsedResponse> => {
  const config = useRuntimeConfig();

  try {
    // Create a promise that will reject after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('GitHub API request timed out')), 8000);
    });

    // Race between the actual request and the timeout
    const response = await Promise.race([
      request('GET /repos/{owner}/{repo}/releases', {
        headers: { authorization: config.GITHUB_API_KEY },
        owner: ECU_MAPS_REPO.owner,
        repo: ECU_MAPS_REPO.repo,
        request: {
          timeout: 8000, // 8 second timeout
        },
      }),
      timeoutPromise,
    ]);

    // Type assertion to any as an intermediate step to avoid type errors
    // Drafts are only visible to a token with push access. Never surface them —
    // they are unpublished by definition.
    const responseData = ((response as any).data as ReleaseItem[])
      .filter((release) => !release.draft)
      .map(({ tag_name, name, html_url, published_at, created_at }) => ({
        tag_name,
        name,
        html_url,
        published_at,
        created_at,
      }));

    const parsed: IGithubReleaseParsedResponse = {
      // null (not a placeholder string) so /maps can hide the "Latest Release" line.
      latestRelease: responseData[0]?.tag_name || null,
      releases: responseData,
    };
    setResponseHeaders(event, GITHUB_ROUTE_CACHE_HEADERS);
    return parsed;
  } catch (error: any) {
    console.error('Error getting GitHub releases:', error);

    // Handle different error types
    if (error.status) {
      throw createError({
        statusCode: error.status,
        statusMessage: `GitHub API error: ${error.message || 'Unknown error'}`,
      });
    } else if (error.message?.includes('timed out')) {
      throw createError({
        statusCode: 504,
        statusMessage: 'GitHub API request timed out',
      });
    } else {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch GitHub releases: ${error.message || 'Unknown error'}`,
      });
    }
  }
});
