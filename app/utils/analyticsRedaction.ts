import type { CaptureResult } from 'posthog-js';

/**
 * Keep the DiscourseConnect `sso` and `sig` values out of PostHog.
 *
 * The forum sends the browser to /discourse/sso?sso=…&sig=…, and a signed-out
 * user carries that URL through /login?redirect=… (docs/plans/2026-10-03-discourse-sso.md).
 * posthog-js copies the page URL into every event (`$current_url`, the manual
 * `$pageview` `current_url`, `$pageleave`, session entry and initial-URL
 * person properties, and autocapture's `$elements_chain`). This runs as the
 * `before_send` hook in app/plugins/posthog.ts and drops the query in every
 * shape. The page also marks the link that carries it `ph-no-capture`.
 */

const FORUM_SSO_PATH = '/discourse/sso';
const ABSOLUTE_URL = /^https?:\/\//i;
/** How deep into an event's property objects to look. URLs sit at depth 0-1. */
const MAX_DEPTH = 3;

/**
 * `…/discourse/sso?…` loses its query. A URL whose `redirect` parameter points
 * at `/discourse/sso?…` keeps the parameter as the bare path. Anything else is
 * returned unchanged.
 */
export function redactForumSsoUrl(value: string): string {
  // Fast path: every shape we redact contains this word, raw or URL-encoded.
  if (!value.includes('discourse')) return value;
  // Parse only what is a URL: an http(s) URL or a site path. Free text such as
  // `$elements_chain` can parse as an odd-scheme URL and must not be rebuilt.
  if (!ABSOLUTE_URL.test(value) && !(value.startsWith('/') && !value.startsWith('//'))) return value;
  let url: URL;
  try {
    url = new URL(value, 'https://redaction.invalid');
  } catch {
    return value;
  }
  if (url.pathname === FORUM_SSO_PATH) {
    if (!url.search) return value;
    url.search = '';
  } else {
    const redirect = url.searchParams.get('redirect');
    if (!redirect || redirect === FORUM_SSO_PATH || !redirect.startsWith(`${FORUM_SSO_PATH}?`)) return value;
    url.searchParams.set('redirect', FORUM_SSO_PATH);
  }
  return ABSOLUTE_URL.test(value) ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

// `/discourse/sso?…`, raw or URL-encoded, inside free text such as
// `$elements_chain` (`…attr__href="/login?redirect=%2Fdiscourse%2Fsso%3Fsso%3D…"`).
// The query runs to the next quote, whitespace or `;`; the encoded form also
// stops at a raw `&`, which starts the next outer parameter.
const RAW_SSO_QUERY = /(\/discourse\/sso)\?[^"'\s;]*/g;
const ENCODED_SSO_QUERY = /(%2Fdiscourse%2Fsso)%3F[^&"'\s;]*/gi;

/** Drop the query from every `/discourse/sso?…` in a non-URL string. */
export function redactForumSsoText(value: string): string {
  if (!value.includes('discourse')) return value;
  return value.replace(RAW_SSO_QUERY, '$1').replace(ENCODED_SSO_QUERY, '$1');
}

function redactString(value: string): string {
  return redactForumSsoText(redactForumSsoUrl(value));
}

/**
 * Redact strings in place, at most `depth` levels down. A key is written only
 * when its value changed, so unchanged, frozen or read-only properties are
 * never assigned; a write that still fails is skipped.
 */
function redactValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactString(value);
  if (depth <= 0 || value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const before = record[key];
    const after = redactValue(before, depth - 1);
    if (after === before) continue;
    try {
      record[key] = after;
    } catch {
      // Frozen or read-only: leave it as it is.
    }
  }
  return value;
}

/** posthog-js `before_send` hook. Edits the event in place and returns it. */
export function redactForumSsoEvent(event: CaptureResult | null): CaptureResult | null {
  // Session-replay payloads are not walked: replay must be disabled on
  // /discourse/sso in PostHog settings (docs/plans/2026-10-03-discourse-sso.md).
  if (!event || event.event === '$snapshot') return event;
  redactValue(event.properties, MAX_DEPTH);
  if (event.$set) redactValue(event.$set, MAX_DEPTH);
  if (event.$set_once) redactValue(event.$set_once, MAX_DEPTH);
  return event;
}
