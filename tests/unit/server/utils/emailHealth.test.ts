/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  MAIL_DOMAINS,
  SPF_LOOKUP_LIMIT,
  buildDomainHealth,
  classifyMx,
  evaluateSpf,
  findSpf,
  parseDmarc,
  parseSpfTerms,
  senderLabel,
  worstOf,
  type Check,
  type DomainFacts,
  type DomainSpec,
  type Severity,
} from '~/server/utils/emailHealth';

/**
 * Fixtures captured with `dig` on 2026-09-03, before the Forward Email cutover.
 * These are the real records; the lookup-budget test below is the reason the
 * migration is worth doing rather than deferring.
 */
const LIVE = {
  classicminidiy:
    'v=spf1 include:spf.forwardemail.net include:_spf.google.com include:shops.shopify.com include:amazonses.com -all',
  theminiexchange: 'v=spf1 include:send.resend.com ~all',
};

const CHAIN: Record<string, string[]> = {
  'spf.forwardemail.net': [
    'v=spf1 a:forwardemail.net include:mx1.forwardemail.net include:mx2.forwardemail.net include:smtp.forwardemail.net -all',
  ],
  'mx1.forwardemail.net': ['v=spf1 ip4:1.2.3.4 -all'],
  'mx2.forwardemail.net': ['v=spf1 ip4:1.2.3.5 -all'],
  'smtp.forwardemail.net': ['v=spf1 ip4:1.2.3.6 -all'],
  '_spf.google.com': ['v=spf1 ip4:74.125.0.0/16 ip6:2001:4860:4864::/56 ~all'],
  // Shopify's include really does resolve to a record that authorises nothing.
  'shops.shopify.com': ['v=spf1 ~all'],
  'amazonses.com': [
    'google-site-verification=aOJq8aXEtCO23r176f6iOTGt-RVuPv81XPtBuIzRTx0',
    'v=spf1 ip4:199.255.192.0/22 ip4:54.240.0.0/18 -all',
  ],
  'send.resend.com': ['v=spf1 ip4:149.72.0.0/16 ~all'],
};

const resolver =
  (map: Record<string, string[]> = CHAIN) =>
  async (name: string) => {
    if (!(name in map)) throw new Error(`NXDOMAIN ${name}`);
    return map[name];
  };

describe('classifyMx', () => {
  it('identifies the provider from the hostname suffix', () => {
    expect(classifyMx(['mx1.forwardemail.net.', 'mx2.forwardemail.net.'])).toBe('forwardemail');
    expect(classifyMx(['route1.mx.cloudflare.net', 'route2.mx.cloudflare.net'])).toBe('cloudflare');
    expect(classifyMx(['aspmx.l.google.com'])).toBe('google');
    expect(classifyMx(['mail.protection.outlook.com'])).toBe('other');
  });

  it('reports none for a domain with no MX', () => {
    expect(classifyMx([])).toBe('none');
    expect(classifyMx([''])).toBe('none');
  });

  it('ignores the trailing dot and case that dig and DoH disagree about', () => {
    expect(classifyMx(['ROUTE1.MX.CloudFlare.NET.'])).toBe('cloudflare');
  });
});

describe('findSpf', () => {
  it('picks the SPF record out of an unrelated TXT set', () => {
    const { record, count } = findSpf([
      'google-site-verification=abc',
      'v=spf1 include:amazonses.com -all',
      'apple-domain-verification=xyz',
    ]);
    expect(record).toBe('v=spf1 include:amazonses.com -all');
    expect(count).toBe(1);
  });

  it('counts duplicates rather than silently taking the first', () => {
    // Two SPF records is a permerror in its own right (RFC 7208 s4.5).
    const { count } = findSpf(['v=spf1 include:a.com -all', 'v=spf1 include:b.com -all']);
    expect(count).toBe(2);
  });

  it('returns null when there is no SPF record', () => {
    // cmdiy.co's current state.
    expect(findSpf(['forward-email-site-verification=RcNmk2u7Wp']).record).toBeNull();
    expect(findSpf([]).record).toBeNull();
  });

  it('does not mistake v=spf10 or DMARC for SPF', () => {
    expect(findSpf(['v=spf10 whatever']).record).toBeNull();
    expect(findSpf(['v=DMARC1; p=none;']).record).toBeNull();
  });
});

describe('parseSpfTerms', () => {
  it('marks only the mechanisms that cost a DNS lookup', () => {
    const terms = parseSpfTerms('v=spf1 include:a.com ip4:1.2.3.4 a mx ip6:::1 exists:%{i}.b.com -all');
    const costs = Object.fromEntries(terms.map((t) => [t.name, t.costsLookup]));
    expect(costs).toEqual({
      include: true,
      ip4: false,
      a: true,
      mx: true,
      ip6: false,
      exists: true,
      all: false,
    });
  });

  it('strips qualifiers without changing the mechanism or its cost', () => {
    const terms = parseSpfTerms('v=spf1 -include:a.com ~all');
    expect(terms[0]).toEqual({ name: 'include', value: 'a.com', costsLookup: true });
    expect(terms[1].name).toBe('all');
  });
});

describe('evaluateSpf', () => {
  it('counts the live classicminidiy.com record at 8 of 10 lookups', async () => {
    // The finding that motivates the migration: 4 direct includes, but
    // spf.forwardemail.net nests a: plus three more includes, costing 5 alone.
    const result = await evaluateSpf(LIVE.classicminidiy, resolver());
    expect(result.lookups).toBe(8);
    expect(result.lookups).toBeLessThanOrEqual(SPF_LOOKUP_LIMIT);
    expect(result.truncated).toBe(false);
  });

  it('drops to 3 lookups once the Forward Email include is removed', async () => {
    // The target state from the design doc.
    const target = 'v=spf1 include:_spf.google.com include:shops.shopify.com include:amazonses.com -all';
    const result = await evaluateSpf(target, resolver());
    expect(result.lookups).toBe(3);
  });

  it('separates direct includes from the full recursive set', async () => {
    const result = await evaluateSpf(LIVE.classicminidiy, resolver());
    expect(result.directIncludes).toEqual([
      'spf.forwardemail.net',
      '_spf.google.com',
      'shops.shopify.com',
      'amazonses.com',
    ]);
    expect(result.includes).toContain('smtp.forwardemail.net');
    expect(result.directIncludes).not.toContain('smtp.forwardemail.net');
  });

  it('reports the all qualifier', async () => {
    expect((await evaluateSpf(LIVE.classicminidiy, resolver())).allQualifier).toBe('-');
    expect((await evaluateSpf(LIVE.theminiexchange, resolver())).allQualifier).toBe('~');
    expect((await evaluateSpf('v=spf1 include:a.com', resolver({ 'a.com': [] }))).allQualifier).toBeNull();
  });

  it('counts a hard-fail-only record as costing nothing', async () => {
    // cmdiy.co's target state: receive-only, authorises no sender.
    const result = await evaluateSpf('v=spf1 -all', resolver());
    expect(result.lookups).toBe(0);
    expect(result.allQualifier).toBe('-');
  });

  it('counts an unresolvable include but stops descending', async () => {
    const result = await evaluateSpf('v=spf1 include:gone.example -all', resolver());
    expect(result.lookups).toBe(1);
    expect(result.truncated).toBe(true);
  });

  it('does not loop forever on a self-referential include', async () => {
    const loop = { 'loop.example': ['v=spf1 include:loop.example -all'] };
    const result = await evaluateSpf('v=spf1 include:loop.example -all', resolver(loop));
    expect(result.truncated).toBe(true);
    expect(result.lookups).toBeLessThan(50);
  });

  it('ignores an include whose target publishes no SPF record', async () => {
    const map = { 'notspf.example': ['just-a-verification-token'] };
    const result = await evaluateSpf('v=spf1 include:notspf.example -all', resolver(map));
    expect(result.lookups).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it('counts redirect as a lookup and follows it', async () => {
    const map = { 'r.example': ['v=spf1 include:amazonses.com -all'], 'amazonses.com': CHAIN['amazonses.com'] };
    const result = await evaluateSpf('v=spf1 redirect=r.example', resolver(map));
    expect(result.lookups).toBe(2);
  });
});

describe('parseDmarc', () => {
  it('reads the policy from the live p=none records', () => {
    const d = parseDmarc(['v=DMARC1; p=none;']);
    expect(d?.policy).toBe('none');
    expect(d?.pct).toBe(100);
    expect(d?.hasReporting).toBe(false);
  });

  it('reads pct and rua when present', () => {
    const d = parseDmarc(['v=DMARC1; p=quarantine; pct=50; rua=mailto:d@example.com']);
    expect(d?.policy).toBe('quarantine');
    expect(d?.pct).toBe(50);
    expect(d?.hasReporting).toBe(true);
  });

  it('defaults pct to 100 when absent or malformed', () => {
    expect(parseDmarc(['v=DMARC1; p=reject; pct=abc'])?.pct).toBe(100);
  });

  it('returns null when no DMARC record exists', () => {
    expect(parseDmarc(['v=spf1 -all'])).toBeNull();
    expect(parseDmarc([])).toBeNull();
  });

  it('does not confuse the sp subdomain policy for the domain policy', () => {
    const d = parseDmarc(['v=DMARC1; sp=reject; p=none']);
    expect(d?.policy).toBe('none');
  });
});

describe('MAIL_DOMAINS', () => {
  it('covers exactly the three domains Forward Email carries', () => {
    expect(MAIL_DOMAINS.map((d) => d.domain).sort()).toEqual(['classicminidiy.com', 'cmdiy.co', 'theminiexchange.com']);
  });

  it('does not expect the Forward Email include on any domain', () => {
    // The whole point of the migration; a regression here would make the admin
    // page green on the state we are leaving.
    for (const spec of MAIL_DOMAINS) {
      expect(spec.expectedIncludes).not.toContain('spf.forwardemail.net');
      expect(spec.expectedIncludes).not.toContain('send.resend.com');
    }
  });

  it('expects SES on every sending domain and nothing on the receive-only one', () => {
    for (const spec of MAIL_DOMAINS) {
      if (spec.sends) expect(spec.expectedIncludes).toContain('amazonses.com');
      else expect(spec.expectedIncludes).toEqual([]);
    }
  });
});

describe('senderLabel', () => {
  it('names known providers and passes through unknown ones', () => {
    expect(senderLabel('amazonses.com')).toBe('AWS SES');
    expect(senderLabel('send.resend.com')).toBe('Resend');
    expect(senderLabel('weird.example')).toBe('weird.example');
  });
});

describe('buildDomainHealth', () => {
  const spec = (over: Partial<DomainSpec> = {}): DomainSpec => ({
    domain: 'example.com',
    sends: true,
    expectedIncludes: ['amazonses.com'],
    ...over,
  });

  const facts = (over: Partial<DomainFacts> = {}): DomainFacts => ({
    mxHosts: ['route1.mx.cloudflare.net'],
    spfRecord: 'v=spf1 include:amazonses.com -all',
    spfCount: 1,
    spf: {
      lookups: 1,
      includes: ['amazonses.com'],
      directIncludes: ['amazonses.com'],
      allQualifier: '-',
      truncated: false,
    },
    dmarc: { record: 'v=DMARC1; p=reject', policy: 'reject', pct: 100, hasReporting: true },
    ...over,
  });

  const check = (h: { checks: { id: string; severity: string }[] }, id: string) => h.checks.find((c) => c.id === id);

  it('grades a fully migrated domain as healthy', () => {
    const h = buildDomainHealth(spec(), facts());
    expect(h.worst).toBe('ok');
    expect(check(h, 'mx')?.severity).toBe('ok');
  });

  it('does not let the permanently-unknown DKIM row pin the badge', () => {
    // A healthy row must be able to reach green, or the badge means nothing.
    const h = buildDomainHealth(spec(), facts());
    expect(check(h, 'dkim')?.severity).toBe('unknown');
    expect(h.worst).toBe('ok');
  });

  it('warns while a domain is still on Forward Email', () => {
    const h = buildDomainHealth(spec(), facts({ mxHosts: ['mx1.forwardemail.net'] }));
    expect(check(h, 'mx')?.severity).toBe('warn');
    expect(h.worst).toBe('warn');
  });

  it('fails a domain with no MX at all', () => {
    const h = buildDomainHealth(spec(), facts({ mxHosts: [] }));
    expect(check(h, 'mx')?.severity).toBe('fail');
  });

  it('fails a sending domain with no SPF but only warns a receive-only one', () => {
    const missing = { spfRecord: null, spf: null, spfCount: 0 };
    expect(check(buildDomainHealth(spec(), facts(missing)), 'spf')?.severity).toBe('fail');
    // cmdiy.co: nothing sends as it, so an absent SPF is untidy, not broken.
    const recv = spec({ sends: false, expectedIncludes: [] });
    expect(check(buildDomainHealth(recv, facts(missing)), 'spf')?.severity).toBe('warn');
  });

  it('fails on duplicate SPF records', () => {
    const h = buildDomainHealth(spec(), facts({ spfCount: 2 }));
    expect(check(h, 'spf')?.severity).toBe('fail');
  });

  it('warns at 8 lookups and fails past the limit', () => {
    const at = (lookups: number) =>
      check(buildDomainHealth(spec(), facts({ spf: { ...facts().spf!, lookups } })), 'spf-lookups')?.severity;
    expect(at(3)).toBe('ok');
    expect(at(7)).toBe('ok');
    expect(at(8)).toBe('warn'); // classicminidiy.com today
    expect(at(10)).toBe('warn');
    expect(at(11)).toBe('fail');
  });

  it('flags a sender that is authorised but unused, and one that is used but unauthorised', () => {
    // theminiexchange.com today: Resend authorised, SES missing.
    const h = buildDomainHealth(
      spec(),
      facts({
        spfRecord: 'v=spf1 include:send.resend.com ~all',
        spf: {
          lookups: 1,
          includes: ['send.resend.com'],
          directIncludes: ['send.resend.com'],
          allQualifier: '~',
          truncated: false,
        },
      })
    );
    expect(h.unexpectedIncludes).toEqual(['send.resend.com']);
    expect(h.missingIncludes).toEqual(['amazonses.com']);
    expect(check(h, 'spf-unexpected')?.severity).toBe('warn');
    expect(check(h, 'spf-missing')?.severity).toBe('fail');
    expect(h.worst).toBe('fail');
  });

  it('fails a record ending in +all or with no all mechanism', () => {
    const withAll = (allQualifier: string | null) =>
      check(buildDomainHealth(spec(), facts({ spf: { ...facts().spf!, allQualifier } })), 'spf-all')?.severity;
    expect(withAll('+')).toBe('fail');
    expect(withAll(null)).toBe('fail');
    expect(withAll('-')).toBeUndefined();
    expect(withAll('~')).toBeUndefined();
  });

  it('warns on p=none and passes p=reject', () => {
    const dmarc = (policy: string | null) =>
      check(
        buildDomainHealth(spec(), facts({ dmarc: { record: 'r', policy, pct: 100, hasReporting: false } })),
        'dmarc'
      )?.severity;
    expect(dmarc('none')).toBe('warn'); // all three domains today
    expect(dmarc('quarantine')).toBe('ok');
    expect(dmarc('reject')).toBe('ok');
    expect(check(buildDomainHealth(spec(), facts({ dmarc: null })), 'dmarc')?.severity).toBe('fail');
  });

  it('reports the pct when a policy applies to only part of the mail', () => {
    const h = buildDomainHealth(
      spec(),
      facts({ dmarc: { record: 'r', policy: 'quarantine', pct: 50, hasReporting: true } })
    );
    expect(check(h, 'dmarc')?.detail).toContain('pct=50');
  });
});

describe('worstOf', () => {
  it('ranks fail over warn over ok, and ignores unknown', () => {
    const c = (severity: Severity): Check => ({ id: severity, label: severity, severity, detail: '' });
    expect(worstOf([c('ok'), c('warn'), c('fail')])).toBe('fail');
    expect(worstOf([c('ok'), c('warn')])).toBe('warn');
    expect(worstOf([c('ok'), c('unknown')])).toBe('ok');
    expect(worstOf([])).toBe('ok');
  });
});
