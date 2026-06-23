/**
 * Server-side Content Moderation
 * Authoritative content filtering and moderation
 */

import { Filter } from 'bad-words';
import { isAllowedDomain } from '~/utils/allowedDomains';

const filter = new Filter();

export interface ModerationResult {
  isClean: boolean;
  issues: string[];
  filteredContent: string;
  moderationStatus: 'approved' | 'flagged' | 'rejected';
}

/**
 * Moderate message content on the server
 * This is the authoritative check - client-side checks are just for UX
 */
export function moderateMessage(content: string): ModerationResult {
  const issues: string[] = [];
  let filteredContent = content;

  // Check for profanity
  if (filter.isProfane(content)) {
    issues.push('profanity');
    filteredContent = filter.clean(content);
  }

  // Check for phone numbers (multiple formats)
  // US: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
  // International: +1 123 456 7890, +44 20 1234 5678, +61 2 1234 5678
  const phonePatterns = [
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, // US format
    /\+?\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/, // International (1-4 digits in second group)
  ];

  for (const pattern of phonePatterns) {
    if (pattern.test(content)) {
      issues.push('phone_number');
      break;
    }
  }

  // Check for email addresses
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(content)) {
    issues.push('email');
  }

  // Check for URLs (http, https, www, common TLDs)
  // Skip the flag if every matched URL is on the shipping carrier allowlist.
  const urlPattern = /(https?:\/\/[^\s)]+|www\.[^\s)]+|[a-z0-9-]+\.(?:com|net|org|co\.uk|io|app|dev)(?:\/[^\s)]*)?)/gi;
  const urlMatches = content.match(urlPattern);
  if (urlMatches && urlMatches.some((url) => !isAllowedDomain(url))) {
    issues.push('external_url');
  }

  // Check for social media handles/usernames
  if (/@[a-z0-9_]+|snapchat|instagram|whatsapp|telegram|signal/i.test(content)) {
    issues.push('social_media');
  }

  // Determine moderation status
  let moderationStatus: 'approved' | 'flagged' | 'rejected' = 'approved';

  if (issues.length > 0) {
    // Profanity always flags
    if (issues.includes('profanity')) {
      moderationStatus = 'flagged';
    }
    // Multiple contact methods is suspicious
    else if (issues.length >= 2) {
      moderationStatus = 'flagged';
    }
    // Single contact method is just flagged for review
    else {
      moderationStatus = 'flagged';
    }
  }

  return {
    isClean: issues.length === 0,
    issues,
    filteredContent,
    moderationStatus,
  };
}

/**
 * Validate message content length and format
 */
export function validateMessageContent(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Message is too short (minimum 2 characters)' };
  }

  if (trimmed.length > 2000) {
    return { valid: false, error: 'Message is too long (maximum 2000 characters)' };
  }

  return { valid: true };
}

/**
 * Message rate limiting check
 * Returns true if rate limit is exceeded (max 10 messages)
 */
export function checkMessageRateLimit(recentMessageCount: number): boolean {
  const maxMessagesPerWindow = 10;
  return recentMessageCount >= maxMessagesPerWindow;
}

/**
 * Spam detection heuristics
 */
export function detectSpam(content: string): boolean {
  const lowerContent = content.toLowerCase();

  // Check for excessive repetition
  const words = lowerContent.split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 5 && uniqueWords.size / words.length < 0.3) {
    return true; // Less than 30% unique words suggests spam
  }

  // Check for all caps (if long enough)
  if (content.length > 20 && content === content.toUpperCase()) {
    return true;
  }

  // Check for excessive punctuation
  const punctuationCount = (content.match(/[!?]{2,}/g) || []).length;
  if (punctuationCount > 3) {
    return true;
  }

  // Check for common spam keyword patterns
  if (detectSpamKeywords(lowerContent)) {
    return true;
  }

  return false;
}

const SPAM_KEYWORD_PATTERNS = [
  // SEO / marketing spam
  /\b(seo|search engine optimization)\s*(services?|agency|experts?|company)/,
  /\b(web|website)\s*(design|development|traffic)\s*(services?|agency|company)/,
  /\bbuy\s*(backlinks|traffic|followers|likes|views)\b/,
  /\b(guaranteed|instant)\s*(ranking|traffic|results|followers)\b/,
  /\bfirst\s*page\s*(of\s*)?(google|ranking)/,
  // Crypto / financial scams
  /\b(bitcoin|crypto|forex)\s*(trading|investment|profit|earn)/,
  /\b(earn|make)\s*\$?\d{3,}\s*(per|a|each)\s*(day|week|month|hour)/,
  /\b(investment|trading)\s*(opportunity|platform|system|bot)\b/,
  /\b(passive\s*income|financial\s*freedom|get\s*rich)\b/,
  // Pharmaceutical / adult spam
  /\b(viagra|cialis|pharmacy|pills?)\s*(online|cheap|buy|order)/,
  /\b(weight\s*loss|diet)\s*(pills?|supplement|miracle)/,
  // Generic spam patterns
  /\b(act\s*now|limited\s*time\s*offer|don'?t\s*miss\s*out)\b/,
  /\b(click\s*here|visit\s*(my|our)\s*(site|website|link))\b/,
  /\b(free\s*(trial|quote|consultation|offer))\b.*\b(free\s*(trial|quote|consultation|offer))\b/,
  /\b(work\s*from\s*home|home\s*based\s*business)\b/,
  /\b(casino|gambling|poker|betting)\s*(online|site|bonus)/,
  // Mass outreach patterns
  /\bI\s*(found|visited|came\s*across)\s*(your|the)\s*(site|website)\b.*\b(offer|service|help)\b/,
  /\bdear\s*(sir|madam|webmaster|admin|website\s*owner)\b/,
];

/**
 * Detect common spam keyword patterns in content
 * Checks for SEO spam, crypto scams, marketing spam, etc.
 */
export function detectSpamKeywords(content: string): boolean {
  return SPAM_KEYWORD_PATTERNS.some((pattern) => pattern.test(content));
}
