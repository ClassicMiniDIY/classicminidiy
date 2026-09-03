import { requireAdminAuth } from '../../../utils/adminAuth';
import {
  MAIL_DOMAINS,
  buildDomainHealth,
  evaluateSpf,
  findSpf,
  parseDmarc,
  type DomainHealth,
} from '../../../utils/emailHealth';

/**
 * GET /api/admin/email/health — live DNS mail posture for the three domains.
 *
 * Design doc: docs/plans/2026-09-03-forward-email-retirement.md
 *
 * Resolution is DNS-over-HTTPS rather than `node:dns`: the resolver is not part
 * of the Workers runtime contract, whereas `fetch` is available everywhere this
 * deploys. It is also the same transport the SSRF guard's own comments point at.
 *
 * Read-only, and deliberately so. Routing changes belong in the Cloudflare
 * dashboard — holding a zone-write token in the Worker to save a few clicks is a
 * bad trade, and it is the same line `scripts/sync-cf-zone-settings.py` draws.
 */

const DOH = 'https://cloudflare-dns.com/dns-query';

interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

/**
 * One DoH query.
 *
 * NOERROR (0) and NXDOMAIN (3) are both determinations: the name either has
 * records of this type or it provably does not, and both mean "no record" to
 * every check here. Every other RCODE — SERVFAIL, REFUSED — is a failure to
 * determine, and collapsing those to an empty list is how a transient resolver
 * blip gets rendered as `No MX record: inbound mail is rejected`, which is the
 * alarm for a total inbound outage. Those throw instead, so the caller can tell
 * the two apart.
 */
async function query(name: string, type: 'TXT' | 'MX'): Promise<string[]> {
  const url = `${DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await $fetch<{ Status: number; Answer?: DohAnswer[] }>(url, {
    headers: { accept: 'application/dns-json' },
    timeout: 5000,
  });
  if (res.Status !== 0 && res.Status !== 3) {
    throw new Error(`DNS lookup for ${type} ${name} failed with RCODE ${res.Status}`);
  }
  if (!res.Answer) return [];
  // Filter by type: a CNAME in the chain arrives in the same Answer array.
  const want = type === 'TXT' ? 16 : 15;
  return res.Answer.filter((a) => a.type === want).map((a) => a.data);
}

/**
 * TXT strings arrive quoted, and a record over 255 bytes arrives as several
 * quoted chunks that must be concatenated with no separator. amazonses.com's
 * SPF record is split this way, so getting this wrong truncates its mechanisms
 * and silently undercounts the lookup budget.
 */
function unquoteTxt(data: string): string {
  const chunks = data.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!chunks) return data.trim();
  return chunks.map((c) => c.slice(1, -1).replace(/\\"/g, '"')).join('');
}

async function txt(name: string): Promise<string[]> {
  return (await query(name, 'TXT')).map(unquoteTxt);
}

/** MX answers arrive as "<priority> <host>". Only the host matters here. */
async function mx(name: string): Promise<string[]> {
  return (await query(name, 'MX')).map((d) => d.trim().split(/\s+/)[1] ?? '').filter(Boolean);
}

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);

  // One memo for the whole request. amazonses.com appears in two domains' SPF
  // chains, and without this it is resolved twice per page load.
  const memo = new Map<string, Promise<string[]>>();
  const resolveTxt = (name: string) => {
    if (!memo.has(name)) memo.set(name, txt(name));
    return memo.get(name)!;
  };

  /** Resolve, or report that we could not — never conflate the two. */
  const attempt = async <T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
    try {
      return { ok: true, value: await p };
    } catch {
      return { ok: false };
    }
  };

  const domains: DomainHealth[] = await Promise.all(
    MAIL_DOMAINS.map(async (spec) => {
      const [mxRes, apexRes, dmarcRes] = await Promise.all([
        attempt(mx(spec.domain)),
        attempt(resolveTxt(spec.domain)),
        attempt(txt(`_dmarc.${spec.domain}`)),
      ]);

      const apexTxt = apexRes.ok ? apexRes.value : [];
      const { record: spfRecord, count: spfCount } = findSpf(apexTxt);
      const spfRes = spfRecord ? await attempt(evaluateSpf(spfRecord, resolveTxt)) : null;

      return buildDomainHealth(spec, {
        mxHosts: mxRes.ok ? mxRes.value : [],
        mxResolved: mxRes.ok,
        spfRecord,
        spfCount,
        spfResolved: apexRes.ok,
        spf: spfRes?.ok ? spfRes.value : null,
        dmarc: dmarcRes.ok ? parseDmarc(dmarcRes.value) : null,
        dmarcResolved: dmarcRes.ok,
      });
    })
  );

  return { checkedAt: new Date().toISOString(), domains };
});
