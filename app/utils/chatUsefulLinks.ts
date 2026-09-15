import type { UIMessage } from 'ai';

/**
 * The useful-links rail, built from search-shaped tool results in a
 * conversation.
 *
 * Any tool output carrying a `results` array of `{ url, title }` feeds it:
 * `site-search`, `web-search`, the archive lookups. That shape-match is why
 * `video-search` returns its list under `videos`, not `results` (see the note
 * on `videoSearchTool` in `server/agent/tools.ts`) — a video list named
 * `results` would fill this rail and defeat the video one.
 *
 * Lifted out of `ChatWindow.vue` as a pure function, like `selectRailVideos`,
 * so the `/search` answer panel renders the same rail from the same transcript
 * and so the ordering rule has a test.
 */
export interface UsefulLink {
  url: string;
  title: string;
  content: string;
  score: number;
}

export const MAX_USEFUL_LINKS = 5;

export function selectUsefulLinks(messages: UIMessage[]): UsefulLink[] {
  const links: UsefulLink[] = [];

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      // Tool parts are typed `tool-<name>`; the payload lands on `output`
      // once the call resolves.
      const output = (part as any).output;
      if (!output || !Array.isArray(output.results)) continue;

      output.results.forEach((result: any, index: number) => {
        if (!result || typeof result.url !== 'string' || typeof result.title !== 'string') return;
        links.push({
          url: result.url,
          title: result.title,
          content: typeof result.summary === 'string' ? result.summary : (result.content ?? ''),
          // Descending fallback preserves a tool's own ordering when it
          // reports no score. Below 1, so a real score always outranks it.
          score: typeof result.score === 'number' ? result.score : 1 / (index + 2),
        });
      });
    }
  }

  return links.sort((a, b) => b.score - a.score).slice(0, MAX_USEFUL_LINKS);
}
