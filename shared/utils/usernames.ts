/**
 * Site usernames (`profiles.username`), which are also the forum usernames on
 * Classic Mini DIY Community (DiscourseConnect sends this value as `username`,
 * and the forum has `auth_overrides_username` on).
 *
 * Design: docs/plans/2026-10-03-discourse-sso.md ("Identity: the forum username").
 *
 * The database is the enforcement. This module is a copy of its rules so that
 * POST /api/discourse/sso can answer 409 early and the "Choose your forum name"
 * step can show the right message before a save. When the database list
 * changes in classicminidiy-supabase, change RESERVED_USERNAMES in the same
 * release.
 */

/**
 * 3 to 30 characters: lowercase letters, digits and hyphens, starting and
 * ending with a letter or digit. 30 is the forum's `max_username_length`.
 * Two hyphens in a row are also refused; isValidForumUsername checks that.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** A copy of the database's reserved-username list. Lowercase. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'auth',
  'callback',
  'dashboard',
  'dev',
  'feed',
  'login',
  'logout',
  'messages',
  'notifications',
  'onboarding',
  'privacy',
  'profile',
  'register',
  'search',
  'settings',
  'signup',
  'terms',
  'user',
  'users',
  'watchlist',
  'archive',
  'calculator',
  'chat',
  'clearance',
  'colors',
  'compression',
  'contributors',
  'electrical',
  'engines',
  'gearing',
  'maps',
  'manuals',
  'needles',
  'parts',
  'registry',
  'technical',
  'torque',
  'tuning',
  'weights',
  'welcome',
  'wheels',
  'listings',
  'sold',
  'payment',
  'how-it-works',
  'about',
  'classicminidiy',
  'cmdiy',
  'theminiexchange',
  'tme',
  'support',
  'help',
  'contact',
  'blog',
  'news',
  'moderator',
  'mod',
  'staff',
  'team',
  'official',
  'community',
  'forum',
  'discourse',
  'administrator',
  'moderators',
  'admins',
  'everyone',
  'here',
  'all',
  'discobot',
  'sys',
  // Discourse's own default reserved names: Discourse would rename a site user who
  // held one (info -> info1), so site and forum names would differ.
  'info',
  'you',
  'name',
  'username',
  'nickname',
  'discourseorg',
  'discourseforum',
  'null',
  'undefined',
  'root',
  'system',
  'test',
  'www',
]);

/** True when `name` matches USERNAME_PATTERN, has no `--`, and is not reserved. */
export function isValidForumUsername(name: unknown): name is string {
  return (
    typeof name === 'string' && USERNAME_PATTERN.test(name) && !name.includes('--') && !RESERVED_USERNAMES.has(name)
  );
}
