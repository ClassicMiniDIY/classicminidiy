import { request } from '@octokit/request';
import { DateTime } from 'luxon';
import { ECU_MAPS_REPO, GITHUB_ROUTE_CACHE_HEADERS, type EcuMapsCommit } from '../../../data/models/github';

export default defineEventHandler(async (event): Promise<EcuMapsCommit[]> => {
  const config = useRuntimeConfig();

  try {
    // Create a promise that will reject after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('GitHub API request timed out')), 8000);
    });

    // Define response type
    interface GitHubCommit {
      sha: string;
      commit?: {
        message?: string;
        committer?: {
          date?: string;
        };
      };
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
        owner: ECU_MAPS_REPO.owner,
        repo: ECU_MAPS_REPO.repo,
        request: {
          timeout: 8000, // 8 second timeout
        },
      }),
      timeoutPromise,
    ])) as GitHubResponse;

    // Return only what /maps renders. The raw GitHub commit object (tree, parents,
    // verification, author/committer users) is ~2 KB each and was serialized into
    // the SSR payload for every page view.
    const commits = response.data.map((item: GitHubCommit) => {
      const date = item?.commit?.committer?.date;
      return {
        sha: item.sha,
        // Subject line only — bodies (review-feedback, merge notes) are never shown.
        message: (item?.commit?.message ?? '').split('\n')[0] ?? '',
        committedAt: date ?? null,
        date: date ? DateTime.fromISO(date).toFormat('LLL dd') : 'Missing',
      };
    });
    setResponseHeaders(event, GITHUB_ROUTE_CACHE_HEADERS);
    return commits;
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
