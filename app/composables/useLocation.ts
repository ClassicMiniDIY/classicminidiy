/**
 * Extract country from a location string
 * Assumes format like "City, State, Country" or "City, Country"
 * Returns the last part after the last comma, or the full string if no comma
 */
export const useLocation = () => {
  const extractCountry = (location: string | null | undefined): string => {
    if (!location) return '';

    // Split by comma and get the last part (should be country)
    const parts = location.split(',').map((part) => part.trim());

    // Return the last part (country)
    return parts[parts.length - 1] || location;
  };

  /**
   * Get display location for public profile
   * Only shows country for privacy
   */
  const getPublicLocation = (location: string | null | undefined): string => {
    return extractCountry(location);
  };

  /**
   * Strip postal/zip codes from a freeform location string.
   * Handles US ZIP (12345, 12345-6789), UK (SW1A 1AA), Canadian (A1A 1A1),
   * and European (4-5 digit) postal codes.
   */
  const stripPostalCodes = (location: string): string => {
    return location
      .replace(/\b\d{5,10}(-\d{3,4})?\b/g, '') // US ZIP (5+4) and longer postal codes
      .replace(/(?<=,\s*|\s)\d{4}\b/g, '') // 4-digit codes (AU, NL, DK) after comma/space
      .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, '') // UK postal codes
      .replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/gi, '') // Canadian postal codes
      .replace(/\s{2,}/g, ' ') // collapse double spaces
      .replace(/,\s*,/g, ',') // remove empty comma sections
      .replace(/,\s*$/g, '') // trailing comma
      .replace(/^\s*,/g, '') // leading comma
      .trim();
  };

  /**
   * Get full location without postal codes (for user's own profile view)
   */
  const getFullLocation = (location: string | null | undefined): string => {
    if (!location) return '';
    return stripPostalCodes(location);
  };

  return {
    extractCountry,
    getPublicLocation,
    getFullLocation,
  };
};
