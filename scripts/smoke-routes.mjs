#!/usr/bin/env node
/**
 * Route smoke crawler.
 *
 * Walks every page route against a running server and asserts the things that
 * only exist once a route has actually been RENDERED. The unit suite has 5,000+
 * assertions and none of them can see any of this — which is why an
 * empty-string `ogImage` 500'd /archive/colors/[id] for months, why the
 * site-wide catch-all answered 200 with `<title>undefined …</title>` for every
 * unknown URL, and why a Nuxt upgrade silently emptied every schema.org block.
 *
 * Usage:
 *   node scripts/smoke-routes.mjs [baseUrl] [--strict] [--only <substring>] [--json]
 *
 *   baseUrl   defaults to http://localhost:3000
 *   --strict  promote warnings to failures (used once a category is clean)
 *   --only    crawl just the routes containing this substring
 *   --json    machine-readable report on stdout
 *
 * Exits non-zero on any error-level finding, so it can gate CI.
 */
import process from 'node:process';
import {
  DYNAMIC_SOURCES,
  KNOWN_ERRORS,
  MUST_404,
  MUST_NOT_REDIRECT,
  MUST_REDIRECT,
  STATIC_ROUTES,
  expectationsFor,
} from '../tests/fixtures/route-manifest.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const optionValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const BASE_URL = (args.find((a) => a.startsWith('http')) ?? 'http://localhost:3000').replace(/\/$/, '');
const STRICT = flag('--strict');
const ONLY = optionValue('--only');
const AS_JSON = flag('--json');
/**
 * Numeric options are validated rather than coerced. `Number('abc')` is NaN,
 * and a NaN concurrency makes `Array.from({length: Math.min(NaN, n)})` build
 * ZERO runners — the pool resolves instantly, nothing is crawled, and the
 * script exits 0. A typo would silently turn the whole gate into a no-op that
 * reports success, so it fails loudly instead.
 */
const numericOption = (name, fallback) => {
  const raw = optionValue(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`${name} must be a positive number, got: ${raw}`);
    process.exit(2);
  }
  return value;
};

/** Concurrency. Kept low: a dev server compiles routes on first hit. */
const CONCURRENCY = numericOption('--concurrency', 4);
const TIMEOUT_MS = numericOption('--timeout', 45_000);

const findings = [];
const record = (level, route, check, detail) => findings.push({ level, route, check, detail });

async function get(path, { redirect = 'manual' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      redirect,
      signal: controller.signal,
      headers: { 'user-agent': 'cmdiy-smoke-routes/1.0', accept: 'text/html,application/xhtml+xml' },
    });
    const body = response.headers.get('content-type')?.includes('text/html') ? await response.text() : '';
    return { status: response.status, location: response.headers.get('location'), body };
  } finally {
    clearTimeout(timer);
  }
}

// ── HTML probes ──────────────────────────────────────────────────────────────
// Deliberately regex, not a DOM library: this script must run with zero install
// on a machine that has only cloned the repo, like the other scripts/ tools.

/**
 * SSR output keeps the template's HTML comments, and several of them quote
 * historical error messages verbatim (`/chat` documents the nuxt-schema-org
 * "Cannot read properties of undefined" incident in a comment). Strip them
 * before any content check, or the crawler reports the documentation as the
 * defect.
 */
const stripComments = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    // An unterminated `<!--` comments out the rest of the document, so anything
    // after it must not be read as page structure. Without this, a page with a
    // dangling comment containing markup counted a COMMENTED-OUT <h1> as real:
    //   '<h1>Real</h1><!-- <h1>Commented</h1>'  ->  2 headings, should be 1
    // which would surface as a false finding in the <h1> check below. Same
    // treatment stripScripts already gives an unterminated <script>.
    .replace(/<!--[\s\S]*$/g, '');

/**
 * Drop <script> and <style> bodies. Nuxt serialises page data into a script
 * tag, so user content containing markup would otherwise be read as page
 * structure.
 *
 * The `\s*` before the closing `>` is load-bearing. `</script >` and
 * `</style\n>` are legal HTML, and without it neither matches at all — so the
 * ENTIRE body survives the strip and feeds into the <h1> count and the raw-i18n
 * scan below. Measured: `<script>x</script >` came through untouched.
 *
 * The `(?=[\s>/])` lookahead is equally load-bearing, in the other direction:
 * without it `<(script|style)` matches the PREFIX of `<scriptable>`, and the
 * second replace then drops the rest of the document. Measured:
 * `<scriptable>hi</scriptable><h1>t</h1>` collapsed to `''`, losing a real
 * heading. The lookahead pins the match to a tag-name boundary.
 *
 * (Raised by CodeQL js/incomplete-multi-character-sanitization. Note the rule
 * still fires on the first replace in isolation — it cannot see that the second
 * removes the residue. Verified by construction that no `<script` survives the
 * pair; the remaining alert is a false positive and is dismissed as such.)
 */
const stripScripts = (html) =>
  html
    // Matched pairs. `\s*` before the closing `>` is load-bearing — see above.
    .replace(/<(script|style)(?=[\s>/])[\s\S]*?<\/\1\s*>/gi, '')
    // Anything still opening a script/style has no close, so as far as any
    // parser is concerned the rest of the document is inside it. Dropping to
    // end-of-string is the conservative reading.
    .replace(/<(script|style)(?=[\s>/])[\s\S]*$/gi, '');

// `(?=[\s>])` for the same reason as stripScripts: without it, `<title[^>]*>`
// matches the prefix of `<titlebar>` and the capture runs on past the real
// title. Measured: `<titlebar>junk</titlebar><title>Real</title>` returned
// "junk</titlebar><title>Real". Title is an ERROR-level check here, so a
// mis-parse is a spurious build failure, not just a wrong warning.
const titleOf = (html) => html.match(/<title(?=[\s>])[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]?.trim() ?? null;
const h1Count = (html) => (stripScripts(html).match(/<h1[\s>]/gi) ?? []).length;
const hasCanonical = (html) => /<link[^>]+rel=["']canonical["']/i.test(html);
const isNoindex = (html) => /<meta(?=[\s])[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
const ogImage = (html) =>
  html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? null;

function jsonLdBlocks(html) {
  return [
    ...html.matchAll(/<script(?=[\s])[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi),
  ].map((m) => m[1].trim());
}

/**
 * Every tag-matching regex in this file pins the tag NAME with a `(?=[\s>/])`
 * lookahead and accepts whitespace before a closing `>`. Both halves were found
 * the hard way while fixing a CodeQL alert:
 *
 *   `<title[^>]*>` matched the prefix of `<titlebar>`, running the capture past
 *   the real title; `<meta[^>]+…robots…>` matched `<metadata name="robots">`;
 *   and `<\/script>` without `\s*` missed `</script >`, which made a present
 *   schema.org block read as absent.
 *
 * These are error- and warning-level checks against LIVE production HTML, so a
 * mis-parse is a spurious CI failure. If you add a tag regex here, pin it the
 * same way.
 */

/**
 * Visible text that looks like an untranslated i18n key — `foo.bar_baz` alone
 * inside an element. `missingWarn` is off in i18n.config.ts, so a missing key
 * renders its own path with no warning anywhere.
 */
function rawI18nKeys(html) {
  const withoutScripts = stripScripts(html);
  const keyLike = /> *([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+) *</g;
  const hits = new Set();
  for (const match of withoutScripts.matchAll(keyLike)) {
    const candidate = match[1];
    // Filenames, versions and domains are not i18n keys.
    if (/\.(js|ts|json|png|jpe?g|svg|webp|pdf|txt|xml|css|html?|com|co|uk|io|org|net)$/.test(candidate)) continue;
    if (/^\d/.test(candidate)) continue;
    hits.add(candidate);
  }
  return [...hits];
}

// ── Per-route checks ─────────────────────────────────────────────────────────

function checkRenderedPage(route, rawHtml, expectations) {
  const html = stripComments(rawHtml);
  const title = titleOf(html);
  if (!title) record('error', route, 'title', 'no <title>');
  else if (/undefined|null|NaN/.test(title)) record('error', route, 'title', `suspicious title: ${title}`);

  if (/__NUXT_ERROR__|Cannot read properties of undefined|500 - Server Error/.test(html)) {
    record('error', route, 'error-payload', 'page body carries an error payload');
  }

  const keys = rawI18nKeys(html);
  if (keys.length) record('warn', route, 'raw-i18n-key', `${keys.length}: ${keys.slice(0, 5).join(', ')}`);

  const headings = h1Count(html);
  if (!expectations.allowNoH1 && headings !== 1) {
    record('warn', route, 'h1', `${headings} <h1> elements (expected exactly 1)`);
  }

  if (!expectations.noindex && !isNoindex(html) && !hasCanonical(html)) {
    record('warn', route, 'canonical', 'indexable page with no <link rel=canonical>');
  }

  if (!expectations.allowNoJsonLd) {
    const blocks = jsonLdBlocks(html);
    if (blocks.length === 0) record('warn', route, 'json-ld', 'no application/ld+json block');
    else if (blocks.every((b) => b === '' || b === '{}')) {
      // An EMPTY ld+json is the exact shape of the nuxt-schema-org breakage the
      // 4.4.8 pin existed for. It is worse than none: it looks present.
      record('error', route, 'json-ld', 'schema.org block present but EMPTY');
    }
  }

  const image = ogImage(html);
  if (image !== null && !/^https?:\/\//.test(image)) {
    record('error', route, 'og-image', `og:image is not absolute: ${image || '(empty)'}`);
  }
}

async function crawlRoute(route) {
  const expectations = expectationsFor(route);
  const expected = expectations.expectStatus ?? 200;
  let result;
  try {
    result = await get(route);
  } catch (error) {
    record('error', route, 'fetch', String(error?.message ?? error));
    return;
  }
  if (result.status !== expected) {
    record('error', route, 'status', `expected ${expected}, got ${result.status}`);
    return;
  }
  // Only a rendered 200 has a body worth inspecting. A route we expect to
  // redirect has no title, no headings and no schema by definition.
  if (result.status === 200) checkRenderedPage(route, result.body, expectations);
}

async function crawl404(path) {
  try {
    const { status } = await get(path);
    if (status !== 404) record('error', path, 'must-404', `expected 404, got ${status}`);
  } catch (error) {
    record('error', path, 'fetch', String(error?.message ?? error));
  }
}

async function crawlRedirect({ from, to }) {
  try {
    const { status, location } = await get(from);
    if (status !== 301 && status !== 302) {
      record('error', from, 'must-redirect', `expected 301/302 to ${to}, got ${status}`);
      return;
    }
    if (!location) {
      record('error', from, 'must-redirect', `${status} with no Location header`);
      return;
    }
    // Location may be absolute or relative depending on who issues the
    // redirect (Nuxt middleware vs a Cloudflare zone rule). Compare paths.
    let target;
    try {
      target = new URL(location, BASE_URL).pathname;
    } catch {
      record('error', from, 'must-redirect', `unparseable Location: ${location}`);
      return;
    }
    if (!target.startsWith(to)) {
      record('error', from, 'must-redirect', `redirected to ${target}, expected ${to}`);
    }
  } catch (error) {
    record('error', from, 'fetch', String(error?.message ?? error));
  }
}

async function crawlMustNotRedirect(path) {
  try {
    const { status, location } = await get(path);
    if (status === 301 || status === 302) {
      record(
        'error',
        path,
        'must-not-redirect',
        `hijacked to ${location} — a substring redirect is swallowing a real slug`
      );
    }
  } catch (error) {
    record('error', path, 'fetch', String(error?.message ?? error));
  }
}

/**
 * Pull real content URLs out of the sitemap source endpoints. A source that
 * cannot be reached is reported as SKIPPED, not failed — a local dev box with
 * no Supabase credentials is a normal thing, and the static routes still
 * carry the run.
 */
async function resolveDynamicRoutes() {
  const resolved = [];
  for (const source of DYNAMIC_SOURCES) {
    try {
      const response = await fetch(`${BASE_URL}${source.endpoint}`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const entries = await response.json();
      if (!Array.isArray(entries) || entries.length === 0) throw new Error('source returned no URLs');
      const picked = entries
        .slice(0, source.sample)
        .map((entry) => (typeof entry === 'string' ? entry : entry.loc))
        .filter(Boolean);
      if (picked.length === 0) throw new Error('no loc field on entries');
      resolved.push(...picked);
    } catch (error) {
      record('skip', source.endpoint, 'discover', String(error?.message ?? error));
    }
  }
  return resolved;
}

async function runPool(items, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

async function main() {
  const matches = (value) => !ONLY || value.includes(ONLY);

  const dynamicRoutes = ONLY ? [] : await resolveDynamicRoutes();
  const pageRoutes = [...STATIC_ROUTES, ...dynamicRoutes].filter(matches);

  if (!AS_JSON) {
    console.log(`Crawling ${pageRoutes.length} page routes against ${BASE_URL}`);
  }

  await runPool(pageRoutes, crawlRoute);
  if (!ONLY) {
    await runPool(MUST_404, crawl404);
    await runPool(MUST_REDIRECT, crawlRedirect);
    await runPool(MUST_NOT_REDIRECT, crawlMustNotRedirect);
  }

  // Known errors are tracked open in GitHub issues. They do not fail the run,
  // but the list is shrink-only: an entry that stops reproducing is itself a
  // failure, so a fix cannot land without removing its entry.
  const knownSet = new Set(KNOWN_ERRORS);
  const idOf = (f) => `${f.route} [${f.check}]`;
  const rawErrors = findings.filter((f) => f.level === 'error');
  const known = rawErrors.filter((f) => knownSet.has(idOf(f)));
  const errors = rawErrors.filter((f) => !knownSet.has(idOf(f)));
  const warnings = findings.filter((f) => f.level === 'warn');
  const skips = findings.filter((f) => f.level === 'skip');
  const seen = new Set(rawErrors.map(idOf));
  // A filtered run never visits most routes, so "this known error did not
  // reproduce" carries no information. Only a full crawl can retire an entry.
  const staleKnown = ONLY ? [] : [...knownSet].filter((id) => !seen.has(id));

  if (AS_JSON) {
    console.log(JSON.stringify({ baseUrl: BASE_URL, routes: pageRoutes.length, findings }, null, 2));
  } else {
    const print = (label, list) => {
      if (!list.length) return;
      console.log(`\n${label} (${list.length}):`);
      for (const f of list) console.log(`  ${f.route}  [${f.check}]  ${f.detail}`);
    };
    print('SKIPPED', skips);
    print('KNOWN (tracked in an open issue)', known);
    print('WARN', warnings);
    print('ERROR', errors);
    if (staleKnown.length) {
      console.log(`\nSTALE KNOWN_ERRORS (${staleKnown.length}) — the fix landed, remove the entry:`);
      for (const id of staleKnown) console.log(`  ${id}`);
    }
    console.log(
      `\n${pageRoutes.length} routes crawled — ${errors.length} error(s), ${warnings.length} warning(s), ` +
        `${known.length} known, ${staleKnown.length} stale, ${skips.length} skipped.`
    );
  }

  const failed = errors.length + staleKnown.length + (STRICT ? warnings.length : 0);
  // Not process.exit(): stdout is asynchronous when piped, and exiting
  // immediately after a write truncates it — which would corrupt `--json`
  // output redirected to a file in CI. Setting the code lets the process end
  // once the stream has drained.
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
