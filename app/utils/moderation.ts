/**
 * Content Moderation Utilities
 * Client-side pre-validation for user messages
 * Note: Server-side validation is the authoritative check
 */

import { MAX_CONTENT_LENGTH } from '~/utils/constants';
import { hasDisallowedUrl } from '~/utils/allowedDomains';

export interface ModerationResult {
  isClean: boolean;
  issues: string[];
  moderationStatus: 'approved' | 'flagged' | 'rejected';
}

/**
 * Check message content for common moderation issues
 * This is a client-side check for immediate feedback
 * Server-side validation in server/utils/contentFilter.ts is authoritative
 */
export function checkMessageContent(content: string): ModerationResult {
  const issues: string[] = [];

  // Check for phone numbers (US format, including with parentheses)
  if (/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(content)) {
    issues.push('phone_number');
  }

  // Check for email addresses
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(content)) {
    issues.push('email');
  }

  // Check for URLs (skip if every URL is on the shipping carrier allowlist)
  if (hasDisallowedUrl(content)) {
    issues.push('external_url');
  }

  // Determine moderation status
  const moderationStatus = issues.length === 0 ? 'approved' : 'flagged';

  return {
    isClean: issues.length === 0,
    issues,
    moderationStatus,
  };
}

/**
 * Get user-friendly warning message for detected issues
 */
export function getModerationWarning(issues: string[]): string {
  if (issues.length === 0) return '';

  const warnings: string[] = [];

  if (issues.includes('phone_number')) {
    warnings.push('phone numbers');
  }
  if (issues.includes('email')) {
    warnings.push('email addresses');
  }
  if (issues.includes('external_url')) {
    warnings.push('external links');
  }
  if (issues.includes('profanity')) {
    warnings.push('inappropriate language');
  }

  if (warnings.length === 1) {
    return `This message contains ${warnings[0]}. Please keep conversations on the platform for your safety.`;
  }

  const lastWarning = warnings.pop();
  return `This message contains ${warnings.join(', ')} and ${lastWarning}. Please keep conversations on the platform for your safety.`;
}

/**
 * Validate message length
 */
export function validateMessageLength(content: string): { valid: boolean; message?: string } {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, message: 'Message cannot be empty' };
  }

  if (trimmed.length < 2) {
    return { valid: false, message: 'Message is too short (minimum 2 characters)' };
  }

  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { valid: false, message: `Message is too long (maximum ${MAX_CONTENT_LENGTH} characters)` };
  }

  return { valid: true };
}

/**
 * Check rate limiting (client-side estimation)
 * Returns true if likely rate limited
 */
export function checkRateLimit(recentMessageTimes: number[]): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Count messages in last minute
  const recentCount = recentMessageTimes.filter((time) => time > oneMinuteAgo).length;

  // Warn if approaching limit (10 messages per minute)
  return recentCount >= 10;
}
