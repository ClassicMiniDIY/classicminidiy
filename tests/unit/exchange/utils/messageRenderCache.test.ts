/**
 * Unit tests for the chat-message render cache.
 *
 * @vitest-environment jsdom
 *
 * jsdom for the same reason markdown.test.ts uses it: the readiness test below
 * drives a real DOMPurify import, and happy-dom mis-implements the node-iterator
 * walk DOMPurify has used since 3.4.8 — under it `sanitize()` silently returns
 * markup with a live `javascript:` href and never fires the link-hardening hook.
 * A test that "passes" against a sanitizer that is not sanitizing is worse than
 * no test. See the note at the top of markdown.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { createMessageRenderCache } from '~~/app/utils/messageRenderCache';
import { isMarkdownSanitizerReady, renderMessageMarkdown } from '~~/app/utils/markdown';

describe('createMessageRenderCache — provisional output is never cached', () => {
  it('re-renders every time while the sanitizer is still loading', () => {
    const render = vi.fn((content: string) => `provisional:${content}`);
    const cached = createMessageRenderCache(render, () => false);

    expect(cached('m1', 'hello')).toBe('provisional:hello');
    expect(cached('m1', 'hello')).toBe('provisional:hello');
    expect(cached('m1', 'hello')).toBe('provisional:hello');

    // Three calls, three renders. The point is not the render count itself —
    // it is that no provisional string was retained to be served later.
    expect(render).toHaveBeenCalledTimes(3);
  });

  it('serves the FINAL output for a message first rendered before the sanitizer arrived', () => {
    // This is the regression. The old cache stored the pre-DOMPurify string
    // under the message id, so the "next render" the renderer plans for was a
    // cache hit and the weaker sanitizer's output stuck for the life of the page.
    let ready = false;
    const render = vi.fn((content: string) => (ready ? `purified:${content}` : `provisional:${content}`));
    const cached = createMessageRenderCache(render, () => ready);

    expect(cached('m1', 'hello')).toBe('provisional:hello');

    ready = true;

    expect(cached('m1', 'hello')).toBe('purified:hello');
    expect(cached('m1', 'hello')).toBe('purified:hello');
  });

  it('caches once the sanitizer is ready', () => {
    const render = vi.fn((content: string) => `purified:${content}`);
    const cached = createMessageRenderCache(render, () => true);

    expect(cached('m1', 'hello')).toBe('purified:hello');
    expect(cached('m1', 'hello')).toBe('purified:hello');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('keys the cache per message id', () => {
    const render = vi.fn((content: string) => `purified:${content}`);
    const cached = createMessageRenderCache(render, () => true);

    expect(cached('m1', 'one')).toBe('purified:one');
    expect(cached('m2', 'two')).toBe('purified:two');
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('ignores a changed body for an id it already cached', () => {
    // Documenting existing behaviour, not endorsing it: messages are immutable
    // once sent, so id is a sound key. If message editing ever ships, this
    // assertion is the one that must change.
    const cached = createMessageRenderCache((content: string) => `purified:${content}`, () => true);

    expect(cached('m1', 'original')).toBe('purified:original');
    expect(cached('m1', 'edited')).toBe('purified:original');
  });
});

describe('isMarkdownSanitizerReady — tracks the real DOMPurify import', () => {
  it('flips true once the lazy import resolves, and the output is DOMPurify output', async () => {
    // The module is shared across this file, so the sanitizer may already have
    // been loaded by an earlier test. Drive it either way and assert on the end
    // state rather than on the transition, which is not ours to schedule.
    renderMessageMarkdown('kick off the lazy import');

    await vi.waitFor(() => expect(isMarkdownSanitizerReady()).toBe(true));

    // DOMPurify's afterSanitizeAttributes hook is what adds these; the regex
    // fallback writes its own attributes in a different order and never runs
    // the hook. Their presence is the observable proof that the flag means
    // "DOMPurify produced this", which is the only reason the cache can trust it.
    const html = renderMessageMarkdown('[link](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
  });
});
