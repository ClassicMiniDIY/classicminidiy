// @vitest-environment node
/**
 * Every `/api/...` path the browser asks for must have a handler behind it.
 *
 * This is the cheapest possible guard against a defect class that has shipped
 * here twice. `PUT /api/admin/listings/[id]/status` and `.../tier` were called
 * by `useAdmin()` from the TME cutover until 2026-08-12 but never ported, so
 * every approve/reject/relist click 404'd — and because paid listings were
 * simultaneously stuck in `draft`, the paid pipeline was dead at both ends for
 * a month with a fully green test suite.
 *
 * The failure is quiet by construction: an unmatched path falls through to
 * `server/api/[...].ts`, which answers a clean JSON 404. When the caller wraps
 * it in `.catch(console.error)`, the UI reports success and nothing anywhere
 * records that the action did not happen.
 *
 * Paths are resolved structurally against the `server/api/**` file tree the way
 * Nitro derives routes from filenames, so `[id]` matches any single segment and
 * `[...slug]` matches the rest.
 */
import { describe, expect, it } from 'vitest';
import { describeViolations, diffAgainstAllowlist, read, rel, searchableSource, walk } from './_scan';

const HTTP_METHOD_SUFFIXES = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/**
 * Client calls that currently resolve to nothing. Each is a user-visible action
 * that silently does not happen. Remove an entry when its route lands (or when
 * the dead caller is deleted).
 */
const KNOWN_MISSING_ROUTES: readonly string[] = [
  // Admin "clean up orphaned storage" — throws to the UI.
  'app/composables/useAdmin.ts -> /api/admin/storage/cleanup-orphans',
  // Watchers are never told a listing sold; the success toast claims they were.
  'app/pages/dashboard/listings.vue -> /api/exchange/notifications/watchlist-sold',
  // Price-drop notifications never fire; failure is swallowed by .catch().
  'app/pages/exchange/listings/[slug]/edit.vue -> /api/exchange/notifications/price-drop',
];

/**
 * Files under `server/api/` or `server/routes/` that export no default handler.
 * Nitro's scan glob is `**\/*.{js,mjs,cjs,ts,...}` with no underscore
 * exclusion, so a helper module parked in the route tree becomes a real,
 * publicly reachable route with nothing behind it. Shared helpers belong in
 * `server/utils/`.
 */
const KNOWN_HANDLERLESS_ROUTE_FILES: readonly string[] = ['server/api/langgraph/_utils.ts'];

interface ServerRoute {
  method: string;
  segments: string[];
  file: string;
  /** The bare `server/api/[...].ts` 404 responder — matches everything and
   * therefore proves nothing. Real catch-alls like the LangGraph proxy are
   * genuine handlers and must still match. */
  isRootCatchAll: boolean;
}

function toServerRoutes(dir: string, prefix: string): ServerRoute[] {
  return walk(dir, '.ts').map((abs) => {
    const relative = rel(abs).slice(`${dir}/`.length);
    let path = `${prefix}/${relative.replace(/\.ts$/, '')}`;
    let method = 'ANY';
    const suffix = path.match(new RegExp(`\\.(${HTTP_METHOD_SUFFIXES.join('|')})$`));
    if (suffix) {
      method = suffix[1]!.toUpperCase();
      path = path.slice(0, -(suffix[1]!.length + 1));
    }
    path = path.replace(/\/index$/, '') || prefix;
    const segments = path.split('/').filter(Boolean);
    const isRootCatchAll = segments.length === 2 && segments[0] === 'api' && segments[1]!.startsWith('[...');
    return { method, segments, file: rel(abs), isRootCatchAll };
  });
}

const serverRoutes = [...toServerRoutes('server/api', '/api'), ...toServerRoutes('server/routes', '')];

/** `${...}` becomes a wildcard segment; anything else stays literal. */
function normalisePath(raw: string): string[] {
  return raw
    .replace(/\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, ':param')
    .split('?')[0]!
    .split('/')
    .filter(Boolean);
}

function segmentMatches(routeSegment: string, callSegment: string | undefined): boolean {
  if (callSegment === undefined) return false;
  return /^\[.*\]$/.test(routeSegment) || routeSegment === callSegment;
}

function routeMatches(callSegments: string[], route: ServerRoute): boolean {
  const catchAllAt = route.segments.findIndex((s) => s.startsWith('[...'));
  if (catchAllAt >= 0) {
    return (
      callSegments.length >= catchAllAt &&
      route.segments.slice(0, catchAllAt).every((s, i) => segmentMatches(s, callSegments[i]))
    );
  }
  if (callSegments.length !== route.segments.length) return false;
  return route.segments.every((s, i) => segmentMatches(s, callSegments[i]));
}

interface ClientCall {
  path: string;
  file: string;
}

/** Every `/api/...` string literal or template literal in browser-side code. */
function collectClientCalls(): ClientCall[] {
  const files = [...walk('app', '.vue'), ...walk('app', '.ts'), ...walk('shared', '.ts')];
  const calls: ClientCall[] = [];
  for (const abs of files) {
    // Comments carry example paths (`'/api/...'` appears in a Needles.vue note
    // explaining the useFetch getter-form trap), so they are blanked first —
    // per block, because `//` is a comment in script and an ordinary
    // protocol-relative URL in a template.
    const source = searchableSource(abs);
    const quoted = /(['"])(\/api\/[^'"\n]*)\1/g;
    const templated = /`(\/api\/(?:[^`\\]|\\.)*)`/g;
    for (const pattern of [quoted, templated]) {
      for (const match of source.matchAll(pattern)) {
        const path = (pattern === quoted ? match[2] : match[1])!;
        // `/api/langgraph/*` in app/plugins/botid.client.ts is a route-matching
        // GLOB for BotID config, not a request. A `*` never appears in a real
        // request path here.
        if (path.includes('*')) continue;
        calls.push({ path, file: rel(abs) });
      }
    }
  }
  return calls;
}

const clientCalls = collectClientCalls();

describe('client → server API contract', () => {
  it('found both sides of the contract', () => {
    // A regex regression that matched nothing would make every check below
    // vacuously pass, which is exactly the failure mode this suite exists for.
    expect(serverRoutes.length).toBeGreaterThan(100);
    expect(clientCalls.length).toBeGreaterThan(100);
  });

  it('every client /api/ call resolves to a handler', () => {
    // The bare `/api/[...]` responder is a 404, not a handler — matching
    // against it would make every possible path "resolve".
    const realRoutes = serverRoutes.filter((r) => !r.isRootCatchAll);
    const unresolved = clientCalls
      .filter((call) => {
        const segments = normalisePath(call.path);
        return !realRoutes.some((route) => routeMatches(segments, route));
      })
      .map((call) => `${call.file} -> ${call.path}`);

    const { unexpected, stale } = diffAgainstAllowlist([...new Set(unresolved)], KNOWN_MISSING_ROUTES);
    expect(
      unexpected,
      describeViolations('client calls to API paths with no handler (they will 404 at runtime)', unexpected)
    ).toEqual([]);
    expect(
      stale,
      describeViolations('stale KNOWN_MISSING_ROUTES entries (the route landed — drop them)', stale)
    ).toEqual([]);
  });

  it('every file under server/api and server/routes exports a default handler', () => {
    const actual = [...walk('server/api', '.ts'), ...walk('server/routes', '.ts')]
      .filter((abs) => !/export\s+default/.test(read(abs)))
      .map(rel);
    const { unexpected, stale } = diffAgainstAllowlist(actual, KNOWN_HANDLERLESS_ROUTE_FILES);
    expect(
      unexpected,
      describeViolations('route files with no handler — move shared helpers to server/utils/', unexpected)
    ).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_HANDLERLESS_ROUTE_FILES entries', stale)).toEqual([]);
  });
});
