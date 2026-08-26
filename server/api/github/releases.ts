import { request } from '@octokit/request';
import type { IGithubReleaseParsedResponse, ReleaseItem } from '../../../data/models/github';

export default defineEventHandler(async (event): Promise<IGithubReleaseParsedResponse> => {
  const config = useRuntimeConfig();

  // Set cache headers - cache for 30 minutes since GitHub data changes occasionally
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    'CDN-Cache-Control': 'public, max-age=1800',
  });

  try {
    // Create a promise that will reject after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('GitHub API request timed out')), 8000);
    });

    // Race between the actual request and the timeout
    const response = await Promise.race([
      request('GET /repos/{owner}/{repo}/releases', {
        headers: { authorization: config.GITHUB_API_KEY },
        owner: 'SomethingNew71',
        repo: 'MiniECUMaps',
        request: {
          timeout: 8000, // 8 second timeout
        },
      }),
      timeoutPromise,
    ]);

    // Type assertion to any as an intermediate step to avoid type errors
    const responseData = (response as any).data as ReleaseItem[];

    const parsed: IGithubReleaseParsedResponse = {
      latestRelease: responseData[0]?.tag_name || 'No releases',
      releases: responseData,
    };
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
