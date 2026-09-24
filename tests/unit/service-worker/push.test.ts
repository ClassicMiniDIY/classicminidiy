import { describe, it, expect } from 'vitest';
import {
  buildNotification,
  DEFAULT_NOTIFICATION_ICON,
  DEFAULT_NOTIFICATION_TITLE,
  parsePushData,
  resolveClickUrl,
} from '../../../service-worker/push';

// Pure helpers behind service-worker/sw.ts. The payload shape is the one
// process-notifications sends: { title, body, url, tag, icon? }.

const data = (raw: string) => ({
  json: () => JSON.parse(raw),
  text: () => raw,
});

describe('parsePushData', () => {
  it('reads a JSON payload', () => {
    expect(parsePushData(data('{"title":"Hi","body":"There"}'))).toEqual({ title: 'Hi', body: 'There' });
  });

  it('uses plain text as the body', () => {
    expect(parsePushData(data('hello'))).toEqual({ body: 'hello' });
  });

  it('returns {} for no data, empty text, or a JSON non-object', () => {
    expect(parsePushData(null)).toEqual({});
    expect(parsePushData(undefined)).toEqual({});
    expect(parsePushData(data(''))).toEqual({});
    expect(parsePushData(data('42'))).toEqual({});
    expect(parsePushData(data('null'))).toEqual({});
  });
});

describe('buildNotification', () => {
  it('maps the process-notifications payload', () => {
    const spec = buildNotification({
      title: 'Message from Alex',
      body: 'Is the Cooper S still for sale?',
      url: 'https://www.classicminidiy.com/exchange/messages/c1',
      tag: 'msg:c1',
    });
    expect(spec.title).toBe('Message from Alex');
    expect(spec.options).toMatchObject({
      body: 'Is the Cooper S still for sale?',
      icon: DEFAULT_NOTIFICATION_ICON,
      tag: 'msg:c1',
      renotify: true,
      data: { url: 'https://www.classicminidiy.com/exchange/messages/c1' },
    });
  });

  it('always has a title, and ignores fields of the wrong type', () => {
    const spec = buildNotification({ title: 5, body: { x: 1 }, url: ['x'], tag: '', icon: null });
    expect(spec.title).toBe(DEFAULT_NOTIFICATION_TITLE);
    expect(spec.options.body).toBe('');
    expect(spec.options.icon).toBe(DEFAULT_NOTIFICATION_ICON);
    expect(spec.options.tag).toBeUndefined();
    // renotify without a tag is an error in Chrome's showNotification.
    expect(spec.options.renotify).toBe(false);
    expect(spec.options.data).toEqual({ url: undefined });
  });

  it('keeps a payload icon', () => {
    expect(buildNotification({ icon: '/brand/logo.png' }).options.icon).toBe('/brand/logo.png');
  });
});

describe('resolveClickUrl', () => {
  const origin = 'https://www.classicminidiy.com';

  it('keeps an absolute http(s) URL, including another origin', () => {
    expect(resolveClickUrl('https://www.classicminidiy.com/exchange/messages/c1', origin)).toBe(
      'https://www.classicminidiy.com/exchange/messages/c1'
    );
    expect(resolveClickUrl('https://models.example.com/models/x', origin)).toBe('https://models.example.com/models/x');
  });

  it('resolves a relative URL against the origin', () => {
    expect(resolveClickUrl('/dashboard/listings', origin)).toBe('https://www.classicminidiy.com/dashboard/listings');
  });

  it('falls back to the site root for a missing URL or a non-http scheme', () => {
    for (const raw of [undefined, null, '', 42, 'javascript:alert(1)', 'data:text/html,x']) {
      expect(resolveClickUrl(raw, origin)).toBe('https://www.classicminidiy.com/');
    }
  });
});
