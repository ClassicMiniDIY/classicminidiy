/**
 * Shared date and formatting utilities
 */

/**
 * Format a date string with full date and time
 * Example: "Feb 10, 2026, 3:45 PM"
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format a date string with date only (no time)
 * Example: "Feb 10, 2026"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a timestamp as a short, messenger-style relative time.
 *
 * Rules:
 *   < 1 min     → "just now"
 *   < 1 hour    → "Nm ago"
 *   < 24 hours  → "Nh ago"
 *   < 7 days    → "Nd ago"
 *   older       → "Mon D, h:mm AM" (with time) or "Mon D" (without)
 *
 * Used by the messaging UI (MessageList, ListingConversationGroup, etc.)
 * where space is tight and "2h ago" is friendlier than a full timestamp.
 */
export function formatRelativeTime(
  timestamp: string,
  options: { includeTime?: boolean } = {}
): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(options.includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
