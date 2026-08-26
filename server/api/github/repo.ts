import { request } from '@octokit/request';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  // Set cache headers - cache for 1 hour since repo data changes infrequently
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'CDN-Cache-Control': 'public, max-age=3600',
  });

  try {
    // Create a promise that will reject after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('GitHub API request timed out')), 8000);
    });

    // Race between the actual request and the timeout
    const response = await Promise.race([
      request('GET /repos/{owner}/{repo}', {
        headers: {
          authorization: config.GITHUB_API_KEY,
        },
        owner: 'SomethingNew71',
        repo: 'MiniECUMaps',
        request: {
          timeout: 8000, // 8 second timeout
        },
      }),
      timeoutPromise,
    ]);

    return (response as any).data;
  } catch (error: any) {
    console.error('Error getting GitHub repo:', error);

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
        statusMessage: `Failed to fetch GitHub repository information: ${error.message || 'Unknown error'}`,
      });
    }
  }
});
