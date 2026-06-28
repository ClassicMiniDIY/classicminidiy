/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDateTime, formatDate, formatRelativeTime } from '~~/app/utils/formatters';

// A fixed, unambiguous instant used as "now" for the relative-time tests.
// 2026-06-15T12:00:00.000Z. We assert against UTC-derived offsets so the
// arithmetic (diff in ms) is timezone-independent; the absolute-date branch
// uses toLocaleDateString(undefined, ...) which depends on the runner's TZ,
// so those assertions are written to be locale/TZ-tolerant.
const NOW = new Date('2026-06-15T12:00:00.000Z');

describe('formatDateTime', () => {
  it('formats a full date with time (month, day, year, hour, minute)', () => {
    const out = formatDateTime('2026-02-10T15:45:00.000Z');
    // Intl output is TZ-dependent for the clock portion, so assert on the
    // stable, locale-structural pieces rather than an exact string.
    expect(out).toMatch(/Feb \d{1,2}, 2026/);
    expect(out).toMatch(/\d{1,2}:\d{2}\s?[AP]M/);
  });

  it('includes both a comma-separated date and a meridiem time', () => {
    const out = formatDateTime('2026-12-25T09:05:00.000Z');
    expect(out).toContain('2026');
    expect(out).toMatch(/[AP]M/);
  });

  // NOTE: unlike formatRelativeTime (which uses toLocaleDateString and yields
  // "Invalid Date"), formatDateTime/formatDate build with Intl.DateTimeFormat
  // and call .format() on an invalid Date, which THROWS "Invalid time value".
  it('throws RangeError for an unparseable string', () => {
    expect(() => formatDateTime('not-a-date')).toThrow(RangeError);
  });

  it('throws RangeError for an empty string', () => {
    expect(() => formatDateTime('')).toThrow(RangeError);
  });

  it('parses a bare date-only string', () => {
    const out = formatDateTime('2026-02-10');
    expect(out).toMatch(/Feb \d{1,2}, 2026/);
  });
});

describe('formatDate', () => {
  it('formats date only with no time component', () => {
    const out = formatDate('2026-02-10T15:45:00.000Z');
    expect(out).toMatch(/Feb \d{1,2}, 2026/);
    expect(out).not.toMatch(/[AP]M/);
    expect(out).not.toMatch(/:\d{2}/);
  });

  it('handles year boundaries', () => {
    // Use midday UTC so the rendered local date does not roll into an
    // adjacent year on the runner's timezone (e.g. midnight-UTC Jan 1 would
    // render as Dec 31 of the prior year in America/New_York).
    expect(formatDate('2026-06-15T12:00:00.000Z')).toContain('2026');
    expect(formatDate('1999-06-15T12:00:00.000Z')).toContain('1999');
  });

  it('throws RangeError for an unparseable string', () => {
    expect(() => formatDate('garbage')).toThrow(RangeError);
  });

  it('throws RangeError for an empty string', () => {
    expect(() => formatDate('')).toThrow(RangeError);
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: build an ISO timestamp `ms` milliseconds before NOW.
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  const SEC = 1_000;
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  describe('"just now" (< 1 minute)', () => {
    it.each([
      ['exactly now (0ms)', 0],
      ['1 second ago', 1 * SEC],
      ['30 seconds ago', 30 * SEC],
      ['59 seconds ago', 59 * SEC],
      ['59.999s (just under 1 min)', MIN - 1],
    ])('returns "just now" for %s', (_label, offset) => {
      expect(formatRelativeTime(ago(offset))).toBe('just now');
    });
  });

  describe('minutes ("Nm ago", 1..59 min)', () => {
    it.each([
      [1 * MIN, '1m ago'],
      [2 * MIN, '2m ago'],
      [30 * MIN, '30m ago'],
      [59 * MIN, '59m ago'],
      [MIN + 30 * SEC, '1m ago'], // floors partial minutes down
      [60 * MIN - 1, '59m ago'], // boundary just under an hour
    ])('formats %ims ago as %s', (offset, expected) => {
      expect(formatRelativeTime(ago(offset))).toBe(expected);
    });
  });

  describe('hours ("Nh ago", 1..23 h)', () => {
    it.each([
      [1 * HOUR, '1h ago'],
      [2 * HOUR, '2h ago'],
      [23 * HOUR, '23h ago'],
      [HOUR + 59 * MIN, '1h ago'], // floors partial hours down
      [24 * HOUR - 1, '23h ago'], // boundary just under a day
    ])('formats %ims ago as %s', (offset, expected) => {
      expect(formatRelativeTime(ago(offset))).toBe(expected);
    });
  });

  describe('days ("Nd ago", 1..6 d)', () => {
    it.each([
      [1 * DAY, '1d ago'],
      [2 * DAY, '2d ago'],
      [6 * DAY, '6d ago'],
      [DAY + 23 * HOUR, '1d ago'], // floors partial days down
      [7 * DAY - 1, '6d ago'], // boundary just under a week
    ])('formats %ims ago as %s', (offset, expected) => {
      expect(formatRelativeTime(ago(offset))).toBe(expected);
    });
  });

  describe('older than 7 days falls back to an absolute date', () => {
    it('returns an absolute "Mon D" date for >= 7 days', () => {
      const out = formatRelativeTime(ago(7 * DAY));
      expect(out).not.toMatch(/ago$/);
      expect(out).not.toBe('just now');
      // Should look like a localized "Mon D" date (e.g. "Jun 8").
      expect(out).toMatch(/[A-Za-z]{3}\s?\d{1,2}|\d{1,2}\/\d{1,2}/);
    });

    it('returns a date far in the past (30 days)', () => {
      const out = formatRelativeTime(ago(30 * DAY));
      expect(out).not.toMatch(/ago$/);
      expect(out).not.toBe('just now');
    });

    it('includes a time component when includeTime: true', () => {
      const withTime = formatRelativeTime(ago(10 * DAY), { includeTime: true });
      const withoutTime = formatRelativeTime(ago(10 * DAY));
      // The time-bearing variant should carry a clock (HH:MM) the plain one lacks.
      expect(withTime).toMatch(/\d{1,2}:\d{2}/);
      expect(withoutTime).not.toMatch(/\d{1,2}:\d{2}/);
      // And it should be a strictly longer/different string than the date-only form.
      expect(withTime).not.toBe(withoutTime);
    });

    it('omits the time component by default (no options)', () => {
      const out = formatRelativeTime(ago(10 * DAY));
      expect(out).not.toMatch(/\d{1,2}:\d{2}/);
    });

    it('treats includeTime: false the same as omitting it', () => {
      expect(formatRelativeTime(ago(10 * DAY), { includeTime: false })).toBe(formatRelativeTime(ago(10 * DAY)));
    });
  });

  describe('exact threshold boundaries', () => {
    it('1 minute exactly crosses from "just now" to "1m ago"', () => {
      expect(formatRelativeTime(ago(MIN - 1))).toBe('just now');
      expect(formatRelativeTime(ago(MIN))).toBe('1m ago');
    });

    it('60 minutes exactly crosses from minutes to "1h ago"', () => {
      expect(formatRelativeTime(ago(60 * MIN - 1))).toBe('59m ago');
      expect(formatRelativeTime(ago(60 * MIN))).toBe('1h ago');
    });

    it('24 hours exactly crosses from hours to "1d ago"', () => {
      expect(formatRelativeTime(ago(24 * HOUR - 1))).toBe('23h ago');
      expect(formatRelativeTime(ago(24 * HOUR))).toBe('1d ago');
    });

    it('7 days exactly crosses from days to the absolute date', () => {
      expect(formatRelativeTime(ago(7 * DAY - 1))).toBe('6d ago');
      expect(formatRelativeTime(ago(7 * DAY))).not.toMatch(/d ago$/);
    });
  });

  describe('future timestamps (negative diff)', () => {
    // For a future date diffMs is negative, so diffMins < 1 → "just now".
    it.each([
      ['1 minute in the future', -1 * MIN],
      ['1 hour in the future', -1 * HOUR],
      ['1 day in the future', -1 * DAY],
      ['1 year in the future', -365 * DAY],
    ])('returns "just now" for %s', (_label, offset) => {
      expect(formatRelativeTime(ago(offset))).toBe('just now');
    });

    it('returns "just now" for the exact current instant', () => {
      expect(formatRelativeTime(NOW.toISOString())).toBe('just now');
    });
  });

  describe('malformed / edge inputs', () => {
    it('returns "Invalid Date" for an unparseable timestamp', () => {
      // new Date('nope').getTime() is NaN → all diff comparisons are false →
      // falls through to date.toLocaleDateString(...) which yields "Invalid Date".
      expect(formatRelativeTime('nope')).toBe('Invalid Date');
    });

    it('returns "Invalid Date" for an empty string', () => {
      expect(formatRelativeTime('')).toBe('Invalid Date');
    });

    it('handles a numeric-epoch-like string by parsing as a date', () => {
      // Not a valid ISO string; Date parsing of a bare number string is NaN.
      expect(formatRelativeTime('1718452800')).toBe('Invalid Date');
    });
  });
});
