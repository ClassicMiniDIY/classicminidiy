import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_DISCUSS_PAGES,
  communityDiscussExternalId,
  communityDiscussKeyForPath,
  communityDiscussPage,
  communityDiscussTopicTitle,
  type CommunityDiscussKey,
} from '~~/shared/utils/communityDiscuss';

// The allowlist behind "Discuss this" links
// (docs/plans/2026-10-05-community-discuss-links.md).

const entries = Object.entries(COMMUNITY_DISCUSS_PAGES) as [CommunityDiscussKey, { path: string; title: string }][];

describe('COMMUNITY_DISCUSS_PAGES', () => {
  it.each(entries)('%s has a forum-valid, prefixed topic title (15 to 255 characters)', (_key, page) => {
    const title = communityDiscussTopicTitle(page);
    expect(title.startsWith('Discussion: ')).toBe(true);
    expect(title.length).toBeGreaterThanOrEqual(15);
    expect(title.length).toBeLessThanOrEqual(255);
  });

  it('topic titles are unique (the forum refuses duplicate titles)', () => {
    const titles = entries.map(([, page]) => communityDiscussTopicTitle(page).toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(entries)('%s has a forum-valid external_id', (key) => {
    const id = communityDiscussExternalId(key);
    expect(id).toMatch(/^[\w-]+$/);
    expect(id.length).toBeLessThanOrEqual(50);
  });

  it.each(entries)('%s path is normalised (lowercase, no trailing slash, no double hyphen)', (_key, page) => {
    expect(page.path).toBe(page.path.toLowerCase());
    expect(page.path).toMatch(/^\/[a-z0-9/-]+[a-z0-9]$/);
    expect(page.path).not.toContain('--');
  });

  it.each(entries)('%s path is a real page file', (_key, page) => {
    const dir = join(process.cwd(), 'app/pages', page.path);
    const parent = join(dir, '..');
    const leaf = page.path.split('/').pop()!;
    const files = readdirSync(parent);
    const exists = files.includes(`${leaf}.vue`) || (files.includes(leaf) && readdirSync(dir).includes('index.vue'));
    expect(exists, `${page.path} has no page file`).toBe(true);
  });
});

describe('lookups', () => {
  it('maps a path to its key, ignoring a trailing slash and case', () => {
    expect(communityDiscussKeyForPath('/technical/torque')).toBe('technical-torque');
    expect(communityDiscussKeyForPath('/Archive/Colors/')).toBe('archive-colors');
  });

  it('returns null for pages outside the list, including item pages', () => {
    expect(communityDiscussKeyForPath('/')).toBeNull();
    expect(communityDiscussKeyForPath('/archive/colors/abc-123')).toBeNull();
    expect(communityDiscussKeyForPath('/exchange')).toBeNull();
  });

  it('resolves only own string keys', () => {
    expect(communityDiscussPage('technical-torque')?.path).toBe('/technical/torque');
    expect(communityDiscussPage('toString')).toBeNull();
    expect(communityDiscussPage('__proto__')).toBeNull();
    expect(communityDiscussPage(['technical-torque'])).toBeNull();
    expect(communityDiscussPage(undefined)).toBeNull();
  });
});
