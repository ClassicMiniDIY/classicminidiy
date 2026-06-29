import { describe, it, expect } from 'vitest';
import { useFormatters } from '~/app/composables/useFormatters';

// useFormatters is a pure composable: every method is a side-effect-free
// function with no Supabase/Auth/$fetch dependency. No global mocks needed.
const formatters = useFormatters();

describe('useFormatters', () => {
  // ---------------------------------------------------------------------------
  // formatCurrency
  // ---------------------------------------------------------------------------
  describe('formatCurrency', () => {
    it('formats currency with dollar sign and thousands separators, no cents', () => {
      expect(formatters.formatCurrency(1234)).toBe('$1,234');
      expect(formatters.formatCurrency(1234567)).toBe('$1,234,567');
      expect(formatters.formatCurrency(5)).toBe('$5');
    });

    it('rounds to whole dollars (zero fraction digits)', () => {
      expect(formatters.formatCurrency(1234.99)).toBe('$1,235');
      expect(formatters.formatCurrency(1234.4)).toBe('$1,234');
    });

    it('returns $0 for zero, null, and undefined (falsy guard)', () => {
      expect(formatters.formatCurrency(0)).toBe('$0');
      expect(formatters.formatCurrency(null)).toBe('$0');
      expect(formatters.formatCurrency(undefined)).toBe('$0');
    });
  });

  // ---------------------------------------------------------------------------
  // formatPrice
  // ---------------------------------------------------------------------------
  describe('formatPrice', () => {
    it('formats price with thousands separator and no dollar sign', () => {
      expect(formatters.formatPrice(1234)).toBe('1,234');
      expect(formatters.formatPrice(1234567)).toBe('1,234,567');
    });

    it("returns '0' for zero, null, and undefined", () => {
      expect(formatters.formatPrice(0)).toBe('0');
      expect(formatters.formatPrice(null)).toBe('0');
      expect(formatters.formatPrice(undefined)).toBe('0');
    });
  });

  // ---------------------------------------------------------------------------
  // formatMileage
  // ---------------------------------------------------------------------------
  describe('formatMileage', () => {
    it('formats mileage with thousands separator', () => {
      expect(formatters.formatMileage(12345)).toBe('12,345');
      expect(formatters.formatMileage(123456)).toBe('123,456');
    });

    it("returns '0' for zero, null, and undefined", () => {
      expect(formatters.formatMileage(0)).toBe('0');
      expect(formatters.formatMileage(null)).toBe('0');
      expect(formatters.formatMileage(undefined)).toBe('0');
    });
  });

  // ---------------------------------------------------------------------------
  // formatDate
  // ---------------------------------------------------------------------------
  describe('formatDate', () => {
    it('formats an ISO date string to a localized long-form date', () => {
      const result = formatters.formatDate('2024-01-15T12:00:00Z');
      expect(result).toContain('2024');
      // Day boundary may shift to Jan 14 depending on the runner timezone.
      expect(result).toMatch(/January/);
    });

    it('returns empty string for an invalid date string (RangeError guard)', () => {
      expect(formatters.formatDate('not-a-date')).toBe('');
      expect(formatters.formatDate('')).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatPartsSubcategory
  // ---------------------------------------------------------------------------
  describe('formatPartsSubcategory', () => {
    it('maps every known subcategory to its label', () => {
      expect(formatters.formatPartsSubcategory('body_exterior')).toBe('Body & Exterior');
      expect(formatters.formatPartsSubcategory('interior')).toBe('Interior');
      expect(formatters.formatPartsSubcategory('wheels_tires')).toBe('Wheels & Tires');
      expect(formatters.formatPartsSubcategory('engine_internals')).toBe('Engine Internals');
      expect(formatters.formatPartsSubcategory('suspension')).toBe('Suspension');
      expect(formatters.formatPartsSubcategory('suspension_brakes')).toBe('Suspension & Brakes');
      expect(formatters.formatPartsSubcategory('electrical')).toBe('Electrical');
      expect(formatters.formatPartsSubcategory('trim_badges')).toBe('Trim & Badges');
      expect(formatters.formatPartsSubcategory('glass_seals')).toBe('Glass & Seals');
      expect(formatters.formatPartsSubcategory('other')).toBe('Other Parts');
    });

    it('returns the raw value for an unknown subcategory', () => {
      expect(formatters.formatPartsSubcategory('unknown_category')).toBe('unknown_category');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatPartsSubcategory(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatTransmissionType
  // ---------------------------------------------------------------------------
  describe('formatTransmissionType', () => {
    it('maps every known transmission type to its label', () => {
      expect(formatters.formatTransmissionType('magic_wand')).toBe('Magic Wand');
      expect(formatters.formatTransmissionType('3_synchro_remote')).toBe('3-Synchro Remote');
      expect(formatters.formatTransmissionType('4_synchro_remote')).toBe('4-Synchro Remote');
      expect(formatters.formatTransmissionType('rod_change')).toBe('Rod Change');
      expect(formatters.formatTransmissionType('automatic')).toBe('Automatic');
    });

    it('returns the raw value for an unknown type', () => {
      expect(formatters.formatTransmissionType('unknown_type')).toBe('unknown_type');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatTransmissionType(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatCondition
  // ---------------------------------------------------------------------------
  describe('formatCondition', () => {
    it('maps every known condition to its label', () => {
      expect(formatters.formatCondition('new')).toBe('New');
      expect(formatters.formatCondition('used')).toBe('Used');
      expect(formatters.formatCondition('project')).toBe('Project');
      expect(formatters.formatCondition('scrap')).toBe('Scrap');
      expect(formatters.formatCondition('excellent')).toBe('Excellent');
      expect(formatters.formatCondition('good')).toBe('Good');
      expect(formatters.formatCondition('fair')).toBe('Fair');
      expect(formatters.formatCondition('rebuilt')).toBe('Rebuilt');
      expect(formatters.formatCondition('running')).toBe('Running');
      expect(formatters.formatCondition('running_fair')).toBe('Running - Fair');
      expect(formatters.formatCondition('not_running')).toBe('Not Running');
      expect(formatters.formatCondition('core')).toBe('Core');
      expect(formatters.formatCondition('parts_only')).toBe('Parts Only');
    });

    it('capitalizes the first letter for an unknown condition', () => {
      expect(formatters.formatCondition('pristine')).toBe('Pristine');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatCondition(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatEngineCondition
  // ---------------------------------------------------------------------------
  describe('formatEngineCondition', () => {
    it('maps every known engine condition to its detailed label', () => {
      expect(formatters.formatEngineCondition('rebuilt')).toBe('Rebuilt / Reconditioned');
      expect(formatters.formatEngineCondition('running')).toBe('Running - Good Condition');
      expect(formatters.formatEngineCondition('running_fair')).toBe('Running - Fair Condition');
      expect(formatters.formatEngineCondition('not_running')).toBe('Not Running - Complete');
      expect(formatters.formatEngineCondition('core')).toBe('Core / For Rebuild');
      expect(formatters.formatEngineCondition('parts_only')).toBe('For Parts Only');
    });

    it('falls back to formatCondition for an unknown condition (mapped value)', () => {
      // 'new' is not in the engine map but is in formatCondition's map.
      expect(formatters.formatEngineCondition('new')).toBe('New');
    });

    it('falls back to formatCondition capitalize-path for a fully unknown value', () => {
      expect(formatters.formatEngineCondition('mystery')).toBe('Mystery');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatEngineCondition(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatStatus
  // ---------------------------------------------------------------------------
  describe('formatStatus', () => {
    it('maps every known status to its label', () => {
      expect(formatters.formatStatus('active')).toBe('Active');
      expect(formatters.formatStatus('draft')).toBe('Draft');
      expect(formatters.formatStatus('sold')).toBe('Sold');
      expect(formatters.formatStatus('expired')).toBe('Expired');
      expect(formatters.formatStatus('cancelled')).toBe('Cancelled');
      expect(formatters.formatStatus('pending')).toBe('Pending');
    });

    it('maps both example tiers to "Example"', () => {
      expect(formatters.formatStatus('example_free')).toBe('Example');
      expect(formatters.formatStatus('example_paid')).toBe('Example');
    });

    it('capitalizes the first letter for an unknown status', () => {
      expect(formatters.formatStatus('archived')).toBe('Archived');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatStatus(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatTier
  // ---------------------------------------------------------------------------
  describe('formatTier', () => {
    it('maps known tiers to their labels (paid => Premium)', () => {
      expect(formatters.formatTier('free')).toBe('Free');
      expect(formatters.formatTier('paid')).toBe('Premium');
    });

    it('capitalizes the first letter for an unknown tier', () => {
      expect(formatters.formatTier('enterprise')).toBe('Enterprise');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatTier(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatManufacturer
  // ---------------------------------------------------------------------------
  describe('formatManufacturer', () => {
    it('capitalizes the first letter only (rest untouched)', () => {
      expect(formatters.formatManufacturer('rover')).toBe('Rover');
      expect(formatters.formatManufacturer('austin')).toBe('Austin');
      // Only the first char is changed; existing casing is preserved.
      expect(formatters.formatManufacturer('bMC')).toBe('BMC');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatManufacturer(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // getConditionBadgeClass
  // ---------------------------------------------------------------------------
  describe('getConditionBadgeClass', () => {
    it('returns the correct badge class for each known condition', () => {
      expect(formatters.getConditionBadgeClass('new')).toBe('badge-success');
      expect(formatters.getConditionBadgeClass('used')).toBe('badge-info');
      expect(formatters.getConditionBadgeClass('project')).toBe('badge-warning');
      expect(formatters.getConditionBadgeClass('scrap')).toBe('badge-error');
    });

    it('is case insensitive (lowercases the key)', () => {
      expect(formatters.getConditionBadgeClass('NEW')).toBe('badge-success');
      expect(formatters.getConditionBadgeClass('Used')).toBe('badge-info');
    });

    it('returns badge-ghost for unknown condition and for null', () => {
      expect(formatters.getConditionBadgeClass('unknown')).toBe('badge-ghost');
      expect(formatters.getConditionBadgeClass(null)).toBe('badge-ghost');
    });
  });

  // ---------------------------------------------------------------------------
  // formatFieldName
  // ---------------------------------------------------------------------------
  describe('formatFieldName', () => {
    it('converts snake_case to Title Case', () => {
      expect(formatters.formatFieldName('engine_size')).toBe('Engine Size');
      expect(formatters.formatFieldName('original_color')).toBe('Original Color');
      expect(formatters.formatFieldName('has_heritage_certificate')).toBe('Has Heritage Certificate');
    });

    it('capitalizes a single word with no underscores', () => {
      expect(formatters.formatFieldName('color')).toBe('Color');
    });
  });

  // ---------------------------------------------------------------------------
  // formatPartCondition
  // ---------------------------------------------------------------------------
  describe('formatPartCondition', () => {
    it('joins underscore-separated words with a dash separator, each capitalized', () => {
      expect(formatters.formatPartCondition('used_excellent')).toBe('Used - Excellent');
      expect(formatters.formatPartCondition('new_oem')).toBe('New - Oem');
    });

    it('capitalizes a single word with no underscore (no separator added)', () => {
      expect(formatters.formatPartCondition('new')).toBe('New');
    });
  });

  // ---------------------------------------------------------------------------
  // getInitials
  // ---------------------------------------------------------------------------
  describe('getInitials', () => {
    it('returns uppercase first letters of the first two words', () => {
      expect(formatters.getInitials('John Doe')).toBe('JD');
      expect(formatters.getInitials('Jane Smith')).toBe('JS');
    });

    it('handles a single name', () => {
      expect(formatters.getInitials('John')).toBe('J');
    });

    it('caps at two characters for three or more words', () => {
      expect(formatters.getInitials('John Peter Doe')).toBe('JP');
    });
  });

  // ---------------------------------------------------------------------------
  // formatDisplayLocation (never exposes postal/zip)
  // ---------------------------------------------------------------------------
  describe('formatDisplayLocation', () => {
    it('joins city and state/province for a US listing (omits country)', () => {
      expect(
        formatters.formatDisplayLocation({
          city: 'Austin',
          state_province: 'TX',
          country: 'United States',
        })
      ).toBe('Austin, TX');
    });

    it('appends country for a non-US listing', () => {
      expect(
        formatters.formatDisplayLocation({
          city: 'London',
          state_province: 'England',
          country: 'United Kingdom',
        })
      ).toBe('London, England, United Kingdom');
    });

    it('uses only the parts that are present', () => {
      expect(formatters.formatDisplayLocation({ city: 'Austin' })).toBe('Austin');
      expect(formatters.formatDisplayLocation({ state_province: 'TX' })).toBe('TX');
    });

    it('falls back to the location field when no structured parts exist', () => {
      expect(
        formatters.formatDisplayLocation({
          city: null,
          state_province: null,
          country: null,
          location: 'Somewhere, US',
        })
      ).toBe('Somewhere, US');
    });

    it('returns empty string when nothing is provided', () => {
      expect(formatters.formatDisplayLocation({})).toBe('');
      expect(
        formatters.formatDisplayLocation({ city: null, state_province: null, country: null, location: null })
      ).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatListingPrice (Free for zero/null/undefined)
  // ---------------------------------------------------------------------------
  describe('formatListingPrice', () => {
    it('returns "Free" for zero, null, and undefined price', () => {
      expect(formatters.formatListingPrice(0, '$0')).toBe('Free');
      expect(formatters.formatListingPrice(null, '$1,234')).toBe('Free');
      expect(formatters.formatListingPrice(undefined, '$1,234')).toBe('Free');
    });

    it('returns the pre-formatted fallback for a non-zero price', () => {
      expect(formatters.formatListingPrice(1234, '$1,234')).toBe('$1,234');
    });
  });

  // ---------------------------------------------------------------------------
  // formatListingCategory
  // ---------------------------------------------------------------------------
  describe('formatListingCategory', () => {
    it('maps every known category to its label', () => {
      expect(formatters.formatListingCategory('vehicle')).toBe('Vehicle');
      expect(formatters.formatListingCategory('engine')).toBe('Engine');
      expect(formatters.formatListingCategory('parts')).toBe('Parts');
    });

    it('capitalizes the first letter for an unknown category', () => {
      expect(formatters.formatListingCategory('accessory')).toBe('Accessory');
    });

    it('returns empty string for null', () => {
      expect(formatters.formatListingCategory(null)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // formatValue (diff/table rendering)
  // ---------------------------------------------------------------------------
  describe('formatValue', () => {
    it('returns N/A for null and undefined', () => {
      expect(formatters.formatValue(null)).toBe('N/A');
      expect(formatters.formatValue(undefined)).toBe('N/A');
    });

    it('renders booleans as Yes/No', () => {
      expect(formatters.formatValue(true)).toBe('Yes');
      expect(formatters.formatValue(false)).toBe('No');
    });

    it('renders numbers with locale thousands separators (including 0)', () => {
      expect(formatters.formatValue(1234567)).toBe('1,234,567');
      expect(formatters.formatValue(0)).toBe('0');
    });

    it('returns short strings unchanged', () => {
      expect(formatters.formatValue('Cooper S')).toBe('Cooper S');
    });

    it('truncates strings longer than 50 chars to 47 chars plus ellipsis', () => {
      const long = 'a'.repeat(60);
      const result = formatters.formatValue(long);
      expect(result).toBe('a'.repeat(47) + '...');
      expect(result).toHaveLength(50);
    });

    it('does not truncate a string of exactly 50 chars', () => {
      const exact = 'b'.repeat(50);
      expect(formatters.formatValue(exact)).toBe(exact);
    });

    it('stringifies other types (e.g. arrays)', () => {
      expect(formatters.formatValue(['a', 'b'])).toBe('a,b');
    });
  });

  // ---------------------------------------------------------------------------
  // getSourceDisplayName (external listing source)
  // ---------------------------------------------------------------------------
  describe('getSourceDisplayName', () => {
    it('maps every known source site to its short name', () => {
      expect(formatters.getSourceDisplayName('bat')).toBe('BaT');
      expect(formatters.getSourceDisplayName('carsandbids')).toBe('C&B');
      expect(formatters.getSourceDisplayName('copart')).toBe('Copart');
      expect(formatters.getSourceDisplayName('craigslist')).toBe('CL');
      expect(formatters.getSourceDisplayName('facebook')).toBe('FB');
      expect(formatters.getSourceDisplayName('ebay')).toBe('eBay');
      expect(formatters.getSourceDisplayName('other')).toBe('Other');
    });

    it('returns "Other" for an unknown source site', () => {
      expect(formatters.getSourceDisplayName('autotrader')).toBe('Other');
    });
  });

  // ---------------------------------------------------------------------------
  // getSourceBadgeClass (external listing source)
  // ---------------------------------------------------------------------------
  describe('getSourceBadgeClass', () => {
    it('maps every known source site to its badge class', () => {
      expect(formatters.getSourceBadgeClass('bat')).toBe('badge-success');
      expect(formatters.getSourceBadgeClass('carsandbids')).toBe('badge-info');
      expect(formatters.getSourceBadgeClass('copart')).toBe('badge-accent');
      expect(formatters.getSourceBadgeClass('craigslist')).toBe('badge-secondary');
      expect(formatters.getSourceBadgeClass('facebook')).toBe('badge-primary');
      expect(formatters.getSourceBadgeClass('ebay')).toBe('badge-warning');
      expect(formatters.getSourceBadgeClass('other')).toBe('badge-ghost');
    });

    it('returns badge-ghost for an unknown source site', () => {
      expect(formatters.getSourceBadgeClass('autotrader')).toBe('badge-ghost');
    });
  });

  // ---------------------------------------------------------------------------
  // truncateUrl
  // ---------------------------------------------------------------------------
  describe('truncateUrl', () => {
    it('returns hostname + path for a short, valid URL', () => {
      expect(formatters.truncateUrl('https://example.com/listing/123')).toBe('example.com/listing/123');
    });

    it('truncates a long path to 40 chars plus ellipsis (keeps hostname)', () => {
      const longPath = '/' + 'a'.repeat(60);
      const result = formatters.truncateUrl(`https://example.com${longPath}`);
      expect(result).toBe('example.com/' + 'a'.repeat(39) + '...');
    });

    it('falls back to the raw string for an unparseable URL (under 60 chars)', () => {
      expect(formatters.truncateUrl('not a url')).toBe('not a url');
    });

    it('truncates an unparseable string longer than 60 chars to 60 chars plus ellipsis', () => {
      const longInvalid = 'x'.repeat(80);
      const result = formatters.truncateUrl(longInvalid);
      expect(result).toBe('x'.repeat(60) + '...');
    });
  });
});
