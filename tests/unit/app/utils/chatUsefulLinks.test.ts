// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UIMessage } from 'ai';
import { selectUsefulLinks, MAX_USEFUL_LINKS } from '~/utils/chatUsefulLinks';

/**
 * The useful-links rail's selection rule, lifted from ChatWindow.vue so the
 * /search answer panel shares it and so the ordering rule has a test.
 */
function assistantWithResults(results: unknown[], id = 'a1', tool = 'tool-site-search'): UIMessage {
  return { id, role: 'assistant', parts: [{ type: tool, output: { results } } as any] } as UIMessage;
}

describe('selectUsefulLinks', () => {
  it('collects { url, title } results from any tool part and ranks by score', () => {
    const links = selectUsefulLinks([
      assistantWithResults([
        { url: '/a', title: 'A', score: 0.2 },
        { url: '/b', title: 'B', score: 0.9, summary: 'about b' },
      ]),
    ]);
    expect(links.map((link) => link.url)).toEqual(['/b', '/a']);
    expect(links[0]?.content).toBe('about b');
  });

  it("keeps a tool's own order when it reports no score (1/(index+2)), under a strong real score", () => {
    const links = selectUsefulLinks([
      assistantWithResults([
        { url: '/first', title: 'First' },
        { url: '/second', title: 'Second' },
        { url: '/scored', title: 'Scored', score: 0.9 },
      ]),
    ]);
    expect(links.map((link) => link.url)).toEqual(['/scored', '/first', '/second']);
    expect(links.map((link) => link.score)).toEqual([0.9, 0.5, 1 / 3]);
  });

  it('skips malformed results and caps the rail', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ url: `/${i}`, title: `T${i}`, score: i / 10 }));
    const links = selectUsefulLinks([
      assistantWithResults([null, { url: 5, title: 'no' }, { title: 'no url' }, ...many]),
    ]);
    expect(links).toHaveLength(MAX_USEFUL_LINKS);
    expect(links[0]?.url).toBe('/9');
  });

  it('ignores a `videos` payload — that is the video rail, not this one', () => {
    const message = {
      id: 'v',
      role: 'assistant',
      parts: [{ type: 'tool-video-search', output: { videos: [{ url: 'x', title: 'y' }] } } as any],
    } as UIMessage;
    expect(selectUsefulLinks([message])).toEqual([]);
  });
});
