/**
 * Unit tests for the chat-message markdown renderer.
 *
 * @vitest-environment happy-dom
 *
 * Why happy-dom (not node): the vitest config rewrites `import.meta.client` to
 * `(true)`, so `renderMessageMarkdown` always takes the client branch. That
 * branch lazily imports DOMPurify, which needs a DOM (`window`/`document`).
 * happy-dom provides it; the node env would crash DOMPurify.
 *
 * Two render paths exist and the active one depends on whether DOMPurify has
 * finished its async load yet (module-level `purifyInstance`):
 *   1. Server-fallback path (purify not yet loaded): serverSanitize + serverHardenLinks.
 *   2. DOMPurify path (after async load): full client sanitization.
 * Both paths share the same security/formatting contract. Most assertions below
 * hold for BOTH paths; where they diverge (e.g. a stripped `javascript:` href
 * becomes `href=""` on the server path but is dropped entirely by DOMPurify) the
 * tests assert the security invariant ("no javascript: survives") rather than an
 * exact string, so the suite is deterministic regardless of test ordering.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { renderMessageMarkdown, stripMessageMarkdown } from '~~/app/utils/markdown';

describe('renderMessageMarkdown — empty / falsy input', () => {
  it.each([
    ['empty string', ''],
    // The guard is `if (!content)`, so these all short-circuit to ''.
    ['undefined', undefined as unknown as string],
    ['null', null as unknown as string],
  ])('returns "" for %s', (_label, input) => {
    expect(renderMessageMarkdown(input)).toBe('');
  });
});

describe('renderMessageMarkdown — basic inline formatting (identical on both paths)', () => {
  it.each([
    ['bold', '**bold**', '<p><strong>bold</strong></p>\n'],
    ['italic', '*italic*', '<p><em>italic</em></p>\n'],
    ['strikethrough', '~~strike~~', '<p><del>strike</del></p>\n'],
    ['inline code', '`code`', '<p><code>code</code></p>\n'],
    ['plain text', 'plain text', '<p>plain text</p>\n'],
  ])('renders %s', (_label, input, expected) => {
    expect(renderMessageMarkdown(input)).toBe(expected);
  });
});

describe('renderMessageMarkdown — line breaks (breaks: true)', () => {
  it('converts a single newline into <br> (GFM breaks enabled)', () => {
    expect(renderMessageMarkdown('line1\nline2')).toBe('<p>line1<br>line2</p>\n');
  });
});

describe('renderMessageMarkdown — code blocks', () => {
  it('renders a fenced code block as <pre><code>', () => {
    expect(renderMessageMarkdown('```\ncode block\n```')).toBe('<pre><code>code block\n</code></pre>\n');
  });

  it('does not interpret markdown inside inline code', () => {
    // The `**` stays literal inside backticks.
    const out = renderMessageMarkdown('`**not bold**`');
    expect(out).toContain('<code>');
    expect(out).toContain('**not bold**');
    expect(out).not.toContain('<strong>');
  });
});

describe('renderMessageMarkdown — lists', () => {
  it('renders a bulleted list', () => {
    expect(renderMessageMarkdown('- a\n- b')).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n');
  });

  it('renders a numbered list', () => {
    expect(renderMessageMarkdown('1. one\n2. two')).toBe('<ol>\n<li>one</li>\n<li>two</li>\n</ol>\n');
  });
});

describe('renderMessageMarkdown — disallowed block constructs are downgraded', () => {
  it('collapses a heading to a plain paragraph (no <h1>)', () => {
    const out = renderMessageMarkdown('# heading');
    expect(out).toBe('<p>heading</p>');
    expect(out).not.toMatch(/<h[1-6]/i);
  });

  it('renders a blockquote as a paragraph (no <blockquote>)', () => {
    const out = renderMessageMarkdown('> quote');
    expect(out).not.toContain('<blockquote');
    expect(out).toContain('quote');
  });

  it('drops markdown images entirely (no <img>, no alt text leakage as a tag)', () => {
    const out = renderMessageMarkdown('![alt](http://example.com/a.png)');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('example.com/a.png');
    // marked emits an empty image -> wrapped in an empty paragraph.
    expect(out).toBe('<p></p>\n');
  });

  // serverSanitize() strips any tag NOT in ALLOWED_TAGS. marked's controlled
  // renderer already blocks raw HTML/headings/images, but GFM still emits a few
  // structural tags (table, hr, task-list <input>) that are outside the
  // allowlist — these exercise the `return ''` removal branch of serverSanitize.
  // NOTE: these MUST run before DOMPurify finishes its lazy load, otherwise the
  // render takes the client path and serverSanitize is never called. The file
  // runs sequentially (fileParallelism: false, no shuffle) and the DOMPurify
  // path is forced only in the final describe block, so this ordering holds.
  it('strips non-allowlisted GFM table tags via serverSanitize (server path)', () => {
    const out = renderMessageMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    // The cell *text* survives, but no table structural tag does.
    expect(out).toContain('a');
    expect(out).toContain('1');
    expect(out).not.toContain('<table');
    expect(out).not.toContain('<thead');
    expect(out).not.toContain('<tbody');
    expect(out).not.toContain('<tr');
    expect(out).not.toMatch(/<t[hd]\b/);
  });

  it('strips a thematic break (<hr>) tag via serverSanitize (server path)', () => {
    const out = renderMessageMarkdown('---');
    expect(out).not.toContain('<hr');
  });

  it('strips a GFM task-list <input> tag via serverSanitize (server path)', () => {
    const out = renderMessageMarkdown('- [ ] todo\n- [x] done');
    // The list itself is allowlisted (<ul>/<li>); the injected <input> is not.
    expect(out).not.toContain('<input');
    expect(out).toContain('todo');
    expect(out).toContain('done');
  });
});

describe('renderMessageMarkdown — links are hardened', () => {
  it('renders a safe link with forced new-tab + noopener/noreferrer/nofollow/ugc', () => {
    const out = renderMessageMarkdown('[link](https://example.com)');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(out).toContain('>link</a>');
  });

  it.each([
    ['javascript:', '[x](javascript:alert(1))'],
    ['data:', '[x](data:text/html,<script>alert(1)</script>)'],
    ['vbscript:', '[x](vbscript:msgbox(1))'],
  ])('strips the dangerous %s protocol from a link href', (_label, input) => {
    const out = renderMessageMarkdown(input).toLowerCase();
    // The visible anchor still exists, but no dangerous scheme survives in any attr.
    expect(out).toContain('<a');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('vbscript:');
    // `data:` URIs must not be reachable as an href value.
    expect(out).not.toMatch(/href="data:/);
  });
});

describe('renderMessageMarkdown — XSS / raw HTML is neutralized', () => {
  it('strips a raw <script> tag and its execution vector', () => {
    const out = renderMessageMarkdown('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips a raw <img onerror> XSS payload', () => {
    const out = renderMessageMarkdown('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
  });

  it.each([
    ['iframe', '<iframe src="https://evil.com"></iframe>'],
    ['style', '<style>body{display:none}</style>'],
    ['svg/onload', '<svg onload=alert(1)>'],
    ['event handler div', '<div onclick="alert(1)">hi</div>'],
  ])('neutralizes raw %s markup', (_label, input) => {
    const out = renderMessageMarkdown(input).toLowerCase();
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('<style');
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onerror');
  });

  it('does not emit any tag outside the allowlist', () => {
    const allowed = new Set(['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'a']);
    const out = renderMessageMarkdown(
      '# h\n> q\n**b** *i* ~~s~~ `c`\n[l](https://x.com)\n- one\n1. two\n<script>x</script><img src=x>'
    );
    const tags = [...out.matchAll(/<\/?([a-z0-9]+)\b/gi)].map((m) => m[1].toLowerCase());
    for (const tag of tags) {
      expect(allowed.has(tag)).toBe(true);
    }
  });
});

describe('renderMessageMarkdown — edge cases', () => {
  it('handles a very long input without throwing and preserves bold formatting', () => {
    const long = '**x** '.repeat(5000);
    const out = renderMessageMarkdown(long);
    expect(out).toContain('<strong>x</strong>');
    expect(out.length).toBeGreaterThan(0);
  });

  it('handles unicode / emoji content', () => {
    const out = renderMessageMarkdown('héllo 🌍 **ünïcödé** 日本語');
    expect(out).toContain('héllo');
    expect(out).toContain('🌍');
    expect(out).toContain('<strong>ünïcödé</strong>');
    expect(out).toContain('日本語');
  });

  it('escapes a bare HTML-special character in plain text (no tag injection)', () => {
    const out = renderMessageMarkdown('a < b && c > d');
    // The lone `<`/`>` must be entity-escaped, never form a tag.
    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
    expect(out).not.toMatch(/<(?!\/?(p|br|strong|em|del|code|pre|ul|ol|li|a)\b)/i);
  });

  it('returns a string for whitespace-only input', () => {
    expect(typeof renderMessageMarkdown('   \n   ')).toBe('string');
  });
});

describe('stripMessageMarkdown — empty / falsy input', () => {
  it.each([
    ['empty string', ''],
    ['undefined', undefined as unknown as string],
    ['null', null as unknown as string],
  ])('returns "" for %s', (_label, input) => {
    expect(stripMessageMarkdown(input)).toBe('');
  });
});

describe('stripMessageMarkdown — formatting removal (table-driven)', () => {
  it.each([
    ['bold', '**bold**', 'bold'],
    ['italic asterisk', '*italic*', 'italic'],
    ['bold underscore', '__bold__', 'bold'],
    ['italic underscore', '_italic_', 'italic'],
    ['strikethrough', '~~strike~~', 'strike'],
    ['inline code', '`code`', 'code'],
    ['link', '[link](https://example.com)', 'link'],
    ['bulleted list', '- a\n- b', 'a b'],
    ['plus bullet', '+ a\n+ b', 'a b'],
    ['star bullet', '* a\n* b', 'a b'],
    ['numbered list', '1. one\n2. two', 'one two'],
    ['plain text', 'plain text', 'plain text'],
    ['collapses multiple newlines/spaces', 'line1\n\n  line2', 'line1 line2'],
  ])('strips %s', (_label, input, expected) => {
    expect(stripMessageMarkdown(input)).toBe(expected);
  });

  it('removes a fenced code block entirely', () => {
    expect(stripMessageMarkdown('before\n```\ncode\n```\nafter')).toBe('before after');
  });

  it('trims surrounding whitespace', () => {
    expect(stripMessageMarkdown('   **hi**   ')).toBe('hi');
  });
});

describe('stripMessageMarkdown — documented limitations (not a full md->text converter)', () => {
  it('leaves heading markers in place (# is not stripped)', () => {
    // Only the formatting we *render* is stripped; headings are downgraded at
    // render time, not here.
    expect(stripMessageMarkdown('# heading')).toBe('# heading');
  });

  it('leaves blockquote markers in place', () => {
    expect(stripMessageMarkdown('> quote')).toBe('> quote');
  });

  it('does NOT strip HTML tags — they are passed through as plain text', () => {
    // stripMessageMarkdown is for plaintext previews of *our* markdown subset,
    // not an HTML sanitizer. Raw tags are left verbatim.
    expect(stripMessageMarkdown('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });

  it('link regex stops at the first ) — a trailing paren in the href leaks', () => {
    // `\[([^\]]+)\]\([^)]+\)` consumes up to the first ')'; with a paren inside
    // the URL the remaining ')' is left behind. Documenting actual behavior.
    expect(stripMessageMarkdown('[xss](javascript:alert(1))')).toBe('xss)');
  });
});

/**
 * The DOMPurify (client) render path. Until the module-level `purifyInstance`
 * finishes its lazy `import('dompurify')`, every render falls back to
 * serverSanitize/serverHardenLinks (all tests above run on that fallback path).
 * Once it loads, renderMessageMarkdown takes the `if (purifyInstance)` branch,
 * which installs the `afterSanitizeAttributes` link-hardening hook and runs the
 * real DOMPurify sanitizer.
 *
 * This block MUST come last: once DOMPurify is loaded it stays loaded for the
 * remainder of the file (module-global), so any server-path assertion after this
 * point would silently switch paths.
 */
describe('renderMessageMarkdown — DOMPurify client path (after lazy load)', () => {
  // Drive the lazy load, then wait until renders actually go through DOMPurify.
  // The first render fires the fire-and-forget getPurify(); importing dompurify
  // ourselves resolves the same cached module, after which the module-global
  // purifyInstance is populated. We poll on a behavioral signal: on the server
  // fallback a stripped javascript: link yields href="", whereas DOMPurify drops
  // the href attribute entirely.
  beforeAll(async () => {
    renderMessageMarkdown('warm up the lazy DOMPurify import');
    await import('dompurify');
    await vi.waitFor(
      () => {
        const out = renderMessageMarkdown('[x](javascript:alert(1))');
        if (out.includes('href=""')) {
          throw new Error('DOMPurify not loaded yet (still on server fallback path)');
        }
      },
      { timeout: 5000, interval: 25 }
    );
  });

  it('sanitizes a safe link and applies the afterSanitizeAttributes hook to <a>', () => {
    // Hits the `if (purifyInstance)` branch + purifyInstance.sanitize call, plus
    // the hook body that forces target/rel on the anchor node.
    const out = renderMessageMarkdown('[link](https://example.com)');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(out).toContain('>link</a>');
  });

  it('forces target/rel even when no anchor-internal attrs are present', () => {
    // Confirms the hook (node.nodeName === "A") rewrites attributes on a plain
    // anchor rather than relying on marked/serverHardenLinks.
    const out = renderMessageMarkdown('see [docs](https://docs.example.org/path)');
    const anchor = out.match(/<a\b[^>]*>/i)?.[0] ?? '';
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener noreferrer nofollow ugc"');
  });

  it('drops a dangerous javascript: href entirely on the DOMPurify path', () => {
    // DOMPurify removes the unsafe href attribute (no href="" placeholder),
    // distinguishing this from the server-fallback hardening.
    const out = renderMessageMarkdown('[x](javascript:alert(1))').toLowerCase();
    expect(out).toContain('<a');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('href=""');
  });

  it('still neutralizes raw <script> on the DOMPurify path', () => {
    const out = renderMessageMarkdown('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('still renders basic inline formatting on the DOMPurify path', () => {
    const out = renderMessageMarkdown('**bold** and `code`');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<code>code</code>');
  });
});
