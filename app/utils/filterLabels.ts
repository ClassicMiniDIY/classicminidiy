/**
 * Shared filter label mappings used across the application.
 * Single source of truth for converting filter values to human-readable labels.
 */

export const categoryLabels: Record<string, string> = {
  vehicle: 'Vehicles',
  engine: 'Engines',
  parts: 'Parts',
};

export const partsSubcategoryLabels: Record<string, string> = {
  body_exterior: 'Body & Exterior',
  interior: 'Interior',
  wheels_tires: 'Wheels & Tires',
  engine_internals: 'Engine Internals',
  suspension: 'Suspension',
  electrical: 'Electrical',
  other: 'Other',
};

export const yearRangeLabels: Record<string, string> = {
  '1960s': '1959-1969',
  '1970s': '1970-1979',
  '1980s': '1980-1989',
  '1990s': '1990-2000',
};

export const priceRangeLabels: Record<string, string> = {
  free: 'Free',
  'under-10k': 'Under $10k',
  '10k-20k': '$10k-$20k',
  '20k-30k': '$20k-$30k',
  '30k-50k': '$30k-$50k',
  'over-50k': 'Over $50k',
};

export const transmissionLabels: Record<string, string> = {
  magic_wand: 'Magic Wand',
  '3_synchro_remote': '3-Synchro Remote',
  '4_synchro_remote': '4-Synchro Remote',
  rod_change: 'Rod Change',
  automatic: 'Automatic',
};

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category;
}

export function getPartsSubcategoryLabel(subcategory: string): string {
  return partsSubcategoryLabels[subcategory] || subcategory;
}

export function getYearRangeLabel(range: string): string {
  return yearRangeLabels[range] || range;
}

export function getPriceRangeLabel(range: string): string {
  return priceRangeLabels[range] || range;
}

export function getTransmissionLabel(type: string): string {
  return transmissionLabels[type] || type;
}

export function getManufacturerLabel(manufacturer: string): string {
  return manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
}

export function getConditionLabel(condition: string): string {
  return condition.charAt(0).toUpperCase() + condition.slice(1);
}

/**
 * Format a filters object into a human-readable summary string.
 * Used by saved-searches page and FilterSidebar summary.
 */
export function formatFilterSummary(filters: Record<string, any>): string {
  const labelMap: Record<string, (val: string) => string> = {
    listing_category: getCategoryLabel,
    parts_subcategory: getPartsSubcategoryLabel,
    model: (val) => val,
    year_range: getYearRangeLabel,
    price_range: getPriceRangeLabel,
    condition: getConditionLabel,
    transmission: getTransmissionLabel,
    manufacturer: getManufacturerLabel,
    location: (val) => val,
  };

  const parts: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '' && labelMap[key]) {
      parts.push(labelMap[key](String(value)));
    }
  }

  return parts.length > 0 ? parts.join(' \u00B7 ') : 'All listings';
}
