/**
 * Shared formatting utilities for Wanted Posts.
 * Used by WantedCard, WantedTable, and the detail page.
 */

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    GBP: '\u00A3',
    EUR: '\u20AC',
    AUD: 'A$',
    CAD: 'C$',
    NZD: 'NZ$',
    JPY: '\u00A5',
  };
  return symbols[currency] || `${currency} `;
}

export function formatBudget(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string
): string | null {
  const currencySymbol = getCurrencySymbol(currency);

  if (min && max) {
    return `${currencySymbol}${min.toLocaleString()} - ${currencySymbol}${max.toLocaleString()}`;
  }
  if (max) {
    return `Up to ${currencySymbol}${max.toLocaleString()}`;
  }
  if (min) {
    return `From ${currencySymbol}${min.toLocaleString()}`;
  }
  return null;
}

export function formatLocation(
  city: string | null | undefined,
  stateProvince: string | null | undefined,
  country: string | null | undefined
): string | null {
  const parts = [city, stateProvince, country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    vehicle: 'Vehicle',
    engine: 'Engine',
    parts: 'Parts',
  };
  return labels[category] || category;
}

export function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'vehicle':
      return 'badge-primary';
    case 'engine':
      return 'badge-secondary';
    case 'parts':
      return 'badge-accent';
    default:
      return 'badge-ghost';
  }
}

export function wantedStatusBadgeClass(status: string): string {
  switch (status) {
    case 'fulfilled':
      return 'badge-success';
    case 'expired':
      return 'badge-error';
    case 'flagged':
      return 'badge-warning';
    case 'cancelled':
    default:
      return 'badge-ghost';
  }
}

export function formatWantedStatus(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    fulfilled: 'Fulfilled',
    expired: 'Expired',
    flagged: 'Under Review',
    cancelled: 'Cancelled',
    removed: 'Removed',
  };
  return labels[status] || status;
}
