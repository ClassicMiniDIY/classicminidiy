import type { CaptureResult } from 'posthog-js';

/**
 * Keep the DiscourseConnect `sso` and `sig` values out of PostHog.
 *
 * The forum sends the browser to /discourse/sso?sso=…&sig=…, and a signed-out
 * user carries that URL through /login?redirect=… (docs/plans/2026-10-03-discourse-sso.md).
 * posthog-js copies the page URL into every event (`$current_url`, the manual
 * `$pageview` `current_url`, `$pageleave`, session entry and initial-URL
 * person properties). This runs as the `before_send` hook in
 * app/plugins/posthog.ts and drops the query in both shapes.
 */

const FORUM_SSO_PATH = '/discourse/sso';
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;
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

function redactValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactForumSsoUrl(value);
  if (depth <= 0 || value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) record[key] = redactValue(record[key], depth - 1);
  return value;
}

/** posthog-js `before_send` hook. Edits the event in place and returns it. */
export function redactForumSsoEvent(event: CaptureResult | null): CaptureResult | null {
  // Session-replay payloads are large and deeply nested; they are out of scope here.
  if (!event || event.event === '$snapshot') return event;
  redactValue(event.properties, MAX_DEPTH);
  if (event.$set) redactValue(event.$set, MAX_DEPTH);
  if (event.$set_once) redactValue(event.$set_once, MAX_DEPTH);
  return event;
}
