/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  moderateMessage,
  validateMessageContent,
  checkMessageRateLimit,
  detectSpam,
  detectSpamKeywords,
} from '~~/server/utils/exchange/contentFilter';

// ---------------------------------------------------------------------------
// moderateMessage — clean / happy path
// ---------------------------------------------------------------------------
describe('moderateMessage — clean content', () => {
  it.each([
    'Hello, is this part still available?',
    'normal everyday message about mini parts',
    'I have 4 wheels and 2 tyres for sale',
    'price is 250 dollars for the set firm',
    'Order #12345 shipped today everything ok',
    'Looking for a 1275 GT gearbox in good condition',
  ])('returns approved + clean for %j', (content) => {
    const result = moderateMessage(content);
    expect(result.isClean).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.moderationStatus).toBe('approved');
    expect(result.filteredContent).toBe(content);
  });

  it('treats an empty string as clean (no issues)', () => {
    const result = moderateMessage('');
    expect(result).toEqual({
      isClean: true,
      issues: [],
      filteredContent: '',
      moderationStatus: 'approved',
    });
  });

  it('treats a whitespace-only string as clean', () => {
    const result = moderateMessage('   ');
    expect(result.isClean).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.moderationStatus).toBe('approved');
    expect(result.filteredContent).toBe('   ');
  });

  it('leaves clean filteredContent identical to the input', () => {
    const content = 'A perfectly ordinary sentence with unicode café résumé 日本語 👍';
    const result = moderateMessage(content);
    expect(result.isClean).toBe(true);
    expect(result.filteredContent).toBe(content);
  });

  it('does not treat bare numbers / quantities as a phone number', () => {
    expect(moderateMessage('I have 4 wheels and 2 tyres for sale').issues).not.toContain('phone_number');
    expect(moderateMessage('Order #12345 shipped today everything ok').issues).not.toContain('phone_number');
  });
});

// ---------------------------------------------------------------------------
// moderateMessage — profanity detector
// ---------------------------------------------------------------------------
describe('moderateMessage — profanity', () => {
  it('flags profanity and masks it in filteredContent', () => {
    const result = moderateMessage('Pretty sure this damn thing works');
    expect(result.issues).toContain('profanity');
    expect(result.isClean).toBe(false);
    expect(result.moderationStatus).toBe('flagged');
    // bad-words replaces the matched word with asterisks
    expect(result.filteredContent).toBe('Pretty sure this **** thing works');
    expect(result.filteredContent).not.toContain('damn');
  });

  it('profanity always flags even when it is the only issue', () => {
    const result = moderateMessage('damn');
    expect(result.issues).toEqual(['profanity']);
    expect(result.moderationStatus).toBe('flagged');
    expect(result.filteredContent).toBe('****');
  });

  it('clean content is never masked', () => {
    const result = moderateMessage('this is a clean sentence');
    expect(result.issues).not.toContain('profanity');
    expect(result.filteredContent).toBe('this is a clean sentence');
  });
});

// ---------------------------------------------------------------------------
// moderateMessage — phone number detector
// ---------------------------------------------------------------------------
describe('moderateMessage — phone numbers', () => {
  it.each([
    ['US dashed', 'Call me 123-456-7890'],
    ['US dotted', 'Reach me at 123.456.7890'],
    ['US parenthesised', 'Call (123) 456-7890'],
    ['US plain 10-digit', 'Call 1234567890'],
    ['international +1', 'My number is +1 123 456 7890'],
    ['international +44', '+44 20 1234 5678'],
    ['international +61', 'ring +61 2 1234 5678'],
  ])('flags phone_number for %s', (_label, content) => {
    const result = moderateMessage(content);
    expect(result.issues).toContain('phone_number');
    expect(result.isClean).toBe(false);
    expect(result.moderationStatus).toBe('flagged');
  });

  it('only flags phone_number once even when multiple patterns match', () => {
    const result = moderateMessage('123-456-7890');
    const phoneFlags = result.issues.filter((i) => i === 'phone_number');
    expect(phoneFlags).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// moderateMessage — email detector
// ---------------------------------------------------------------------------
describe('moderateMessage — email addresses', () => {
  it('flags an email address', () => {
    const result = moderateMessage('Email me at john@example.com');
    expect(result.issues).toContain('email');
    expect(result.isClean).toBe(false);
    expect(result.moderationStatus).toBe('flagged');
  });

  it('flags email even when the domain is a shipping carrier', () => {
    // The carrier allowlist only suppresses external_url, not email.
    const result = moderateMessage('reach me john@usps.com');
    expect(result.issues).toContain('email');
  });

  it('is case-insensitive for email detection', () => {
    expect(moderateMessage('SELLER@EXAMPLE.COM').issues).toContain('email');
  });

  it('does not flag email for an at-sign with no domain', () => {
    // "@handle" matches social_media, not email (no TLD).
    const result = moderateMessage('my handle is @cooldude');
    expect(result.issues).not.toContain('email');
  });
});

// ---------------------------------------------------------------------------
// moderateMessage — external URL detector + carrier allowlist
// ---------------------------------------------------------------------------
describe('moderateMessage — external URLs', () => {
  it.each([
    ['https disallowed', 'Visit https://evil.example.com/deal'],
    ['bare domain', 'check fishysite.net/path'],
    ['.io TLD', 'see https://example.io/x'],
    ['.app TLD', 'order at shop.app/buy'],
  ])('flags external_url for %s', (_label, content) => {
    const result = moderateMessage(content);
    expect(result.issues).toContain('external_url');
    expect(result.isClean).toBe(false);
    expect(result.moderationStatus).toBe('flagged');
  });

  it.each([
    ['usps https subdomain', 'Visit https://tools.usps.com/track/123'],
    ['fedex www', 'Visit www.fedex.com/track'],
    ['bare usps.com', 'usps.com'],
  ])('does NOT flag allowlisted carrier URL: %s', (_label, content) => {
    const result = moderateMessage(content);
    expect(result.issues).not.toContain('external_url');
  });

  it('flags external_url when allowlisted and non-allowlisted URLs are mixed', () => {
    const result = moderateMessage('track at usps.com then see evil.example.com for more');
    expect(result.issues).toContain('external_url');
  });

  it('does not block a bypass-style host masquerading as a carrier', () => {
    // usps.com.evil.com is NOT on the allowlist (subdomain-of-evil, not of usps)
    const result = moderateMessage('go to https://usps.com.evil.com/track');
    expect(result.issues).toContain('external_url');
  });
});

// ---------------------------------------------------------------------------
// moderateMessage — social media / handle detector
// ---------------------------------------------------------------------------
describe('moderateMessage — social media handles', () => {
  it.each([
    ['@ handle', 'My handle is @cooldude'],
    ['instagram keyword', 'Hit me on instagram'],
    ['snapchat keyword', 'My snapchat is bob'],
    ['whatsapp keyword', 'whatsapp me'],
    ['telegram keyword (case-insensitive)', 'text TELEGRAM handle'],
    ['signal keyword', 'use signal app'],
  ])('flags social_media for %s', (_label, content) => {
    const result = moderateMessage(content);
    expect(result.issues).toContain('social_media');
    expect(result.isClean).toBe(false);
    expect(result.moderationStatus).toBe('flagged');
  });

  it('does not flag social_media for ordinary content', () => {
    expect(moderateMessage('looking for a carb needle set').issues).not.toContain('social_media');
  });
});

// ---------------------------------------------------------------------------
// moderateMessage — combinations + ordering + status
// ---------------------------------------------------------------------------
describe('moderateMessage — combinations and status', () => {
  it('an email address trips email + external_url + social_media together', () => {
    // "john@example.com" → email (full address), external_url (example.com TLD),
    // social_media (@example matches @[a-z0-9_]+). This documents the real,
    // overlapping detector behaviour.
    const result = moderateMessage('Email me at john@example.com');
    expect(result.issues).toEqual(['email', 'external_url', 'social_media']);
    expect(result.moderationStatus).toBe('flagged');
    expect(result.isClean).toBe(false);
  });

  it('emits issues in detector order: profanity, phone, email, url, social', () => {
    const result = moderateMessage('Contact john@example.com or call 123-456-7890');
    expect(result.issues).toEqual(['phone_number', 'email', 'external_url', 'social_media']);
  });

  it('profanity + url + social all flag, with masked filteredContent', () => {
    const result = moderateMessage('damn check https://evil.com and my insta @bob');
    expect(result.issues).toEqual(['profanity', 'external_url', 'social_media']);
    expect(result.filteredContent).toBe('**** check https://evil.com and my insta @bob');
    expect(result.moderationStatus).toBe('flagged');
  });

  it('every non-clean result is "flagged" — "rejected" is never produced', () => {
    const inputs = [
      'damn',
      'call 123-456-7890',
      'john@example.com',
      'see evil.example.com',
      '@handle',
      'Contact john@example.com or call 123-456-7890', // 4 issues
    ];
    for (const content of inputs) {
      const result = moderateMessage(content);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.moderationStatus).toBe('flagged');
      expect(result.moderationStatus).not.toBe('rejected');
    }
  });

  it('isClean is exactly the inverse of having issues', () => {
    expect(moderateMessage('all good here').isClean).toBe(true);
    expect(moderateMessage('@handle').isClean).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateMessageContent
// ---------------------------------------------------------------------------
describe('validateMessageContent', () => {
  it.each([
    ['empty string', '', 'Message cannot be empty'],
    ['whitespace only', '   ', 'Message cannot be empty'],
    ['single char', 'a', 'Message is too short (minimum 2 characters)'],
    ['single char with surrounding spaces', ' a ', 'Message is too short (minimum 2 characters)'],
  ])('rejects %s', (_label, content, error) => {
    const result = validateMessageContent(content);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(error);
  });

  it.each([
    ['exactly 2 chars (lower boundary)', 'ab'],
    ['normal message', 'hello there'],
    ['exactly 2000 chars (upper boundary)', 'x'.repeat(2000)],
    ['2000 chars after trimming surrounding whitespace', '  ' + 'x'.repeat(2000) + '  '],
  ])('accepts %s', (_label, content) => {
    const result = validateMessageContent(content);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects content longer than 2000 chars after trimming', () => {
    const result = validateMessageContent('x'.repeat(2001));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message is too long (maximum 2000 characters)');
  });

  it('measures length on the trimmed value, not the raw value', () => {
    // 1 real char + lots of whitespace → too short, not "valid"
    const result = validateMessageContent('a' + ' '.repeat(50));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message is too short (minimum 2 characters)');
  });
});

// ---------------------------------------------------------------------------
// checkMessageRateLimit
// ---------------------------------------------------------------------------
describe('checkMessageRateLimit', () => {
  it.each([0, 1, 5, 9])('returns false below the limit (%i)', (n) => {
    expect(checkMessageRateLimit(n)).toBe(false);
  });

  it.each([10, 11, 100])('returns true at or above the limit (%i)', (n) => {
    expect(checkMessageRateLimit(n)).toBe(true);
  });

  it('uses >= 10 as the boundary (9 allowed, 10 limited)', () => {
    expect(checkMessageRateLimit(9)).toBe(false);
    expect(checkMessageRateLimit(10)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectSpam — heuristics
// ---------------------------------------------------------------------------
describe('detectSpam', () => {
  it('flags excessive word repetition (low unique ratio, >5 words)', () => {
    expect(detectSpam('buy now buy now buy now buy now buy now buy now')).toBe(true);
  });

  it('flags long all-caps shouting (>20 chars)', () => {
    expect(detectSpam('THIS IS A VERY LOUD SHOUTING MESSAGE HERE')).toBe(true);
  });

  it('does NOT flag short all-caps (<=20 chars)', () => {
    expect(detectSpam('OK GREAT THANKS')).toBe(false);
  });

  it('flags excessive !? punctuation (more than 3 runs)', () => {
    expect(detectSpam('really?? amazing!! wow?? omg!! no way??')).toBe(true);
  });

  it('does NOT flag a modest amount of punctuation', () => {
    expect(detectSpam('really?? amazing!!')).toBe(false);
  });

  it('flags content matching a spam keyword pattern', () => {
    expect(detectSpam('we provide SEO services for your company')).toBe(true);
    expect(detectSpam('earn $5000 per day with crypto trading')).toBe(true);
  });

  it.each([
    'normal message about a classic mini gearbox swap',
    'short text',
    'Is the SU carb needle still available for purchase?',
  ])('does NOT flag legitimate content: %j', (content) => {
    expect(detectSpam(content)).toBe(false);
  });

  it('does not flag short repetitive content (<=5 words)', () => {
    // Repetition heuristic only kicks in when there are more than 5 words.
    expect(detectSpam('hi hi hi')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectSpamKeywords — pattern library
// ---------------------------------------------------------------------------
describe('detectSpamKeywords', () => {
  it.each([
    ['SEO services', 'we offer seo services here'],
    ['buy backlinks', 'buy backlinks cheap'],
    ['first page google', 'rank on the first page of google'],
    ['crypto trading', 'bitcoin trading profit guaranteed'],
    ['earn $/day', 'make $999 per day easy'],
    ['passive income', 'achieve passive income today'],
    ['pharma', 'viagra online cheap'],
    ['weight loss pills', 'weight loss pills miracle'],
    ['click here', 'click here to win'],
    ['act now', 'act now before it ends'],
    ['work from home', 'great work from home opportunity'],
    ['casino bonus', 'casino online bonus available'],
    ['dear webmaster', 'dear webmaster please contact me'],
  ])('detects %s', (_label, content) => {
    expect(detectSpamKeywords(content)).toBe(true);
  });

  it.each([
    'classic mini cooper for sale',
    'looking for a 998cc engine',
    'thanks for the quick reply',
  ])('does NOT match legitimate content: %j', (content) => {
    expect(detectSpamKeywords(content)).toBe(false);
  });

  it('matches case-insensitively (lowercased input)', () => {
    // detectSpamKeywords is called by detectSpam after .toLowerCase();
    // the patterns themselves are lowercase, so callers must lowercase first.
    expect(detectSpamKeywords('seo services')).toBe(true);
    expect(detectSpamKeywords('SEO SERVICES')).toBe(false); // patterns are lowercase-only
  });
});
