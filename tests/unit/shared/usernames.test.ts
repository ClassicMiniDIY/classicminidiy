import { describe, expect, it } from 'vitest';
import { RESERVED_USERNAMES, USERNAME_PATTERN, isValidForumUsername } from '~~/shared/utils/usernames';

describe('forum usernames', () => {
  it.each(['abc', 'mini-jane', '1275gt', 'a'.repeat(30), 'cooper-s-1967'])('accepts %s', (name) => {
    expect(isValidForumUsername(name)).toBe(true);
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(31)],
    ['uppercase', 'MiniJane'],
    ['a leading hyphen', '-mini'],
    ['a trailing hyphen', 'mini-'],
    ['an underscore', 'mini_jane'],
    ['a space', 'mini jane'],
    ['a dot', 'mini.jane'],
    ['non-ASCII', 'zoë-mini'],
    ['two hyphens in a row', 'mini--jane'],
    ['three hyphens in a row', 'mini---jane'],
  ])('rejects %s', (_label, name) => {
    expect(isValidForumUsername(name)).toBe(false);
  });

  it('rejects every reserved name, including the brand names', () => {
    for (const name of [
      'classicminidiy',
      'cmdiy',
      'theminiexchange',
      'tme',
      'discourse',
      'admin',
      'how-it-works',
      'admins',
      'everyone',
      'here',
      'all',
      'discobot',
      'sys',
    ]) {
      expect(RESERVED_USERNAMES.has(name)).toBe(true);
      expect(isValidForumUsername(name)).toBe(false);
    }
  });

  it('the reserved list is lowercase and each entry fits the pattern', () => {
    expect(RESERVED_USERNAMES.size).toBe(86);
    for (const name of RESERVED_USERNAMES) expect(USERNAME_PATTERN.test(name)).toBe(true);
  });

  it('rejects non-strings', () => {
    expect(isValidForumUsername(null)).toBe(false);
    expect(isValidForumUsername(undefined)).toBe(false);
    expect(isValidForumUsername(123)).toBe(false);
  });
});
