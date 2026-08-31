/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { stripMarkup, toPlainSummary } from '~/utils/plainText';

describe('toPlainSummary', () => {
  // The bug that made this worth fixing rather than dismissing: `.*?` without
  // the `s` flag does not cross newlines, so a migrated multi-line comment
  // survived whole and displayed as literal text to readers.
  it('strips a multi-line HTML comment', () => {
    expect(toPlainSummary('Nice car <!-- migrated\nfrom dynamo --> for sale')).toBe('Nice car for sale');
  });

  // Nested comments leave a dangling `-->`, and that is deliberately NOT
  // chased. Stripping a bare `-->` would mangle ordinary prose on this site —
  // "1275cc --> 1380cc" is how enthusiasts write an upgrade. A rare fragment
  // from migrated content is the lesser cost.
  it('removes the comment but leaves a dangling close when comments nest', () => {
    expect(toPlainSummary('a <!--<!-- x -->--> b')).toBe('a --> b');
  });

  it('leaves an arrow in ordinary prose alone', () => {
    expect(toPlainSummary('Engine 1275cc --> 1380cc')).toBe('Engine 1275cc --> 1380cc');
  });

  it('strips single-line comments, headings and collapses whitespace', () => {
    expect(toPlainSummary('# Title\n\nSome   text <!-- note -->')).toBe('Title Some text');
  });

  it('strips tags', () => {
    expect(toPlainSummary('<p>Hello <b>there</b></p>')).toBe('Hello there');
  });

  it('handles null, undefined and empty input', () => {
    expect(toPlainSummary(null)).toBe('');
    expect(toPlainSummary(undefined)).toBe('');
    expect(toPlainSummary('')).toBe('');
  });

  it('leaves ordinary prose alone', () => {
    expect(toPlainSummary('1969 Cooper S, 1275cc, restored 2018')).toBe('1969 Cooper S, 1275cc, restored 2018');
  });
});

describe('stripMarkup', () => {
  it('removes markup but preserves internal whitespace', () => {
    expect(stripMarkup('line one\n\nline two <b>x</b>')).toBe('line one\n\nline two x');
  });

  it('leaves no fragment when tags nest', () => {
    expect(stripMarkup('<scr<b>ipt>text')).not.toContain('<');
  });

  it('handles null and undefined', () => {
    expect(stripMarkup(null)).toBe('');
    expect(stripMarkup(undefined)).toBe('');
  });
});
