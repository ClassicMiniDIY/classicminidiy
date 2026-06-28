/**
 * Shared formatting utilities for Classic Mini listings
 */
export function useFormatters() {
  /**
   * Format price as currency (with $ symbol)
   */
  const formatCurrency = (amount: number | null | undefined): string => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Format price as number (without $ symbol)
   */
  const formatPrice = (price: number | null | undefined): string => {
    if (!price) return '0';
    return new Intl.NumberFormat('en-US').format(price);
  };

  /**
   * Format mileage with thousands separator
   */
  const formatMileage = (mileage: number | null | undefined): string => {
    if (!mileage) return '0';
    return new Intl.NumberFormat('en-US').format(mileage);
  };

  /**
   * Format date string to localized format
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    // Guard malformed/empty dates — toLocaleDateString throws RangeError on an
    // Invalid Date, which would crash rendering.
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /**
   * Format parts subcategory to human-readable label
   */
  const formatPartsSubcategory = (subcategory: string | null): string => {
    if (!subcategory) return '';
    const labels: Record<string, string> = {
      body_exterior: 'Body & Exterior',
      interior: 'Interior',
      wheels_tires: 'Wheels & Tires',
      engine_internals: 'Engine Internals',
      suspension: 'Suspension',
      suspension_brakes: 'Suspension & Brakes',
      electrical: 'Electrical',
      trim_badges: 'Trim & Badges',
      glass_seals: 'Glass & Seals',
      other: 'Other Parts',
    };
    return labels[subcategory] || subcategory;
  };

  /**
   * Format transmission type to human-readable label
   */
  const formatTransmissionType = (type: string | null): string => {
    if (!type) return '';
    const labels: Record<string, string> = {
      magic_wand: 'Magic Wand',
      '3_synchro_remote': '3-Synchro Remote',
      '4_synchro_remote': '4-Synchro Remote',
      rod_change: 'Rod Change',
      automatic: 'Automatic',
    };
    return labels[type] || type;
  };

  /**
   * Format vehicle/engine condition to human-readable label
   */
  const formatCondition = (condition: string | null): string => {
    if (!condition) return '';
    const labels: Record<string, string> = {
      new: 'New',
      used: 'Used',
      project: 'Project',
      scrap: 'Scrap',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      rebuilt: 'Rebuilt',
      running: 'Running',
      running_fair: 'Running - Fair',
      not_running: 'Not Running',
      core: 'Core',
      parts_only: 'Parts Only',
    };
    return labels[condition] || condition.charAt(0).toUpperCase() + condition.slice(1);
  };

  /**
   * Format engine condition to detailed human-readable label
   */
  const formatEngineCondition = (condition: string | null): string => {
    if (!condition) return '';
    const labels: Record<string, string> = {
      rebuilt: 'Rebuilt / Reconditioned',
      running: 'Running - Good Condition',
      running_fair: 'Running - Fair Condition',
      not_running: 'Not Running - Complete',
      core: 'Core / For Rebuild',
      parts_only: 'For Parts Only',
    };
    return labels[condition] || formatCondition(condition);
  };

  /**
   * Format listing status to human-readable label
   */
  const formatStatus = (status: string | null): string => {
    if (!status) return '';
    const labels: Record<string, string> = {
      active: 'Active',
      draft: 'Draft',
      sold: 'Sold',
      expired: 'Expired',
      cancelled: 'Cancelled',
      pending: 'Pending',
      example_free: 'Example',
      example_paid: 'Example',
    };
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  /**
   * Format listing tier to human-readable label
   */
  const formatTier = (tier: string | null): string => {
    if (!tier) return '';
    const labels: Record<string, string> = {
      free: 'Free',
      paid: 'Premium',
    };
    return labels[tier] || tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  /**
   * Format manufacturer name (capitalize first letter)
   */
  const formatManufacturer = (manufacturer: string | null): string => {
    if (!manufacturer) return '';
    return manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
  };

  /**
   * Get CSS class for condition badge
   */
  const getConditionBadgeClass = (condition: string | null): string => {
    if (!condition) return 'badge-ghost';
    const classes: Record<string, string> = {
      new: 'badge-success',
      used: 'badge-info',
      project: 'badge-warning',
      scrap: 'badge-error',
    };
    return classes[condition.toLowerCase()] || 'badge-ghost';
  };

  /**
   * Format snake_case field name to Title Case
   */
  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  /**
   * Format part condition (e.g., "used_excellent" to "Used - Excellent")
   */
  const formatPartCondition = (condition: string): string => {
    return condition
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' - ');
  };

  /**
   * Get initials from a name (max 2 characters)
   */
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Format display location from structured fields (never shows postal/zip codes).
   * Prefers city + state/province, appends country for non-US listings.
   */
  const formatDisplayLocation = (listing: {
    city?: string | null;
    state_province?: string | null;
    country?: string | null;
    location?: string | null;
  }): string => {
    const parts: string[] = [];
    if (listing.city) parts.push(listing.city);
    if (listing.state_province) parts.push(listing.state_province);
    if (listing.country && listing.country !== 'United States') {
      parts.push(listing.country);
    }
    if (parts.length > 0) return parts.join(', ');
    // Fallback to location field (auto-generated as "City, State" by DB trigger)
    return listing.location || '';
  };

  /**
   * Format a listing price, returning "Free" for zero-price listings.
   * Pass the pre-formatted price string as the fallback for non-free listings.
   */
  const formatListingPrice = (price: number | null | undefined, formattedFallback: string): string => {
    if (price === 0 || price === null || price === undefined) return 'Free';
    return formattedFallback;
  };

  /**
   * Format listing category to human-readable label
   */
  const formatListingCategory = (category: string | null): string => {
    if (!category) return '';
    const labels: Record<string, string> = {
      vehicle: 'Vehicle',
      engine: 'Engine',
      parts: 'Parts',
    };
    return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  /**
   * Format any value for display in diffs/tables
   */
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'string' && value.length > 50) return value.substring(0, 47) + '...';
    return String(value);
  };

  /**
   * Get display name for external listing source site
   */
  const getSourceDisplayName = (site: string): string => {
    const map: Record<string, string> = {
      bat: 'BaT',
      carsandbids: 'C&B',
      copart: 'Copart',
      craigslist: 'CL',
      facebook: 'FB',
      ebay: 'eBay',
      other: 'Other',
    };
    return map[site] || 'Other';
  };

  /**
   * Get badge CSS class for external listing source site
   */
  const getSourceBadgeClass = (site: string): string => {
    const map: Record<string, string> = {
      bat: 'badge-success',
      carsandbids: 'badge-info',
      copart: 'badge-accent',
      craigslist: 'badge-secondary',
      facebook: 'badge-primary',
      ebay: 'badge-warning',
      other: 'badge-ghost',
    };
    return map[site] || 'badge-ghost';
  };

  /**
   * Truncate a URL for display
   */
  const truncateUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.length > 40 ? parsed.pathname.slice(0, 40) + '...' : parsed.pathname;
      return parsed.hostname + path;
    } catch {
      return url.length > 60 ? url.slice(0, 60) + '...' : url;
    }
  };

  return {
    formatCurrency,
    formatPrice,
    formatMileage,
    formatDate,
    formatPartsSubcategory,
    formatTransmissionType,
    formatCondition,
    formatEngineCondition,
    formatStatus,
    formatTier,
    formatManufacturer,
    getConditionBadgeClass,
    formatFieldName,
    formatPartCondition,
    getInitials,
    formatDisplayLocation,
    formatListingCategory,
    formatListingPrice,
    formatValue,
    getSourceDisplayName,
    getSourceBadgeClass,
    truncateUrl,
  };
}
