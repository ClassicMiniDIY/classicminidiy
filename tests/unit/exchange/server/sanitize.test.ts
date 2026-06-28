/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { sanitizeUserInput, sanitizeCommentContent, sanitizeUrl, isValidEmail } from '~~/server/utils/exchange/sanitize';

describe('sanitizeUserInput', () => {
  describe('falsy / non-string input', () => {
    it.each([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['number', 123],
      ['object', {}],
      ['array', []],
      ['boolean false', false],
      ['NaN', NaN],
    ])('returns "" for %s', (_label, input) => {
      expect(sanitizeUserInput(input as unknown as string)).toBe('');
    });
  });

  describe('HTML tag stripping', () => {
    it.each([
      ['simple bold', '<b>hello</b>', 'hello'],
      ['script tag wrapper', '<script>alert(1)</script>safe', 'alert(1)safe'],
      ['self-closing', 'before<br/>after', 'beforeafter'],
      ['attributes', '<a href="x">link</a>', 'link'],
      ['nested', '<div><span>x</span></div>', 'x'],
      ['img tag', '<img src=x>', ''],
      ['only a tag', '<p></p>', ''],
    ])('strips tags in %s', (_label, input, expected) => {
      expect(sanitizeUserInput(input)).toBe(expected);
    });
  });

  describe('javascript: scheme removal', () => {
    it.each([
      ['lowercase', 'javascript:alert(1)', 'alert(1)'],
      ['uppercase', 'JAVASCRIPT:alert(1)', 'alert(1)'],
      ['mixed case', 'JavaScript:doThing()', 'doThing()'],
      ['multiple occurrences', 'javascript:a javascript:b', 'a b'],
    ])('removes javascript: in %s', (_label, input, expected) => {
      expect(sanitizeUserInput(input)).toBe(expected);
    });
  });

  describe('event handler removal', () => {
    it.each([
      ['onclick=', 'onclick=alert(1)', 'alert(1)'],
      ['ONCLICK= uppercase', 'ONCLICK=alert(1)', 'alert(1)'],
      ['onmouseover with space', 'onmouseover =x', 'x'],
      ['onerror=', 'onerror=boom', 'boom'],
    ])('strips event handler in %s', (_label, input, expected) => {
      expect(sanitizeUserInput(input)).toBe(expected);
    });
  });

  describe('whitespace normalization + trim', () => {
    it.each([
      ['leading/trailing spaces', '   hello   ', 'hello'],
      ['collapse internal runs', 'a    b\t\tc', 'a b c'],
      ['newlines collapsed to single space', 'line1\nline2\n\nline3', 'line1 line2 line3'],
      ['tabs and newlines mixed', '\t a \n b \t', 'a b'],
      ['only whitespace', '   \n\t  ', ''],
    ])('normalizes whitespace in %s', (_label, input, expected) => {
      expect(sanitizeUserInput(input)).toBe(expected);
    });
  });

  describe('preserves normal text and URLs', () => {
    it.each([
      ['plain text', 'Classic Mini Cooper 1275', 'Classic Mini Cooper 1275'],
      ['https url', 'https://classicminidiy.com/page', 'https://classicminidiy.com/page'],
      ['http url', 'http://example.com/a?b=c', 'http://example.com/a?b=c'],
      ['unicode', 'café résumé 日本語 🚗', 'café résumé 日本語 🚗'],
      ['punctuation', "It's a 998cc A-series — nice!", "It's a 998cc A-series — nice!"],
    ])('keeps %s intact', (_label, input, expected) => {
      expect(sanitizeUserInput(input)).toBe(expected);
    });
  });

  it('handles a combined XSS payload', () => {
    const input = '  <img src=x onerror=alert(1)> javascript:evil <b>text</b>  ';
    // tag stripped first -> "  javascript:evil text  " (onerror lives inside the tag, removed with it)
    // then javascript: removed -> "  evil text  "
    // then whitespace normalized + trimmed
    expect(sanitizeUserInput(input)).toBe('evil text');
  });

  it('collapses a very long whitespace-padded string and caps nothing (no length limit)', () => {
    const long = 'word '.repeat(5000).trim(); // 5000 words
    const result = sanitizeUserInput(`   ${long}   `);
    expect(result).toBe(long);
    expect(result.split(' ')).toHaveLength(5000);
  });
});

describe('sanitizeCommentContent', () => {
  describe('falsy / non-string input', () => {
    it.each([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['number', 0],
      ['object', {}],
    ])('returns "" for %s', (_label, input) => {
      expect(sanitizeCommentContent(input as unknown as string)).toBe('');
    });
  });

  describe('HTML tag stripping', () => {
    it.each([
      ['bold', '<b>hi</b>', 'hi'],
      ['script', '<script>x</script>keep', 'xkeep'],
      ['attributes', '<a href="x" onclick="y">link</a>', 'link'],
    ])('strips tags in %s', (_label, input, expected) => {
      expect(sanitizeCommentContent(input)).toBe(expected);
    });
  });

  describe('javascript: and event handler removal', () => {
    it.each([
      ['javascript lowercase', 'javascript:alert(1)', 'alert(1)'],
      ['javascript mixed', 'JavaScript:x', 'x'],
      ['onclick=', 'onclick=boom', 'boom'],
      ['ONERROR= uppercase', 'ONERROR =boom', 'boom'],
    ])('removes injection in %s', (_label, input, expected) => {
      expect(sanitizeCommentContent(input)).toBe(expected);
    });
  });

  describe('preserves newlines / paragraph breaks (unlike sanitizeUserInput)', () => {
    it('keeps internal newlines intact', () => {
      const input = 'First line\nSecond line\n\nThird paragraph';
      expect(sanitizeCommentContent(input)).toBe('First line\nSecond line\n\nThird paragraph');
    });

    it('keeps internal multi-space runs intact (no whitespace collapsing)', () => {
      const input = 'spaced    out    text';
      expect(sanitizeCommentContent(input)).toBe('spaced    out    text');
    });

    it('trims leading/trailing whitespace but keeps interior breaks', () => {
      const input = '\n\n  hello\n\nworld  \n\n';
      expect(sanitizeCommentContent(input)).toBe('hello\n\nworld');
    });

    it('returns "" for whitespace-only content', () => {
      expect(sanitizeCommentContent('   \n\n\t  ')).toBe('');
    });
  });

  describe('preserves normal text and URLs', () => {
    it.each([
      ['plain', 'Great write-up on SU needles', 'Great write-up on SU needles'],
      ['url', 'See https://classicminidiy.com/technical/needles', 'See https://classicminidiy.com/technical/needles'],
      ['unicode + emoji', 'Nice 🚗 résumé 日本語', 'Nice 🚗 résumé 日本語'],
    ])('keeps %s intact', (_label, input, expected) => {
      expect(sanitizeCommentContent(input)).toBe(expected);
    });
  });

  describe('length cap (maxLength = 2000)', () => {
    it('does not truncate content at exactly 2000 chars', () => {
      const input = 'a'.repeat(2000);
      expect(sanitizeCommentContent(input)).toHaveLength(2000);
      expect(sanitizeCommentContent(input)).toBe(input);
    });

    it('truncates content over 2000 chars to 2000', () => {
      const input = 'a'.repeat(2500);
      const result = sanitizeCommentContent(input);
      expect(result).toHaveLength(2000);
      expect(result).toBe('a'.repeat(2000));
    });

    it('slices BEFORE stripping tags — a tag straddling the 2000 boundary loses its tail', () => {
      // 1995 'a's, then "<bbbbb..." — the slice cuts the tag open at 2000,
      // leaving an unterminated "<bbbb" which the tag regex cannot match (no '>').
      const input = 'a'.repeat(1995) + '<' + 'b'.repeat(100);
      const result = sanitizeCommentContent(input);
      // slice(0,2000) => 1995 'a' + '<' + 4 'b' = "...aaa<bbbb"
      expect(result).toBe('a'.repeat(1995) + '<bbbb');
      expect(result).toHaveLength(2000);
    });

    it('trim can shorten result below 2000 when slice lands on whitespace', () => {
      const input = 'a'.repeat(1999) + ' ' + 'b'.repeat(50);
      // slice(0,2000) => 1999 'a' + ' ', then trim removes trailing space => 1999
      expect(sanitizeCommentContent(input)).toBe('a'.repeat(1999));
    });
  });
});

describe('sanitizeUrl', () => {
  describe('falsy / non-string input', () => {
    it.each([
      ['empty', ''],
      ['null', null],
      ['undefined', undefined],
      ['number', 5],
    ])('returns null for %s', (_label, input) => {
      expect(sanitizeUrl(input as unknown as string)).toBeNull();
    });
  });

  describe('valid public http(s) URLs', () => {
    it.each([
      'https://classicminidiy.com/',
      'http://example.com/path?query=1#frag',
      'https://sub.domain.co.uk/a/b/c',
      'https://8.8.8.8/',
    ])('accepts %s', (url) => {
      // URL.toString() normalizes (e.g. adds trailing slash to bare origins)
      expect(sanitizeUrl(url)).toBe(new URL(url).toString());
    });
  });

  describe('rejected protocols', () => {
    it.each([
      'javascript:alert(1)',
      'ftp://example.com/file',
      'file:///etc/passwd',
      'data:text/html,<script>alert(1)</script>',
      'mailto:test@example.com',
    ])('returns null for %s', (url) => {
      expect(sanitizeUrl(url)).toBeNull();
    });
  });

  describe('SSRF: private/internal hosts blocked', () => {
    it.each([
      'http://localhost/',
      'http://localhost:3000/admin',
      'http://0.0.0.0/',
      'http://127.0.0.1/',
      'http://127.5.5.5/',
      'http://10.0.0.1/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
    ])('returns null for %s', (url) => {
      expect(sanitizeUrl(url)).toBeNull();
    });

    // BUG (documented, not asserted-as-fixed): URL.hostname returns IPv6 literals
    // WITH brackets ("[::1]"), but isPrivateHost's BLOCKED_IPV6 list checks the
    // bracketless forms ("::1", "::"). So loopback/unspecified IPv6 hosts are NOT
    // blocked. These tests pin the current (buggy) behavior so a future fix to
    // sanitize.ts will flip them red and force this test to be updated.
    it.each([
      ['http://[::1]/', 'http://[::1]/'], // loopback — SHOULD be null once fixed
      ['http://[::]/', 'http://[::]/'], // unspecified — SHOULD be null once fixed
    ])('does NOT block bracketed IPv6 %s (known SSRF gap)', (url, expected) => {
      expect(sanitizeUrl(url)).toBe(expected);
    });

    it.each([
      'http://172.15.0.1/', // just below 172.16/12
      'http://172.32.0.1/', // just above 172.16/12
    ])('allows boundary-adjacent public IP %s', (url) => {
      expect(sanitizeUrl(url)).toBe(new URL(url).toString());
    });
  });

  describe('malformed URLs', () => {
    it.each(['not a url', 'http://', '://missing-scheme', 'h ttp://x.com'])('returns null for %s', (url) => {
      expect(sanitizeUrl(url)).toBeNull();
    });
  });
});

describe('isValidEmail', () => {
  describe('falsy / non-string input', () => {
    it.each([
      ['empty', ''],
      ['null', null],
      ['undefined', undefined],
      ['number', 1],
      ['object', {}],
    ])('returns false for %s', (_label, input) => {
      expect(isValidEmail(input as unknown as string)).toBe(false);
    });
  });

  describe('valid emails', () => {
    it.each(['test@example.com', 'a.b+tag@sub.domain.co.uk', 'classicminidiy@gmail.com', 'x@y.z'])(
      'accepts %s',
      (email) => {
        expect(isValidEmail(email)).toBe(true);
      }
    );
  });

  describe('invalid emails', () => {
    it.each([
      'plainaddress',
      '@no-local.com',
      'no-at-sign.com',
      'no-domain@',
      'no-tld@domain',
      'spaces in@email.com',
      'two@@at.com',
      'trailing@dot.',
    ])('rejects %s', (email) => {
      expect(isValidEmail(email)).toBe(false);
    });
  });

  describe('length cap (<= 254)', () => {
    it('accepts an address exactly 254 chars long', () => {
      const local = 'a'.repeat(254 - '@example.com'.length);
      const email = `${local}@example.com`;
      expect(email).toHaveLength(254);
      expect(isValidEmail(email)).toBe(true);
    });

    it('rejects an address longer than 254 chars', () => {
      const local = 'a'.repeat(255 - '@example.com'.length);
      const email = `${local}@example.com`;
      expect(email).toHaveLength(255);
      expect(isValidEmail(email)).toBe(false);
    });
  });
});
