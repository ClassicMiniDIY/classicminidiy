/**
 * Email DNS health — the parsing half of /admin/email.
 *
 * Design doc: docs/plans/2026-09-03-forward-email-retirement.md
 *
 * This replaces the account-summary table that Forward Email gave us for free
 * alongside the subscription we are retiring. It deliberately checks more than
 * that table did, because building a like-for-like copy would have missed the
 * three defects that prompted the work: a stale Resend include on
 * theminiexchange.com, no SPF at all on cmdiy.co, and classicminidiy.com sitting
 * at 8 of SPF's 10 permitted DNS lookups.
 *
 * Everything here is pure and unit-tested. Resolution is injected as a callback
 * so the parser can be exercised without a network, and so the route can use
 * DNS-over-HTTPS: `node:dns` is not part of the Workers runtime contract, and a
 * plain fetch to cloudflare-dns.com is portable everywhere this deploys.
 */

/** RFC 7208 §4.6.4: a policy that needs more than 10 DNS lookups is a permerror. */
export const SPF_LOOKUP_LIMIT = 10;

/** Guard against an include cycle in someone else's record. */
const MAX_SPF_DEPTH = 10;

export type Severity = 'ok' | 'warn' | 'fail' | 'unknown';

export interface DomainSpec {
  domain: string;
  /** Whether this domain sends mail. Receive-only domains should publish `v=spf1 -all`. */
  sends: boolean;
  /**
   * SPF includes that are correct for this domain once the migration lands.
   * An include that is present but absent from this list is reported as
   * unrecognised rather than removed — dropping a sender silently is how you
   * discover a mail path by breaking it.
   */
  expectedIncludes: string[];
}

/**
 * The three domains Forward Email carries. Kept here rather than in the route
 * because it is configuration, not I/O, and the tests assert against it.
 *
 * The redirect-only zones (classicminidiy.net/.org, wheeldictionary.com) are
 * deliberately absent: they have no MX and never send, so a row for them would
 * be permanently and uninformatively red.
 */
export const MAIL_DOMAINS: DomainSpec[] = [
  {
    domain: 'classicminidiy.com',
    sends: true,
    // SES is the only confirmed sender. Two includes were dropped from this
    // list on 2026-09-03 after checking what they actually authorize:
    //
    //   _spf.google.com   — vestigial. Gmail has NO "send mail as" entry for
    //                       any custom domain, Google is not the MX, and the
    //                       account is consumer Gmail, not Workspace. Nothing
    //                       can send as this domain via Google.
    //   shops.shopify.com — resolves to bare `v=spf1 ~all`, authorizing nobody.
    //                       Shopify does send as this domain, so the fix is
    //                       Shopify's DKIM CNAMEs, not an SPF include that
    //                       grants nothing. Flagged by the emptyIncludes check.
    expectedIncludes: ['amazonses.com'],
  },
  {
    domain: 'theminiexchange.com',
    sends: true,
    // Currently publishes send.resend.com. Resend is not used anywhere on the
    // platform — transactional mail is SES.
    expectedIncludes: ['amazonses.com'],
  },
  {
    domain: 'cmdiy.co',
    // SENDS. An earlier revision had this as receive-only, reasoning from the
    // domain appearing nowhere in this repo's code. That was wrong: the code is
    // not the only thing that sends mail. The Route 53 zone (comment: "Emailing
    // from the CMDIY store") carries two complete sets of Shopify DKIM CNAMEs
    // and mailer hosts, plus a Postmark DKIM key and bounce host. This is the
    // Shopify store's authenticated sending domain.
    sends: true,
    // Left empty deliberately, which makes the page FAIL on the absent SPF —
    // the correct reading for a sending domain that authorises nobody. The
    // include to add depends on which senders are still live: Shopify's grants
    // nothing (see classicminidiy.com below) so Shopify rides on DKIM alone,
    // and Postmark would need `spf.mtasv.net` only if it still sends.
    expectedIncludes: [],
  },
];

/** Human labels for the SPF includes we expect to meet, for the UI. */
export const SENDER_LABELS: Record<string, string> = {
  'amazonses.com': 'AWS SES',
  '_spf.google.com': 'Google',
  'shops.shopify.com': 'Shopify',
  'spf.forwardemail.net': 'Forward Email',
  'send.resend.com': 'Resend',
  'servers.mcsv.net': 'Mailchimp',
  'sendgrid.net': 'SendGrid',
};

export function senderLabel(include: string): string {
  return SENDER_LABELS[include] ?? include;
}

/* -------------------------------------------------------------------------- */
/* MX                                                                          */
/* -------------------------------------------------------------------------- */

export type MxProvider = 'cloudflare' | 'forwardemail' | 'google' | 'other' | 'none';

/**
 * Identify the mail host from MX targets. Matched on hostname suffix because
 * Cloudflare Email Routing hands out route1/2/3.mx.cloudflare.net with
 * priorities that vary per zone, so the priority carries no signal.
 */
export function classifyMx(hosts: string[]): MxProvider {
  const clean = hosts.map((h) => h.toLowerCase().replace(/\.$/, '')).filter(Boolean);
  if (clean.length === 0) return 'none';
  if (clean.some((h) => h.endsWith('.mx.cloudflare.net'))) return 'cloudflare';
  if (clean.some((h) => h.endsWith('forwardemail.net'))) return 'forwardemail';
  if (clean.some((h) => h.endsWith('google.com') || h.endsWith('googlemail.com'))) return 'google';
  return 'other';
}

/* -------------------------------------------------------------------------- */
/* SPF                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Pick the SPF record out of a domain's TXT set.
 *
 * Publishing two is itself a misconfiguration (RFC 7208 §4.5 makes it a
 * permerror), so this reports the count rather than silently taking the first.
 */
export function findSpf(txt: string[]): { record: string | null; count: number } {
  const matches = txt.filter((t) => /^v=spf1(\s|$)/i.test(t.trim()));
  return { record: matches[0] ?? null, count: matches.length };
}

/** Mechanisms that cost a DNS lookup against the limit of 10. */
const LOOKUP_MECHANISMS = /^(include|a|mx|ptr|exists|redirect)$/i;

export interface SpfTerm {
  /** `include`, `a`, `mx`, `all`, `ip4`, … lowercased. */
  name: string;
  /** The part after `:` or `=`, when present. */
  value: string | null;
  /** Whether this term costs one of the 10 permitted DNS lookups. */
  costsLookup: boolean;
}

/** Split an SPF record into its terms. Does not resolve anything. */
export function parseSpfTerms(record: string): SpfTerm[] {
  return record
    .trim()
    .split(/\s+/)
    .slice(1) // drop the v=spf1 version token
    .filter(Boolean)
    .map((raw) => {
      // Strip a leading qualifier (+ - ~ ?) — it affects the result, not the cost.
      const term = raw.replace(/^[+\-~?]/, '');
      const sep = term.search(/[:=]/);
      const name = (sep === -1 ? term : term.slice(0, sep)).toLowerCase();
      const value = sep === -1 ? null : term.slice(sep + 1);
      return { name, value, costsLookup: LOOKUP_MECHANISMS.test(name) };
    });
}

/** Mechanisms that actually authorize a sender, as opposed to costing a lookup. */
const AUTHORIZING_MECHANISMS = /^(ip4|ip6|a|mx|exists)$/i;

export interface SpfEvaluation {
  /** Total DNS lookups the record costs, including nested includes. */
  lookups: number;
  /** Every include target reached, at any depth, in encounter order. */
  includes: string[];
  /** Top-level include targets only — what the domain's own record names. */
  directIncludes: string[];
  /**
   * Direct includes that resolve to a record authorizing NOBODY.
   *
   * `shops.shopify.com` is the live example: it resolves to bare `v=spf1 ~all`,
   * so it grants no sender while still costing one of the 10 lookups. An include
   * like this looks correct in the record and does nothing, which is worse than
   * a missing one — it reads as "Shopify is authorized" when Shopify is not.
   */
  emptyIncludes: string[];
  /** ip4/ip6/a/mx/exists mechanisms in this subtree — what authorizes mail. */
  authorizing: number;
  /** The record's final `all` qualifier: '-', '~', '?', '+', or null if absent. */
  allQualifier: string | null;
  /** True if recursion was cut short by the depth guard or the lookup limit. */
  truncated: boolean;
}

/**
 * Count an SPF record's DNS lookups, recursing through includes the way a
 * receiving mail server does.
 *
 * `resolveTxt` is injected: the route supplies a DoH-backed resolver, the tests
 * supply a fixture map. Resolution failures count the lookup and stop
 * descending, which mirrors what a receiver sees and keeps one broken third
 * party from blanking the whole report.
 */
export async function evaluateSpf(
  record: string,
  resolveTxt: (name: string) => Promise<string[]>,
  depth = 0,
  seen: Set<string> = new Set()
): Promise<SpfEvaluation> {
  const terms = parseSpfTerms(record);
  const directIncludes: string[] = [];
  const includes: string[] = [];
  const emptyIncludes: string[] = [];
  let lookups = 0;
  let truncated = false;
  let authorizing = terms.filter((t) => AUTHORIZING_MECHANISMS.test(t.name)).length;

  const allTerm = terms.find((t) => t.name === 'all');
  // parseSpfTerms strips the qualifier, so recover it from the raw record.
  const allMatch = record.match(/(^|\s)([+\-~?]?)all(\s|$)/i);
  const allQualifier = allTerm ? allMatch?.[2] || '+' : null;

  for (const term of terms) {
    if (!term.costsLookup) continue;
    lookups += 1;

    const target = term.value;
    if ((term.name !== 'include' && term.name !== 'redirect') || !target) continue;

    if (depth === 0) directIncludes.push(target);
    includes.push(target);

    // A cycle, or a nest deeper than any real policy, is not worth chasing.
    // `seen` is shared across siblings, so a target reached twice is skipped —
    // do NOT judge such an include empty, because we never looked at it.
    if (seen.has(target) || depth + 1 >= MAX_SPF_DEPTH || lookups > SPF_LOOKUP_LIMIT) {
      truncated = true;
      continue;
    }
    seen.add(target);

    let nested: string[];
    try {
      nested = await resolveTxt(target);
    } catch {
      // Unresolvable is unknown, not empty.
      truncated = true;
      continue;
    }

    const { record: nestedSpf } = findSpf(nested);
    if (!nestedSpf) {
      // Resolves, but publishes no SPF at all: it authorizes nobody.
      if (depth === 0) emptyIncludes.push(target);
      continue;
    }

    const sub = await evaluateSpf(nestedSpf, resolveTxt, depth + 1, seen);
    lookups += sub.lookups;
    includes.push(...sub.includes);
    authorizing += sub.authorizing;
    truncated ||= sub.truncated;

    // Only a subtree we fully walked can be called empty with confidence.
    if (depth === 0 && sub.authorizing === 0 && !sub.truncated) emptyIncludes.push(target);
  }

  return { lookups, includes, directIncludes, emptyIncludes, authorizing, allQualifier, truncated };
}

/* -------------------------------------------------------------------------- */
/* DMARC                                                                       */
/* -------------------------------------------------------------------------- */

export interface DmarcEvaluation {
  record: string;
  /** `none`, `quarantine` or `reject`; null when the tag is missing. */
  policy: string | null;
  /** Percentage of mail the policy applies to. Defaults to 100 per RFC 7489. */
  pct: number;
  /** True when a `rua=` aggregate-report address is present. */
  hasReporting: boolean;
}

export function parseDmarc(txt: string[]): DmarcEvaluation | null {
  const record = txt.find((t) => /^v=DMARC1(\s*;|$)/i.test(t.trim()));
  if (!record) return null;

  const tag = (name: string) => {
    const m = record.match(new RegExp(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`, 'i'));
    return m?.[2]?.trim() ?? null;
  };

  const pctRaw = tag('pct');
  const pct = pctRaw !== null && /^\d+$/.test(pctRaw) ? Number(pctRaw) : 100;

  return {
    record,
    policy: tag('p')?.toLowerCase() ?? null,
    pct,
    hasReporting: tag('rua') !== null,
  };
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

export interface Check {
  id: string;
  label: string;
  severity: Severity;
  detail: string;
}

export interface DomainFacts {
  mxHosts: string[];
  spfRecord: string | null;
  spfCount: number;
  spf: SpfEvaluation | null;
  dmarc: DmarcEvaluation | null;
}

export interface DomainHealth extends DomainFacts {
  domain: string;
  sends: boolean;
  mxProvider: MxProvider;
  /** Direct includes present but not in the spec — a sender we do not recognise. */
  unexpectedIncludes: string[];
  /** Spec includes absent from the record — a sender that will fail SPF. */
  missingIncludes: string[];
  checks: Check[];
  /** The worst severity across `checks`, for sorting and the row badge. */
  worst: Severity;
}

const RANK: Record<Severity, number> = { ok: 0, unknown: 0, warn: 1, fail: 2 };

/**
 * The row's headline severity: the worst *actionable* check.
 *
 * `unknown` deliberately ranks alongside `ok` rather than between `ok` and
 * `warn`. The only unknown is DKIM, which is never checked, so ranking it higher
 * would pin every row — including a fully migrated, fully healthy one — to
 * "unknown" permanently, and a badge that never goes green is a badge nobody
 * reads. The DKIM caveat is stated once on the page instead.
 */
export function worstOf(checks: Check[]): Severity {
  return checks.reduce<Severity>((acc, c) => (RANK[c.severity] > RANK[acc] ? c.severity : acc), 'ok');
}

/**
 * Turn resolved DNS facts into the graded checks the admin page renders.
 *
 * Pure so the grading is testable without a network, and so the thresholds are
 * asserted rather than buried in a template.
 */
export function buildDomainHealth(spec: DomainSpec, facts: DomainFacts): DomainHealth {
  const checks: Check[] = [];
  const mxProvider = classifyMx(facts.mxHosts);

  // --- MX ---
  if (mxProvider === 'cloudflare') {
    checks.push({ id: 'mx', label: 'MX', severity: 'ok', detail: 'Cloudflare Email Routing' });
  } else if (mxProvider === 'forwardemail') {
    checks.push({
      id: 'mx',
      label: 'MX',
      severity: 'warn',
      detail: 'Still on Forward Email — not yet cut over',
    });
  } else if (mxProvider === 'none') {
    checks.push({ id: 'mx', label: 'MX', severity: 'fail', detail: 'No MX record: inbound mail is rejected' });
  } else {
    checks.push({ id: 'mx', label: 'MX', severity: 'warn', detail: `Unrecognised host: ${facts.mxHosts.join(', ')}` });
  }

  // --- SPF presence ---
  if (facts.spfCount > 1) {
    checks.push({
      id: 'spf',
      label: 'SPF',
      severity: 'fail',
      detail: `${facts.spfCount} SPF records published; more than one is a permerror`,
    });
  } else if (!facts.spfRecord) {
    checks.push({
      id: 'spf',
      label: 'SPF',
      severity: spec.sends ? 'fail' : 'warn',
      detail: spec.sends
        ? 'No SPF record: outbound mail is unauthenticated'
        : 'No SPF record: publish `v=spf1 -all` to state that this domain never sends',
    });
  } else {
    checks.push({ id: 'spf', label: 'SPF', severity: 'ok', detail: facts.spfRecord });
  }

  // --- SPF lookup budget ---
  // The limit is a cliff, not a gradient: at 11 the whole record is a permerror,
  // so 8 is worth a warning while there is still room to act.
  if (facts.spf) {
    const n = facts.spf.lookups;
    checks.push({
      id: 'spf-lookups',
      label: 'SPF lookups',
      severity: n > SPF_LOOKUP_LIMIT ? 'fail' : n >= SPF_LOOKUP_LIMIT - 2 ? 'warn' : 'ok',
      detail:
        n > SPF_LOOKUP_LIMIT
          ? `${n} of ${SPF_LOOKUP_LIMIT} — over the limit, the record is a permerror`
          : `${n} of ${SPF_LOOKUP_LIMIT}`,
    });
  }

  // --- SPF senders ---
  const direct = facts.spf?.directIncludes ?? [];
  const unexpectedIncludes = direct.filter((i) => !spec.expectedIncludes.includes(i));
  const missingIncludes = spec.expectedIncludes.filter((i) => !direct.includes(i));

  if (facts.spfRecord) {
    if (unexpectedIncludes.length) {
      checks.push({
        id: 'spf-unexpected',
        label: 'Unrecognised senders',
        severity: 'warn',
        detail: `${unexpectedIncludes.map(senderLabel).join(', ')} — authorised but not in use`,
      });
    }
    if (missingIncludes.length) {
      checks.push({
        id: 'spf-missing',
        label: 'Missing senders',
        severity: 'fail',
        detail: `${missingIncludes.map(senderLabel).join(', ')} — sends but is not authorised`,
      });
    }
    // An include that grants nothing is worse than an absent one: it reads as
    // "this provider is authorised" while costing a lookup and authorising
    // nobody. Fixing it means the provider's DKIM, not a different include.
    if (facts.spf?.emptyIncludes.length) {
      checks.push({
        id: 'spf-empty',
        label: 'Includes granting nothing',
        severity: 'warn',
        detail: `${facts.spf.emptyIncludes.map(senderLabel).join(', ')} — resolves but authorises no sender`,
      });
    }
    // A trailing `+all` authorises the entire internet.
    if (facts.spf && (facts.spf.allQualifier === '+' || facts.spf.allQualifier === null)) {
      checks.push({
        id: 'spf-all',
        label: 'SPF default',
        severity: 'fail',
        detail: facts.spf.allQualifier === '+' ? '`+all` authorises every sender' : 'No `all` mechanism',
      });
    }
  }

  // --- DMARC ---
  if (!facts.dmarc) {
    checks.push({ id: 'dmarc', label: 'DMARC', severity: 'fail', detail: 'No DMARC record' });
  } else if (facts.dmarc.policy === 'none') {
    checks.push({
      id: 'dmarc',
      label: 'DMARC',
      severity: 'warn',
      detail: 'p=none — monitoring only, nothing is enforced',
    });
  } else {
    checks.push({
      id: 'dmarc',
      label: 'DMARC',
      severity: 'ok',
      detail: `p=${facts.dmarc.policy}${facts.dmarc.pct < 100 ? ` (pct=${facts.dmarc.pct})` : ''}`,
    });
  }

  // --- DKIM ---
  // SES DKIM lives at three CNAMEs on per-identity tokens that cannot be derived
  // from the domain name. Reporting 'unknown' is honest; reporting 'ok' because
  // we did not look would be worse than not having the row at all.
  checks.push({
    id: 'dkim',
    label: 'DKIM',
    severity: 'unknown',
    detail: 'Not checked — SES selector tokens are not stored in this repo',
  });

  return {
    domain: spec.domain,
    sends: spec.sends,
    ...facts,
    mxProvider,
    unexpectedIncludes,
    missingIncludes,
    checks,
    worst: worstOf(checks),
  };
}
