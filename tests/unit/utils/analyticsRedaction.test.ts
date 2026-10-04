import { describe, expect, it } from 'vitest';
import { redactForumSsoEvent, redactForumSsoText, redactForumSsoUrl } from '~/utils/analyticsRedaction';

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

describe('redactForumSsoText', () => {
  it('scrubs raw and encoded hand-off queries inside free text', () => {
    const raw = `a:attr__href="${SSO_PATH}"nth-child="1"`;
    expect(redactForumSsoText(raw)).toBe('a:attr__href="/discourse/sso"nth-child="1"');
    const encoded = `a.btn.ph-no-capture:attr__href="/login?redirect=${encodeURIComponent(SSO_PATH)}&x=1"`;
    expect(redactForumSsoText(encoded)).toBe('a.btn.ph-no-capture:attr__href="/login?redirect=%2Fdiscourse%2Fsso&x=1"');
    const unencodedRedirect = `a:attr__href="/login?redirect=${SSO_PATH}"`;
    expect(redactForumSsoText(unencodedRedirect)).toBe('a:attr__href="/login?redirect=/discourse/sso"');
  });

  it('leaves text without a hand-off query unchanged', () => {
    const chain = 'a:attr__href="/discourse/sso"nth-child="2";div.card:nth-child="1"';
    expect(redactForumSsoText(chain)).toBe(chain);
  });
});

describe('redactForumSsoEvent: autocapture and safe writes', () => {
  it('scrubs $elements_chain and $elements hrefs', () => {
    const href = `/login?redirect=${encodeURIComponent(SSO_PATH)}`;
    const event: any = {
      uuid: 'u',
      event: '$autocapture',
      properties: {
        $elements_chain: `a.btn:attr__href="${href}"href="${href}";div.card-body`,
        $elements: [{ tag_name: 'a', attr__href: href }],
      },
    };
    const out: any = redactForumSsoEvent(event);
    expect(JSON.stringify(out)).not.toContain(SIG);
    expect(out.properties.$elements_chain).toContain('redirect=%2Fdiscourse%2Fsso"');
    expect(out.properties.$elements[0].attr__href).toBe(`/login?redirect=${encodeURIComponent('/discourse/sso')}`);
  });

  it('never writes unchanged properties: a frozen nested object passes through without throwing', () => {
    const frozen = Object.freeze({ a: 'plain', n: 1 });
    const readOnly = {};
    Object.defineProperty(readOnly, 'url', { value: '/membership', enumerable: true, writable: false });
    const event: any = { uuid: 'u', event: 'x', properties: { frozen, readOnly, $current_url: '/membership' } };
    expect(() => redactForumSsoEvent(event)).not.toThrow();
    expect(event.properties.frozen).toBe(frozen);
    expect(event.properties.frozen).toEqual({ a: 'plain', n: 1 });
    expect(event.properties.readOnly.url).toBe('/membership');
  });

  it('does not throw on a frozen object that holds a hand-off URL', () => {
    const event: any = { uuid: 'u', event: 'x', properties: { frozen: Object.freeze({ u: SSO_PATH }) } };
    expect(() => redactForumSsoEvent(event)).not.toThrow();
  });
});
