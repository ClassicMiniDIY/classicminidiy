import type { UIMessage } from 'ai';

/**
 * Which of Cole's videos the rail shows beside an answer.
 *
 * A pure function rather than a computed inside ChatWindow.vue, because the
 * selection rule is subtle enough to have been written wrong once and the
 * component has no test harness — it is a thousand lines with `useChat`, auth
 * and quota wired through it, so the rule could only be checked by driving a
 * browser. Extracting it makes the rule assertable on its own.
 */

export interface ChatVideo {
  videoId: string;
  title: string;
  url: string;
  thumbnail: string;
  publishedAt: string;
  score: number;
}

/**
 * The rail shows a confident match, or nothing.
 *
 * The `video-search` tool deliberately returns weaker matches than this — the
 * model can read a title and decide for itself, and it does. The RAIL cannot. It
 * renders a large thumbnail under "Watch on Classic Mini DIY", which reads as
 * "Cole covered this", and that claim has to be true.
 *
 * Measured on the live channel, the two populations separate cleanly:
 * "windshield replacement" scored the correct video at 0.570, while every
 * incidental match across two different questions landed between 0.307 and
 * 0.339 — a steering rack rebuild offered for a fuel filter question. 0.4 sits
 * in the gap with room on both sides.
 */
export const MIN_RAIL_SCORE = 0.4;

export const MAX_RAIL_VIDEOS = 3;

/**
 * Videos from the LATEST ANSWER only.
 *
 * `usefulLinks` accumulates across the whole conversation and copying that here
 * was wrong for videos. A link rail reads as "things I looked at"; a wall of
 * thumbnails reads as "Cole covered THIS", so a windscreen video left over from
 * two questions ago makes a false claim beside an answer about paint codes.
 *
 * The scope is the last ASSISTANT message, not the last message that happens to
 * carry videos — a distinction that looks pedantic and is the entire fix. The
 * first attempt searched backwards for a message WITH videos, which finds the
 * previous answer whenever the current one ran no video search: exactly the
 * stale-rail case it was meant to close. It was caught by driving the real UI,
 * not by reasoning, which is why this function now has tests.
 *
 * An answer that searched no videos therefore empties the rail. That is the
 * honest outcome: the rail describes this answer or it describes nothing.
 */
export function selectRailVideos(messages: UIMessage[]): ChatVideo[] {
  let latest: UIMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') {
      latest = messages[i];
      break;
    }
  }
  if (!latest) return [];

  const seen = new Set<string>();
  const videos: ChatVideo[] = [];

  for (const part of latest.parts ?? []) {
    // Matched on `output.videos`, which is why `video-search` returns that key
    // rather than `results`: the Useful Links rail matches ANY tool output
    // carrying a `results` array of `{ url, title }`, so a video tool using the
    // conventional name would have filled that rail instead of this one. The
    // two shapes are disjoint on purpose — see server/agent/tools.ts.
    const output = (part as any).output;
    if (!output || !Array.isArray(output.videos)) continue;

    for (const video of output.videos) {
      if (!video || typeof video.videoId !== 'string' || typeof video.url !== 'string') continue;
      if (typeof video.title !== 'string') continue;
      // A multi-step turn can search the channel twice with different wording,
      // and the same video twice in the rail reads as a bug.
      if (seen.has(video.videoId)) continue;
      seen.add(video.videoId);

      videos.push({
        videoId: video.videoId,
        title: video.title,
        url: video.url,
        thumbnail: typeof video.thumbnail === 'string' ? video.thumbnail : '',
        publishedAt: typeof video.publishedAt === 'string' ? video.publishedAt : '',
        score: typeof video.score === 'number' ? video.score : 0,
      });
    }
  }

  return videos
    .filter((video) => video.score >= MIN_RAIL_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RAIL_VIDEOS);
}
