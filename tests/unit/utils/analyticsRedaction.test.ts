import { describe, expect, it } from 'vitest';
import { redactForumSsoEvent, redactForumSsoUrl } from '~/utils/analyticsRedaction';

const SSO = 'bm9uY2U9YWJj+/=';
const SIG = 'a'.repeat(64);
const SSO_PATH = `/discourse/sso?sso=${encodeURIComponent(SSO)}&sig=${SIG}`;

describe('redactForumSsoUrl', () => {
  it('drops the query from the forum hand-off page, relative or absolute', () => {
    expect(redactForumSsoUrl(SSO_PATH)).toBe('/discourse/sso');
    expect(redactForumSsoUrl(`https://classicminidiy.com${SSO_PATH}`)).toBe('https://classicminidiy.com/discourse/sso');
  });

  it('keeps a login redirect to the hand-off page, minus its query', () => {
    const login = `https://classicminidiy.com/login?redirect=${encodeURIComponent(SSO_PATH)}&x=1`;
    expect(redactForumSsoUrl(login)).toBe(
      `https://classicminidiy.com/login?redirect=${encodeURIComponent('/discourse/sso')}&x=1`
    );
    expect(redactForumSsoUrl(`/welcome?redirect=${encodeURIComponent(SSO_PATH)}`)).toBe(
      `/welcome?redirect=${encodeURIComponent('/discourse/sso')}`
    );
  });

  it.each([
    '/membership?subscribe=1',
    '/login?redirect=%2Fmembership',
    'https://community.classicminidiy.com/t/discourse-tips/12',
    '/discourse/sso',
    'a sentence that mentions discourse',
    '',
  ])('leaves %j unchanged', (value) => {
    expect(redactForumSsoUrl(value)).toBe(value);
  });
});

describe('redactForumSsoEvent', () => {
  it('redacts URLs in properties, $set and $set_once, including one level down', () => {
    const event: any = {
      uuid: 'u',
      event: '$pageview',
      properties: {
        $current_url: `https://classicminidiy.com${SSO_PATH}`,
        current_url: SSO_PATH,
        $pathname: '/discourse/sso',
        nested: { u: `https://classicminidiy.com${SSO_PATH}` },
        count: 3,
      },
      $set: { $current_url: `https://classicminidiy.com${SSO_PATH}` },
      $set_once: { $initial_current_url: `https://classicminidiy.com/login?redirect=${encodeURIComponent(SSO_PATH)}` },
    };
    const out: any = redactForumSsoEvent(event);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(SIG);
    expect(serialized).not.toContain(encodeURIComponent(SSO));
    expect(out.properties.current_url).toBe('/discourse/sso');
    expect(out.properties.nested.u).toBe('https://classicminidiy.com/discourse/sso');
    expect(out.properties.count).toBe(3);
  });

  it('passes null and session-replay events through untouched', () => {
    expect(redactForumSsoEvent(null)).toBeNull();
    const snapshot: any = { uuid: 'u', event: '$snapshot', properties: { href: SSO_PATH } };
    expect(redactForumSsoEvent(snapshot)?.properties.href).toBe(SSO_PATH);
  });
});
