import { describe, it, expect, beforeEach } from 'vitest';

// useLocation is a pure-function composable: no Supabase, no auth, no $fetch.
// It exposes three string helpers: extractCountry, getPublicLocation, getFullLocation.
// We import it dynamically (matching the canonical exchange composable-test style)
// and destructure once per test to keep instances isolated.
let extractCountry: (location: string | null | undefined) => string;
let getPublicLocation: (location: string | null | undefined) => string;
let getFullLocation: (location: string | null | undefined) => string;

beforeEach(async () => {
  const { useLocation } = await import('~/app/composables/useLocation');
  ({ extractCountry, getPublicLocation, getFullLocation } = useLocation());
});

describe('useLocation', () => {
  // ---------------------------------------------------------------------------
  // extractCountry()
  // ---------------------------------------------------------------------------
  describe('extractCountry()', () => {
    it('returns the last comma-separated part (the country) from City, State, Country', () => {
      expect(extractCountry('Austin, TX, United States')).toBe('United States');
    });

    it('returns the last part from City, Country', () => {
      expect(extractCountry('London, United Kingdom')).toBe('United Kingdom');
    });

    it('returns the whole string when there is no comma', () => {
      expect(extractCountry('United Kingdom')).toBe('United Kingdom');
    });

    it('trims whitespace around each part', () => {
      expect(extractCountry('London,  UK ')).toBe('UK');
    });

    it('trims leading/trailing whitespace on a comma-free string via the last (only) part', () => {
      // Single part path: parts = ['Germany'] after trim, last part returned.
      expect(extractCountry('  Germany  ')).toBe('Germany');
    });

    it('returns empty string for null', () => {
      expect(extractCountry(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(extractCountry(undefined)).toBe('');
    });

    it('returns empty string for an empty string (falsy guard)', () => {
      expect(extractCountry('')).toBe('');
    });

    it('falls back to the original location when the last part is empty (trailing comma)', () => {
      // 'Austin, TX,' -> parts ['Austin','TX',''] -> last is '' -> `|| location`.
      expect(extractCountry('Austin, TX,')).toBe('Austin, TX,');
    });

    it('handles a four-part address by returning only the final segment', () => {
      expect(extractCountry('123 Main St, Austin, TX, USA')).toBe('USA');
    });
  });

  // ---------------------------------------------------------------------------
  // getPublicLocation()  (privacy: country only — delegates to extractCountry)
  // ---------------------------------------------------------------------------
  describe('getPublicLocation()', () => {
    it('returns only the country portion for privacy', () => {
      expect(getPublicLocation('San Francisco, CA, USA')).toBe('USA');
    });

    it('returns the whole string when there is no comma', () => {
      expect(getPublicLocation('France')).toBe('France');
    });

    it('returns empty string for null', () => {
      expect(getPublicLocation(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(getPublicLocation(undefined)).toBe('');
    });

    it('behaves identically to extractCountry (it is a thin alias)', () => {
      const input = 'Berlin, Brandenburg, Germany';
      expect(getPublicLocation(input)).toBe(extractCountry(input));
    });
  });

  // ---------------------------------------------------------------------------
  // getFullLocation()  (own-profile view — strips postal codes, keeps geography)
  // ---------------------------------------------------------------------------
  describe('getFullLocation()', () => {
    it('returns empty string for null', () => {
      expect(getFullLocation(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(getFullLocation(undefined)).toBe('');
    });

    it('returns empty string for an empty string', () => {
      expect(getFullLocation('')).toBe('');
    });

    it('leaves a clean City, State, Country untouched', () => {
      expect(getFullLocation('San Francisco, CA, USA')).toBe('San Francisco, CA, USA');
    });

    it('leaves a comma-free location untouched', () => {
      expect(getFullLocation('United Kingdom')).toBe('United Kingdom');
    });

    // --- US ZIP codes (5-digit and ZIP+4) ---
    it('strips a 5-digit US ZIP code', () => {
      // The ZIP token is removed but the space preceding it is preserved by the
      // current regex, so a stray space remains before the comma.
      expect(getFullLocation('Austin, TX 78701, USA')).toBe('Austin, TX , USA');
    });

    it('strips a US ZIP+4 code', () => {
      expect(getFullLocation('Austin, TX 78701-1234, USA')).toBe('Austin, TX , USA');
    });

    it('reduces a bare ZIP-only string to empty', () => {
      expect(getFullLocation('12345')).toBe('');
    });

    // --- UK postal codes ---
    it('strips a full UK postal code (with internal space)', () => {
      expect(getFullLocation('London, SW1A 1AA, UK')).toBe('London, UK');
    });

    it('strips a short UK postal code at the start of the string', () => {
      expect(getFullLocation('M1 1AE, Manchester')).toBe('Manchester');
    });

    // --- Canadian postal codes ---
    it('strips a Canadian postal code', () => {
      expect(getFullLocation('Toronto, ON, A1A 1A1, Canada')).toBe('Toronto, ON, Canada');
    });

    // --- European / 4-5 digit codes ---
    it('strips a 4-digit European code that follows a comma (NL)', () => {
      expect(getFullLocation('Amsterdam, 1011, Netherlands')).toBe('Amsterdam, Netherlands');
    });

    it('strips a 5-digit European code (DE)', () => {
      expect(getFullLocation('Berlin, 10115, Germany')).toBe('Berlin, Germany');
    });

    it('strips a 4-digit AU code that follows a space, leaving the state', () => {
      expect(getFullLocation('Sydney, NSW 2000, Australia')).toBe('Sydney, NSW , Australia');
    });

    // --- collapsing / empty-section cleanup ---
    it('collapses empty comma sections and trims a trailing comma', () => {
      // Both segments between commas reduce to nothing after ZIP/UK stripping.
      expect(getFullLocation('12345, SW1A 1AA')).toBe('');
    });

    it('does not alter a location whose only digits are part of a street name token under 5 digits', () => {
      // '90' is a 2-digit token: none of the postal rules match it.
      expect(getFullLocation('Flat 90, Bristol, England')).toBe('Flat 90, Bristol, England');
    });
  });

  // ---------------------------------------------------------------------------
  // Shape / contract
  // ---------------------------------------------------------------------------
  describe('exported surface', () => {
    it('exposes exactly extractCountry, getPublicLocation, getFullLocation as functions', async () => {
      const { useLocation } = await import('~/app/composables/useLocation');
      const api = useLocation();
      expect(Object.keys(api).sort()).toEqual(['extractCountry', 'getFullLocation', 'getPublicLocation']);
      expect(typeof api.extractCountry).toBe('function');
      expect(typeof api.getPublicLocation).toBe('function');
      expect(typeof api.getFullLocation).toBe('function');
    });
  });
});
