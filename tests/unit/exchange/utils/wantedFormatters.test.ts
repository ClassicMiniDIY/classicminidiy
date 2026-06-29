/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categoryBadgeClass,
  formatBudget,
  formatCategory,
  formatLocation,
  formatWantedStatus,
  getCurrencySymbol,
  timeAgo,
  wantedStatusBadgeClass,
} from '~~/app/utils/wantedFormatters';

describe('getCurrencySymbol', () => {
  it.each([
    ['USD', '$'],
    ['GBP', '£'],
    ['EUR', '€'],
    ['AUD', 'A$'],
    ['CAD', 'C$'],
    ['NZD', 'NZ$'],
    ['JPY', '¥'],
  ])('maps known currency %s -> %s', (currency, symbol) => {
    expect(getCurrencySymbol(currency)).toBe(symbol);
  });

  it('falls back to "<code> " for an unknown currency', () => {
    expect(getCurrencySymbol('SEK')).toBe('SEK ');
  });

  it('falls back for an empty string (no match)', () => {
    expect(getCurrencySymbol('')).toBe(' ');
  });

  it('is case-sensitive — lowercase is treated as unknown', () => {
    expect(getCurrencySymbol('usd')).toBe('usd ');
  });
});

describe('formatBudget', () => {
  it('returns a range when both min and max are present', () => {
    expect(formatBudget(1000, 5000, 'USD')).toBe('$1,000 - $5,000');
  });

  it('returns "Up to ..." when only max is present', () => {
    expect(formatBudget(null, 5000, 'USD')).toBe('Up to $5,000');
  });

  it('returns "From ..." when only min is present', () => {
    expect(formatBudget(1000, null, 'USD')).toBe('From $1,000');
  });

  it('returns null when neither min nor max is present (both null)', () => {
    expect(formatBudget(null, null, 'USD')).toBeNull();
  });

  it('returns null when both are undefined', () => {
    expect(formatBudget(undefined, undefined, 'USD')).toBeNull();
  });

  it('treats undefined like null for the range branch (only max defined)', () => {
    expect(formatBudget(undefined, 2500, 'GBP')).toBe('Up to £2,500');
  });

  it('treats undefined like null for the range branch (only min defined)', () => {
    expect(formatBudget(750, undefined, 'GBP')).toBe('From £750');
  });

  // 0 is a valid value and must NOT be treated as "missing" (uses != null, not falsy).
  it('treats 0 as a present value for min (range branch)', () => {
    expect(formatBudget(0, 5000, 'USD')).toBe('$0 - $5,000');
  });

  it('treats 0 as a present value for max (range branch)', () => {
    expect(formatBudget(1000, 0, 'USD')).toBe('$1,000 - $0');
  });

  it('treats min=0 alone as present ("From $0")', () => {
    expect(formatBudget(0, null, 'USD')).toBe('From $0');
  });

  it('treats max=0 alone as present ("Up to $0")', () => {
    expect(formatBudget(null, 0, 'USD')).toBe('Up to $0');
  });

  it('treats 0/0 as a present range', () => {
    expect(formatBudget(0, 0, 'USD')).toBe('$0 - $0');
  });

  // Whole units, not cents — values are rendered verbatim with thousands grouping.
  it('renders whole-unit amounts with thousands separators (not cents)', () => {
    expect(formatBudget(1500000, 2500000, 'USD')).toBe('$1,500,000 - $2,500,000');
  });

  it('uses the resolved currency symbol on both sides of a range', () => {
    expect(formatBudget(100, 200, 'EUR')).toBe('€100 - €200');
  });

  it('uses a multi-char prefix symbol (AUD) on both sides', () => {
    expect(formatBudget(100, 200, 'AUD')).toBe('A$100 - A$200');
  });

  it('falls back to "<code> " prefix for an unknown currency', () => {
    expect(formatBudget(100, 200, 'XYZ')).toBe('XYZ 100 - XYZ 200');
  });

  it('handles negative numbers via toLocaleString', () => {
    expect(formatBudget(-100, -50, 'USD')).toBe('$-100 - $-50');
  });
});

describe('formatLocation', () => {
  it('joins all three parts with ", "', () => {
    expect(formatLocation('London', 'England', 'UK')).toBe('London, England, UK');
  });

  it('drops a null city', () => {
    expect(formatLocation(null, 'England', 'UK')).toBe('England, UK');
  });

  it('drops a null state/province', () => {
    expect(formatLocation('London', null, 'UK')).toBe('London, UK');
  });

  it('drops a null country', () => {
    expect(formatLocation('London', 'England', null)).toBe('London, England');
  });

  it('returns just the single present part', () => {
    expect(formatLocation('London', null, null)).toBe('London');
    expect(formatLocation(null, null, 'UK')).toBe('UK');
  });

  it('returns null when all parts are null', () => {
    expect(formatLocation(null, null, null)).toBeNull();
  });

  it('returns null when all parts are undefined', () => {
    expect(formatLocation(undefined, undefined, undefined)).toBeNull();
  });

  // filter(Boolean) drops empty strings as well as null/undefined.
  it('drops empty-string parts (falsy)', () => {
    expect(formatLocation('', 'England', '')).toBe('England');
  });

  it('returns null when every part is an empty string', () => {
    expect(formatLocation('', '', '')).toBeNull();
  });

  it('preserves unicode and order', () => {
    expect(formatLocation('München', 'Bayern', 'Deutschland')).toBe('München, Bayern, Deutschland');
  });
});

describe('formatCategory', () => {
  it.each([
    ['vehicle', 'Vehicle'],
    ['engine', 'Engine'],
    ['parts', 'Parts'],
  ])('maps known category %s -> %s', (input, expected) => {
    expect(formatCategory(input)).toBe(expected);
  });

  it('returns the raw value for an unknown category', () => {
    expect(formatCategory('wheels')).toBe('wheels');
  });

  it('returns empty string verbatim', () => {
    expect(formatCategory('')).toBe('');
  });

  it('is case-sensitive (uppercase falls through to raw)', () => {
    expect(formatCategory('Vehicle')).toBe('Vehicle');
  });
});

describe('categoryBadgeClass', () => {
  it.each([
    ['vehicle', 'badge-primary'],
    ['engine', 'badge-secondary'],
    ['parts', 'badge-accent'],
  ])('maps known category %s -> %s', (input, expected) => {
    expect(categoryBadgeClass(input)).toBe(expected);
  });

  it.each(['wheels', '', 'VEHICLE', 'unknown'])('returns badge-ghost for unknown/edge value %j', (input) => {
    expect(categoryBadgeClass(input)).toBe('badge-ghost');
  });
});

describe('wantedStatusBadgeClass', () => {
  it.each([
    ['fulfilled', 'badge-success'],
    ['expired', 'badge-error'],
    ['flagged', 'badge-warning'],
  ])('maps known status %s -> %s', (input, expected) => {
    expect(wantedStatusBadgeClass(input)).toBe(expected);
  });

  // 'cancelled' shares the default branch.
  it('maps cancelled to badge-ghost (shared default branch)', () => {
    expect(wantedStatusBadgeClass('cancelled')).toBe('badge-ghost');
  });

  it.each(['active', 'removed', '', 'FULFILLED'])('returns badge-ghost for %j', (input) => {
    expect(wantedStatusBadgeClass(input)).toBe('badge-ghost');
  });
});

describe('formatWantedStatus', () => {
  it.each([
    ['active', 'Active'],
    ['fulfilled', 'Fulfilled'],
    ['expired', 'Expired'],
    ['flagged', 'Under Review'],
    ['cancelled', 'Cancelled'],
    ['removed', 'Removed'],
  ])('maps known status %s -> %s', (input, expected) => {
    expect(formatWantedStatus(input)).toBe(expected);
  });

  it('returns the raw value for an unknown status', () => {
    expect(formatWantedStatus('archived')).toBe('archived');
  });

  it('returns empty string verbatim', () => {
    expect(formatWantedStatus('')).toBe('');
  });

  it('is case-sensitive (uppercase falls through to raw)', () => {
    expect(formatWantedStatus('Active')).toBe('Active');
  });
});

describe('timeAgo', () => {
  // Anchor "now" so every relative branch is deterministic.
  const NOW = new Date('2026-06-28T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('returns "now" for less than 60 seconds (seconds branch, numeric:auto -> 0 second)', () => {
    expect(timeAgo(ago(10 * SEC))).toBe('now');
  });

  it('returns "now" at the exact present instant', () => {
    expect(timeAgo(NOW.toISOString())).toBe('now');
  });

  it('returns "now" just under the 60s boundary (59s)', () => {
    expect(timeAgo(ago(59 * SEC))).toBe('now');
  });

  it('crosses into the minute branch at exactly 60s', () => {
    expect(timeAgo(ago(60 * SEC))).toBe('1 minute ago');
  });

  it('reports minutes', () => {
    expect(timeAgo(ago(5 * MIN))).toBe('5 minutes ago');
  });

  it('reports 59 minutes just under the hour boundary', () => {
    expect(timeAgo(ago(59 * MIN))).toBe('59 minutes ago');
  });

  it('crosses into the hour branch at exactly 60 minutes', () => {
    expect(timeAgo(ago(60 * MIN))).toBe('1 hour ago');
  });

  it('reports hours', () => {
    expect(timeAgo(ago(5 * HOUR))).toBe('5 hours ago');
  });

  it('reports 23 hours just under the day boundary', () => {
    expect(timeAgo(ago(23 * HOUR))).toBe('23 hours ago');
  });

  it('crosses into the day branch at exactly 24 hours (numeric:auto -> "yesterday")', () => {
    expect(timeAgo(ago(24 * HOUR))).toBe('yesterday');
  });

  it('reports multiple days', () => {
    expect(timeAgo(ago(3 * DAY))).toBe('3 days ago');
  });

  it('reports 6 days just under the week boundary', () => {
    expect(timeAgo(ago(6 * DAY))).toBe('6 days ago');
  });

  it('crosses into the week branch at exactly 7 days (numeric:auto -> "last week")', () => {
    expect(timeAgo(ago(7 * DAY))).toBe('last week');
  });

  it('reports multiple weeks', () => {
    expect(timeAgo(ago(21 * DAY))).toBe('3 weeks ago');
  });

  // weeks < 5 keeps the week branch; the month branch is computed from days/30.
  it('reports 4 weeks (28 days) — still the week branch', () => {
    expect(timeAgo(ago(28 * DAY))).toBe('4 weeks ago');
  });

  // 35 days -> weeks = 5 (not < 5) so falls through; months = floor(35/30) = 1.
  it('crosses into the month branch around 35 days (numeric:auto -> "last month")', () => {
    expect(timeAgo(ago(35 * DAY))).toBe('last month');
  });

  it('reports multiple months', () => {
    expect(timeAgo(ago(90 * DAY))).toBe('3 months ago');
  });

  // 360 days -> months = floor(360/30) = 12, not < 12, so year branch fires.
  // The year branch reports floor(days/365): floor(360/365) = 0 -> "this year".
  it('reaches the year branch but rounds to 0 years at 360 days ("this year")', () => {
    expect(timeAgo(ago(360 * DAY))).toBe('this year');
  });

  it('reports one year past the 365-day mark ("last year")', () => {
    expect(timeAgo(ago(400 * DAY))).toBe('last year');
  });

  it('reports multiple years', () => {
    expect(timeAgo(ago(800 * DAY))).toBe('2 years ago');
  });

  it('honors an explicit locale (es) for the minute branch', () => {
    expect(timeAgo(ago(5 * MIN), 'es')).toBe('hace 5 minutos');
  });

  it('honors an explicit locale (es) for the day branch (numeric:auto -> "ayer")', () => {
    expect(timeAgo(ago(24 * HOUR), 'es')).toBe('ayer');
  });

  // Malformed date -> NaN getTime() -> seconds is NaN; NaN < 60 is false, and every
  // subsequent comparison is also false, so it falls through to the year branch and
  // calls Intl.RelativeTimeFormat.format(NaN), which throws a RangeError. The util
  // does not guard against unparseable dates — callers must pass a valid date string.
  it('throws a RangeError on an unparseable date string (no NaN guard)', () => {
    expect(() => timeAgo('not-a-date')).toThrow(RangeError);
  });
});
