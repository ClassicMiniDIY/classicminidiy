import { request } from '@octokit/request';
import * as _ from 'lodash';
import { DateTime } from 'luxon';

export default defineEventHandler(async (event): Promise<any> => {
  const config = useRuntimeConfig();

  // Set cache headers - cache for 30 minutes since GitHub data changes occasionally
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    'CDN-Cache-Control': 'public, max-age=1800',
  });

  try {
    // Create a promise that will reject after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('GitHub API request timed out')), 8000);
    });

    // Define response type
    interface GitHubCommit {
      commit?: {
        committer?: {
          date?: string;
        };
      };
      [key: string]: any;
    }

    interface GitHubResponse {
      data: GitHubCommit[];
    }

    // Race between the actual request and the timeout
    const response = (await Promise.race([
      request('GET /repos/{owner}/{repo}/commits', {
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
    ])) as GitHubResponse;

    // Process the data
    return response.data.map((item: GitHubCommit) => {
      const date = item?.commit?.committer?.date;
      return {
        ...item,
        date: date ? DateTime.fromISO(date).toFormat('LLL dd') : 'Missing',
      };
    });
  } catch (error: any) {
    console.error(`Error getting GitHub commits:`, error);

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
        statusMessage: `Failed to fetch GitHub commits: ${error.message || 'Unknown error'}`,
      });
    }
  }
});
