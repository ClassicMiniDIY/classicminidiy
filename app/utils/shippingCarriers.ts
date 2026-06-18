/**
 * Shipping carrier utilities
 * Static maps for tracking URLs, rate calculators, and carrier detection.
 * No external API calls — just URL construction and pattern matching.
 */

export const SHIPPING_METHODS = ['standard_post', 'courier_express', 'freight'] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const SHIPS_TO_OPTIONS = ['domestic_only', 'international', 'specific_countries'] as const;
export type ShipsTo = (typeof SHIPS_TO_OPTIONS)[number];

interface CarrierInfo {
  id: string;
  name: string;
  trackingUrlTemplate: string;
  rateCalculatorUrl: string;
}

const CARRIERS: Record<string, CarrierInfo> = {
  usps: {
    id: 'usps',
    name: 'USPS',
    trackingUrlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={number}',
    rateCalculatorUrl: 'https://postcalc.usps.com/Calculator',
  },
  royal_mail: {
    id: 'royal_mail',
    name: 'Royal Mail',
    trackingUrlTemplate: 'https://www.royalmail.com/track-your-item#/tracking-results/{number}',
    rateCalculatorUrl: 'https://www.royalmail.com/sending/sizes-and-weights',
  },
  australia_post: {
    id: 'australia_post',
    name: 'Australia Post',
    trackingUrlTemplate: 'https://auspost.com.au/mypost/track/#/details/{number}',
    rateCalculatorUrl: 'https://auspost.com.au/sending/calculate-postage-delivery-times',
  },
  canada_post: {
    id: 'canada_post',
    name: 'Canada Post',
    trackingUrlTemplate: 'https://www.canadapost-postescanada.ca/track-reperage/en#/details/{number}',
    rateCalculatorUrl: 'https://www.canadapost-postescanada.ca/cpc/en/tools/find-a-rate/default.page',
  },
  fedex: {
    id: 'fedex',
    name: 'FedEx',
    trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={number}',
    rateCalculatorUrl: 'https://www.fedex.com/en-us/online/rating.html',
  },
  ups: {
    id: 'ups',
    name: 'UPS',
    trackingUrlTemplate: 'https://www.ups.com/track?tracknum={number}',
    rateCalculatorUrl: 'https://www.ups.com/us/en/support/shipping-support/shipping-costs-and-calculator.page',
  },
  dhl: {
    id: 'dhl',
    name: 'DHL',
    trackingUrlTemplate: 'https://www.dhl.com/en/express/tracking.html?AWB={number}',
    rateCalculatorUrl: 'https://www.dhl.com/en/express/get_rate.html',
  },
};

/** Country → primary carriers mapping */
const COUNTRY_CARRIERS: Record<string, string[]> = {
  'United States': ['usps', 'fedex', 'ups', 'dhl'],
  USA: ['usps', 'fedex', 'ups', 'dhl'],
  US: ['usps', 'fedex', 'ups', 'dhl'],
  'United Kingdom': ['royal_mail', 'dhl', 'fedex', 'ups'],
  UK: ['royal_mail', 'dhl', 'fedex', 'ups'],
  Australia: ['australia_post', 'dhl', 'fedex', 'ups'],
  Canada: ['canada_post', 'fedex', 'ups', 'dhl'],
  // European countries default to DHL + international carriers
  Germany: ['dhl', 'fedex', 'ups'],
  France: ['dhl', 'fedex', 'ups'],
  Netherlands: ['dhl', 'fedex', 'ups'],
  Italy: ['dhl', 'fedex', 'ups'],
  Spain: ['dhl', 'fedex', 'ups'],
  'New Zealand': ['australia_post', 'dhl', 'fedex'],
};

/** Tracking number regex patterns for carrier auto-detection */
const TRACKING_PATTERNS: { carrier: string; pattern: RegExp }[] = [
  // UPS: 1Z + 6 alphanumeric + 2 digits + 8 digits
  { carrier: 'ups', pattern: /^1Z[A-Z0-9]{6}\d{10}$/i },
  // USPS: Various formats (20-34 digits)
  { carrier: 'usps', pattern: /^(94|93|92|91|90|82|70)\d{18,30}$/ },
  // Royal Mail: 2 letters + 9 digits + 2 letters (e.g., AB123456789GB)
  { carrier: 'royal_mail', pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/i },
  // FedEx: 12 or 15 digits
  { carrier: 'fedex', pattern: /^\d{12,15}$/ },
  // DHL: 10 digits
  { carrier: 'dhl', pattern: /^\d{10}$/ },
  // Australia Post: 13 digits or letter-based
  { carrier: 'australia_post', pattern: /^[A-Z]{2}\d{9}AU$/i },
];

/**
 * Auto-detect carrier from tracking number format
 */
export function detectCarrier(trackingNumber: string): string | null {
  if (!trackingNumber || trackingNumber.length < 4) return null;
  const cleaned = trackingNumber.trim().replace(/\s/g, '');

  for (const { carrier, pattern } of TRACKING_PATTERNS) {
    if (pattern.test(cleaned)) return carrier;
  }

  return null;
}

/**
 * Get tracking URL for a carrier and tracking number
 */
export function getTrackingUrl(carrierId: string, trackingNumber: string): string | null {
  const carrier = CARRIERS[carrierId];
  if (!carrier) return null;
  return carrier.trackingUrlTemplate.replace('{number}', encodeURIComponent(trackingNumber.trim()));
}

/**
 * Get rate calculator URL for a country's primary carrier
 */
export function getRateCalculatorUrl(country: string): string | null {
  const carrierIds = COUNTRY_CARRIERS[country];
  if (!carrierIds || carrierIds.length === 0) return null;
  const carrier = CARRIERS[carrierIds[0]];
  return carrier?.rateCalculatorUrl || null;
}

/**
 * Get all available carriers for a country
 */
export function getCarriersForCountry(country: string): CarrierInfo[] {
  const carrierIds = COUNTRY_CARRIERS[country] || [];
  return carrierIds.map((id) => CARRIERS[id]).filter(Boolean);
}

/**
 * Get all carriers (for dropdown selection)
 */
export function getAllCarriers(): CarrierInfo[] {
  return Object.values(CARRIERS);
}

/**
 * Format a shipping method value for display
 */
export function formatShippingMethod(method: string): string {
  const labels: Record<string, string> = {
    standard_post: 'Standard Post',
    courier_express: 'Courier / Express',
    freight: 'Freight',
  };
  return labels[method] || method;
}

/**
 * Format a ships_to value for display
 */
export function formatShipsTo(shipsTo: string): string {
  const labels: Record<string, string> = {
    domestic_only: 'Domestic Only',
    international: 'Ships Internationally',
    specific_countries: 'Specific Countries',
  };
  return labels[shipsTo] || shipsTo;
}
