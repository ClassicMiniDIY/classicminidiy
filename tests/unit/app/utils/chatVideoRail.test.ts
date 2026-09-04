// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UIMessage } from 'ai';
import { selectRailVideos, MIN_RAIL_SCORE } from '~/utils/chatVideoRail';

/**
 * The video rail's selection rule.
 *
 * Extracted from ChatWindow.vue and tested here because it was written wrong
 * once and the component has no harness to have caught it — a thousand lines
 * with `useChat`, auth and quota wired through, so the bug was only visible by
 * driving a real browser.
 */
function video(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    videoId: 'aaaaaaaaaaa',
    title: 'How To - Install a Classic Mini Windshield',
    url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    thumbnail: 'https://i.ytimg.com/vi/aaaaaaaaaaa/maxresdefault.jpg',
    publishedAt: '2023-12-26T01:39:50Z',
    score: 0.57,
    ...overrides,
  };
}

function assistantWithVideos(videos: unknown[], id = 'a1'): UIMessage {
  return { id, role: 'assistant', parts: [{ type: 'tool-video-search', output: { videos } } as any] } as UIMessage;
}

function assistantText(text: string, id = 'a2'): UIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text } as any] } as UIMessage;
}

function user(text: string, id = 'u1'): UIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text } as any] } as UIMessage;
}

describe('selectRailVideos', () => {
  it('shows the videos the latest answer found', () => {
    const rail = selectRailVideos([user('how do i fit a windscreen'), assistantWithVideos([video()])]);
    expect(rail).toHaveLength(1);
    expect(rail[0]!.videoId).toBe('aaaaaaaaaaa');
  });

  it('empties when the latest answer searched no videos', () => {
    // REGRESSION, and the exact bug the extraction exists for. The first fix
    // searched backwards for the most recent message WITH videos, which finds
    // the PREVIOUS answer whenever the current one ran no video search — so a
    // windscreen video stayed in the rail through an answer about paint codes,
    // claiming "Cole covered this" about a question he had not been asked.
    const rail = selectRailVideos([
      user('how do i fit a windscreen'),
      assistantWithVideos([video()]),
      user('what is the paint code for Almond Green'),
      assistantText('There are two archive entries for Almond Green.'),
    ]);
    expect(rail).toEqual([]);
  });

  it('replaces the previous answer’s videos rather than adding to them', () => {
    const rail = selectRailVideos([
      user('windscreen'),
      assistantWithVideos([video()], 'a1'),
      user('gearbox'),
      assistantWithVideos([video({ videoId: 'bbbbbbbbbbb', title: 'Gearbox Rebuild' })], 'a2'),
    ]);
    expect(rail.map((v) => v.videoId)).toEqual(['bbbbbbbbbbb']);
  });

  it('drops matches the rail cannot honestly claim', () => {
    // The tool returns weaker matches on purpose so the model can judge them.
    // The rail renders a large thumbnail under "Watch on Classic Mini DIY",
    // which reads as "Cole covered this" — measured live, incidental matches
    // land around 0.31 and a real one at 0.57.
    const rail = selectRailVideos([
      assistantWithVideos([
        video({ videoId: 'aaaaaaaaaaa', score: 0.57 }),
        video({ videoId: 'bbbbbbbbbbb', score: 0.31 }),
        video({ videoId: 'ccccccccccc', score: MIN_RAIL_SCORE }),
      ]),
    ]);
    // The boundary is inclusive; only the genuinely weak match goes.
    expect(rail.map((v) => v.videoId)).toEqual(['aaaaaaaaaaa', 'ccccccccccc']);
  });

  it('sorts by score and caps the rail', () => {
    const rail = selectRailVideos([
      assistantWithVideos([
        video({ videoId: 'aaaaaaaaaaa', score: 0.5 }),
        video({ videoId: 'bbbbbbbbbbb', score: 0.9 }),
        video({ videoId: 'ccccccccccc', score: 0.7 }),
        video({ videoId: 'ddddddddddd', score: 0.6 }),
      ]),
    ]);
    expect(rail.map((v) => v.videoId)).toEqual(['bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd']);
  });

  it('deduplicates a video found by two searches in one turn', () => {
    // A multi-step turn can search the channel twice with different wording.
    const rail = selectRailVideos([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'tool-video-search', output: { videos: [video()] } },
          { type: 'tool-video-search', output: { videos: [video()] } },
        ],
      } as any,
    ]);
    expect(rail).toHaveLength(1);
  });

  it('ignores a tool result shaped like the Useful Links rail', () => {
    // `video-search` returns `videos`; `site-search` returns `results`. The two
    // shapes are disjoint on purpose so neither rail can steal the other's rows.
    const rail = selectRailVideos([
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'tool-site-search', output: { results: [{ url: 'https://x', title: 'A page' }] } }],
      } as any,
    ]);
    expect(rail).toEqual([]);
  });

  it('skips malformed rows without dropping the good ones', () => {
    const rail = selectRailVideos([
      assistantWithVideos([null, { videoId: 'x' }, video({ videoId: 'bbbbbbbbbbb' }), { title: 'no id' }]),
    ]);
    expect(rail.map((v) => v.videoId)).toEqual(['bbbbbbbbbbb']);
  });

  it('returns nothing for an empty or user-only conversation', () => {
    expect(selectRailVideos([])).toEqual([]);
    expect(selectRailVideos([user('hello')])).toEqual([]);
  });
});
