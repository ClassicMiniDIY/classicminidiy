import { describe, expect, it } from 'vitest';
import {
  DISCOURSE_EMBED_MAX_HEIGHT,
  DISCOURSE_EMBED_MIN_HEIGHT,
  discourseEmbedOrigin,
  discourseEmbedSrc,
  readDiscourseEmbedMessage,
} from '~/utils/discourseEmbed';

const FORUM = 'https://community.classicminidiy.com';
const frameWindow = { name: 'frame' };

describe('discourseEmbedOrigin', () => {
  it('uses the configured https origin and drops any path', () => {
    expect(discourseEmbedOrigin('https://forum.example.com/some/path')).toBe('https://forum.example.com');
  });
  it.each(['', 'http://forum.example.com', 'not a url', undefined])('falls back for %s', (value) => {
    expect(discourseEmbedOrigin(value)).toBe(FORUM);
  });
});

describe('discourseEmbedSrc', () => {
  it('embeds by topic_id, never by embed_url', () => {
    const src = new URL(discourseEmbedSrc(FORUM, 118, false));
    expect(src.origin + src.pathname).toBe(`${FORUM}/embed/comments`);
    expect(src.searchParams.get('topic_id')).toBe('118');
    expect(src.searchParams.has('embed_url')).toBe(false);
    expect(src.searchParams.get('class_name')).toBe('cmdiy-embed-light');
  });
  it('passes the dark class name in dark mode', () => {
    expect(new URL(discourseEmbedSrc(FORUM, 118, true)).searchParams.get('class_name')).toBe('cmdiy-embed-dark');
  });
});

describe('readDiscourseEmbedMessage', () => {
  const msg = (data: unknown, origin = FORUM, source: unknown = frameWindow) =>
    readDiscourseEmbedMessage({ origin, data, source } as any, FORUM, frameWindow);

  it('reads a resize from the forum origin and our frame', () => {
    expect(msg({ type: 'discourse-resize', height: 640 })).toEqual({ type: 'resize', height: 640 });
  });

  it('clamps the height', () => {
    expect(msg({ type: 'discourse-resize', height: 5 })).toEqual({
      type: 'resize',
      height: DISCOURSE_EMBED_MIN_HEIGHT,
    });
    expect(msg({ type: 'discourse-resize', height: 1e9 })).toEqual({
      type: 'resize',
      height: DISCOURSE_EMBED_MAX_HEIGHT,
    });
  });

  it('reads a scroll', () => {
    expect(msg({ type: 'discourse-scroll', top: 300 })).toEqual({ type: 'scroll', top: 300 });
  });

  it.each([
    ['another origin', 'https://evil.example'],
    ['a look-alike origin', 'https://community.classicminidiy.com.evil.example'],
    ['the http origin', 'http://community.classicminidiy.com'],
    ['an opaque origin', 'null'],
  ])('ignores %s', (_label, origin) => {
    expect(msg({ type: 'discourse-resize', height: 640 }, origin)).toBeNull();
  });

  it('ignores a message from another window, or before the frame exists', () => {
    expect(msg({ type: 'discourse-resize', height: 640 }, FORUM, { name: 'other' })).toBeNull();
    expect(
      readDiscourseEmbedMessage(
        { origin: FORUM, data: { type: 'discourse-resize', height: 1 }, source: null } as any,
        FORUM,
        null
      )
    ).toBeNull();
  });

  it.each([
    null,
    'discourse-resize',
    { type: 'other' },
    { type: 'discourse-resize', height: 'tall' },
    { type: 'discourse-resize', height: -1 },
  ])('ignores malformed data %j', (data) => {
    expect(msg(data)).toBeNull();
  });
});
