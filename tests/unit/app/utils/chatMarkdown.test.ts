/**
 * The assistant's markdown renderer, and the YouTube cards it now emits.
 *
 * @vitest-environment jsdom
 *
 * jsdom, NOT happy-dom, for the same reason `tests/unit/exchange/utils/markdown.test.ts`
 * pins it: happy-dom mis-implements the node-iterator walk DOMPurify uses, so a
 * sanitizer test running under it can pass while asserting nothing. See that
 * file's header and `.claude/rules/testing.md`.
 */
import { describe, it, expect } from 'vitest';
import { renderAssistantMarkdown } from '~/utils/chatMarkdown';

describe('YouTube links become cards', () => {
  it('renders a watch URL as a card with its thumbnail', () => {
    const html = renderAssistantMarkdown('[Fitting a windscreen](https://www.youtube.com/watch?v=dQw4w9WgXcQ)');

    expect(html).toContain('chat-video-card');
    expect(html).toContain('Fitting a windscreen');
    expect(html).toContain('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('handles youtu.be and /shorts/ as well as /watch', () => {
    for (const href of [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      expect(renderAssistantMarkdown(`[Video](${href})`), href).toContain('chat-video-card');
    }
  });

  it('appends no tracking parameters to a video link', () => {
    // Ordinary links get UTM tags so store traffic is attributable. A watch URL
    // should reach YouTube with nothing but the video id on it.
    const html = renderAssistantMarkdown('[Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
    expect(html).not.toContain('utm_');
    expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
  });

  it('leaves a channel, playlist or search URL as an ordinary link', () => {
    // A card promises one watchable video. None of these is one.
    for (const href of [
      'https://www.youtube.com/@ClassicMiniDIY',
      'https://www.youtube.com/playlist?list=PLabc',
      'https://www.youtube.com/results?search_query=mini',
    ]) {
      const html = renderAssistantMarkdown(`[Channel](${href})`);
      expect(html, href).not.toContain('chat-video-card');
      expect(html, href).toContain('<a href=');
    }
  });

  it('does not card a look-alike URL on another host', () => {
    // The check parses with `URL` and compares the hostname exactly. A regex
    // over the raw href would match this and render an attacker-chosen
    // thumbnail inside a card that reads as one of Cole's videos.
    const html = renderAssistantMarkdown('[Video](https://evil.example/?x=youtube.com/watch?v=dQw4w9WgXcQ)');
    expect(html).not.toContain('chat-video-card');
    expect(html).not.toContain('i.ytimg.com');
  });

  it('does not card an id that is not a YouTube id', () => {
    // The id is interpolated into an <img src>, so this is the check that keeps
    // it from being interpolated into something else.
    for (const bad of ['../../evil', 'short', 'way-too-long-to-be-an-id', '"><script>']) {
      const html = renderAssistantMarkdown(`[Video](https://www.youtube.com/watch?v=${encodeURIComponent(bad)})`);
      expect(html, bad).not.toContain('chat-video-card');
    }
  });

  it('strips markup from a link label rather than nesting it in the card', () => {
    const html = renderAssistantMarkdown('[**Bold** title](https://youtu.be/dQw4w9WgXcQ)');
    expect(html).toContain('chat-video-card');
    expect(html).toContain('Bold title');
    // No <strong> inside the card title span.
    expect(html).not.toMatch(/chat-video-card__title">[^<]*<strong>/);
  });
});

describe('everything else still renders as it did', () => {
  it('tags an ordinary outbound link and keeps it an anchor', () => {
    const html = renderAssistantMarkdown('[Mini Spares](https://minispares.com/part/ABC123)');
    expect(html).toContain('utm_source=diy_chat_bot');
    expect(html).not.toContain('chat-video-card');
  });

  it('still drops raw HTML at the parser', () => {
    // This is what lets the renderer skip a DOMPurify link hook: with no
    // passthrough HTML, every anchor comes from our own `link` renderer.
    const html = renderAssistantMarkdown('<img src=x onerror=alert(1)>\n\nhello');
    expect(html).not.toContain('onerror');
    expect(html).toContain('hello');
  });

  it('does not turn a javascript: link into anything clickable', () => {
    const html = renderAssistantMarkdown('[click](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('renders headings, tables and code the assistant relies on', () => {
    expect(renderAssistantMarkdown('## Torque')).toContain('<h2');
    expect(renderAssistantMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')).toContain('<table');
    expect(renderAssistantMarkdown('`12H`')).toContain('<code');
  });
});
