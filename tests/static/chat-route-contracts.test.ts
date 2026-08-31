// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { blankComments, read, REPO_ROOT } from './_scan';
import { join } from 'node:path';

/**
 * `convertToModelMessages` must be awaited.
 *
 * It is ASYNC in AI SDK v7 and was synchronous in v6, so the upgrade shape is a
 * missing `await` — and the resulting failure names neither the call nor the
 * omission. `streamText` receives a Promise, `standardizePrompt` throws
 * "messages.some is not a function", the route's own `onError` catches it, and
 * the visitor sees a generic "An error occurred." The build is clean, the unit
 * suite is green, and the chat is completely dead.
 *
 * There is no unit test in front of this: covering the route means mocking the
 * whole AI SDK, at which point the mock decides whether the promise resolves and
 * the test proves nothing. A source-level assertion is crude but it catches the
 * one thing that actually goes wrong here.
 *
 * Comments are blanked first — this file's own rationale, and the route's,
 * mention the call by name.
 */
describe('chat route contracts', () => {
  const source = blankComments(read(join(REPO_ROOT, 'server/api/chat.post.ts')), 'script');

  it('awaits convertToModelMessages', () => {
    const calls = source.match(/convertToModelMessages\s*\(/g) ?? [];
    // The import line is not a call, so at least one call site must exist.
    expect(calls.length, 'chat.post.ts no longer calls convertToModelMessages').toBeGreaterThan(0);

    const awaited = source.match(/await\s+convertToModelMessages\s*\(/g) ?? [];
    expect(
      awaited.length,
      'convertToModelMessages is async in AI SDK v7. An un-awaited call hands streamText a Promise ' +
        'and kills the chat at runtime with "messages.some is not a function", while the build and ' +
        'the unit suite stay green.'
    ).toBe(calls.length);
  });

  it('never answers 401', () => {
    // The invariant in CLAUDE.md: /api/chat is OPTIONALLY authenticated and must
    // never *require* auth. A 401 would break the surface's reason to exist —
    // the assistant has to work for every anonymous visitor. An exhausted quota
    // is a 429 with an upgrade pointer, which is a different thing entirely.
    expect(source).not.toMatch(/statusCode:\s*401/);
    expect(source).not.toMatch(/requireUserAuth/);
  });

  it('consumes the quota BEFORE the model runs', () => {
    // A quota checked after the stream is not a quota — the tokens are already
    // spent. Enforce ordering at the source level, since no unit test can see it.
    const consume = source.indexOf('consumeChatQuota');
    const stream = source.indexOf('streamText(');
    expect(consume, 'chat.post.ts no longer consumes a quota').toBeGreaterThan(-1);
    expect(stream).toBeGreaterThan(-1);
    expect(consume, 'consumeChatQuota must run before streamText').toBeLessThan(stream);
  });

  it('checks the model credential explicitly rather than trusting truthiness downstream', () => {
    // An absent private runtimeConfig value is an EMPTY STRING, not undefined.
    // Without an explicit check the empty key reaches the provider and comes back
    // as a 403 from Anthropic — which is precisely the 2026-08-26 outage shape,
    // green build and deploy included.
    expect(source).toMatch(/if\s*\(\s*!apiKey\s*\)/);
  });
});
